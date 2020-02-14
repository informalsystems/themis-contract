import { TomlReader } from '@sgarciac/bombadil'
import * as Handlebars from 'handlebars'
import * as tmp from 'tmp'
import * as path from 'path'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_PDF_FONT, DEFAULT_PDF_ENGINE, DEFAULT_TEMPLATE_EXT, DEFAULT_GIT_REPO_CACHE_PATH } from './constants'
import { isGitURL } from './git-url'
import { readFileAsync, writeFileAsync, spawnAsync, copyFileAsync, readdirAsync, fileExistsAsync, writeGMAsync } from './async-io'
import { DocumentCache } from './document-cache'
import { logger } from './logging'
import axios from 'axios'
import { extractHandlebarsTemplateVariables, extractMustacheTemplateVariables, templateVarsToObj, initialsImageName, fullSigImageName } from './template-helpers'
import { writeTOMLFileAsync } from './toml'
import { TemplateError, ContractMissingFieldError, ContractFormatError } from './errors'
import { Counterparty, Signatory } from './counterparties'
import { Identity } from './identities'
// import * as Git from 'nodegit'
import * as mime from 'mime-types'
import { URL } from 'url'
import { keybaseSign, keybaseSigFilename } from './keybase-helpers'
import * as crypto from 'crypto'
import * as gm from 'gm'
import * as Mustache from 'mustache'

/**
 * We allow for either Handlebars.js or Mustache.js templating at present.
 */
export enum TemplateFormat {
  Handlebars,
  Mustache,
}

export const templateFormatFromString = (s: string): TemplateFormat => {
  switch (s) {
  case 'handlebars':
    return TemplateFormat.Handlebars
  case 'mustache':
    return TemplateFormat.Mustache
  }
  throw new ContractFormatError(`Unrecognized template format in contract: ${s} (should either be "handlebars" or "mustache")`)
}

const templateFormatToString = (f: TemplateFormat): string => {
  switch (f) {
  case TemplateFormat.Handlebars:
    return 'handlebars'
  case TemplateFormat.Mustache:
    return 'mustache'
  }
}

const templateDelimeters = (a: any): string[] => {
  if (!Array.isArray(a)) {
    throw new ContractFormatError('Expected template.delimiters parameter to be an array')
  }
  const result: string[] = []
  for (const s of a) {
    if (!(typeof s === 'string')) {
      throw new ContractFormatError('Expected each element in template.delimeters to be a string')
    }
    result.push(s)
  }
  if (result.length !== 2) {
    throw new ContractFormatError(`Expected precisely 2 string elements in template.delimieters, but got ${result.length}`)
  }
  return result
}

export type TemplateLoadOptions = {
  contractFilename: string;
  gitRepoCachePath: string;
  format?: TemplateFormat;
  customDelimiters?: string[];
  cache?: DocumentCache;
  encoding?: string;
}

/**
 * A contract template.
 */
export class Template {
  /** This template's source. */
  src: string

  /** The raw Mustache content of the template. */
  content: string

  /** The file extension to use for this template. */
  ext?: string

  /** Which template engine should we use? */
  format = TemplateFormat.Handlebars

  /** Custom delimiters (for Mustache templates only). */
  customDelimiters?: string[]

  constructor(src: string, content: string) {
    this.src = src
    this.content = content
  }

  getVariables(): Map<string, any> {
    switch (this.format) {
    case TemplateFormat.Handlebars:
      return extractHandlebarsTemplateVariables(this.content)
    case TemplateFormat.Mustache:
      return extractMustacheTemplateVariables(this.content, this.customDelimiters)
    }
  }

  /**
   * Automatically determines the nature of the given source and tries to load a
   * template from there.
   * @param {string} src The source from which to load a template. Must be an
   *   absolute path.
   * @param {TemplateLoadOptions} opts Options for loading the template.
   * @returns {Template} A template, if one can be successfully loaded.
   */
  static async load(src: string, opts?: TemplateLoadOptions): Promise<Template> {
    if (src.indexOf('://') > -1) {
      return Template.loadFromRemote(src, opts)
    }
    let filename = src
    if (!path.isAbsolute(filename)) {
      if (opts) {
        filename = path.resolve(path.parse(opts.contractFilename).dir, filename)
      } else {
        throw new Error('If template path is relative, the full contract filename must be supplied')
      }
    }
    return Template.loadFromFile(filename, opts)
  }

  static async loadFromFile(filename: string, opts?: TemplateLoadOptions): Promise<Template> {
    logger.debug(`Attempting to load template as file: ${filename}`)
    const content = await readFileAsync(filename, { encoding: (opts && opts.encoding) ? opts.encoding : DEFAULT_TEXT_FILE_ENCODING })
    const parsedFilename = path.parse(filename)
    const template = new Template(filename, content)
    template.ext = parsedFilename.ext
    template.format = (opts && opts.format) ? opts.format : template.format
    template.customDelimiters = (opts && opts.customDelimiters) ? opts.customDelimiters : template.customDelimiters
    return template
  }

  static async loadFromRemote(url: string, opts?: TemplateLoadOptions): Promise<Template> {
    const gitRepoCachePath = opts ? opts.gitRepoCachePath : DEFAULT_GIT_REPO_CACHE_PATH
    if (isGitURL(url)) {
      // return Template.loadFromGit(url, gitRepoCachePath, cache)
      throw new Error(`Git repository remotes are not yet supported (${gitRepoCachePath})`)
    }
    return Template.loadFromURL(url, opts)
  }

  // static async loadFromGit(url: string, gitRepoCachePath: string, cache?: DocumentCache): Promise<Template> {
  //   logger.debug(`Attempting to load template from Git repository: ${url}`)
  //   if (cache) {
  //     // check if we can load the document from cache
  //     const cachedContent = await cache.getContent(url)
  //     if (cachedContent !== null) {
  //       logger.debug(`Found template in cache: ${url}`)
  //       return new Template(url, cachedContent)
  //     }
  //   }
  //   const gitURL = GitURL.parse(url)
  //   const parsedPath = path.parse(gitURL.path)
  //   const localRepoPath = path.join(gitRepoCachePath, )
  // }

  static async loadFromURL(url: string, opts?: TemplateLoadOptions): Promise<Template> {
    logger.debug(`Attempting to load template from remote URL: ${url}`)
    if (opts && opts.cache) {
      // check if we can load the document from cache
      const cachedContent = await opts.cache.getContent(url)
      if (cachedContent !== null) {
        logger.debug(`Found template in cache: ${url}`)
        return new Template(url, cachedContent)
      }
    }
    const res = await axios.get(url)
    if (res.status >= 300) {
      throw new TemplateError(`GET request to ${url} resulted in status code ${res.status}`)
    }
    let ext: string | undefined
    if ('content-type' in res.headers) {
      const extForContentType = mime.extension(res.headers['content-type'])
      if (extForContentType) {
        ext = `.${extForContentType}`
        logger.debug(`Detected content type as "${res.headers['content-type']}", file extension "${ext}"`)
      }
    }
    // try to extract the extension from the file path
    if (!ext) {
      const u = new URL(url)
      const pathParts = u.pathname.split('.')
      if (pathParts.length > 1) {
        ext = `.${pathParts[pathParts.length - 1]}`
        logger.debug(`Extracted extension from URL: "${ext}"`)
      }
    }
    const template = new Template(url, res.data)
    template.ext = ext
    template.format = (opts && opts.format) ? opts.format : template.format
    template.customDelimiters = (opts && opts.customDelimiters) ? opts.customDelimiters : template.customDelimiters
    if (opts && opts.cache) {
      await opts.cache.add(url, template.content)
    }
    return template
  }

  // Renders this template to a string using the specified parameters.
  render(params: any): string {
    switch (this.format) {
    case TemplateFormat.Handlebars:
      logger.debug('Rendering template using Handlebars')
      return Handlebars.compile(this.content)(params)
    case TemplateFormat.Mustache:
      logger.debug(`Rendering template using Mustache (customDelimiters = ${this.customDelimiters})`)
      return Mustache.render(
        this.content,
        params,
        {},
        this.customDelimiters ? [this.customDelimiters[0], this.customDelimiters[1]] : undefined,
      )
    }
  }
}

export type ContractCreateOptions = {
  gitRepoCachePath: string;
  template?: string;
  templateFormat?: TemplateFormat;
  force?: boolean;
  cache?: DocumentCache;
  counterparties?: string[];
}

export type ContractLoadOptions = {
  gitRepoCachePath: string;
  cache?: DocumentCache;
}

export type ContractSignOptions = {
  counterparty: Counterparty;
  signatory: Signatory;
  identity: Identity;
  useKeybase: boolean;
}

/**
 * A contract is effectively a configuration file that describes:
 *
 *   1. A template (Mustache)
 *   2. Counterparties (including signatories)
 *   3. Parameters to use to fill in the contract template
 */
export class Contract {
  /** The full path to the contract */
  filename?: string

  /** The raw text content of the contract file. */
  raw?: string

  /** The template associated with this contract. */
  template?: Template

  /** Counterparty and signatory data we've extracted from the contract. */
  counterparties = new Map<string, Counterparty>()

  /** Additional parameters we've extracted from the contract. */
  params: any = {}

  /** Hex digest containing the hash of the contract + template. */
  hash?: string

  sortedCounterparties(): Counterparty[] {
    const result: Counterparty[] = []
    this.counterparties.forEach(c => result.push(c))
    return result.sort((a, b) => {
      if (a.fullName < b.fullName) {
        return -1
      }
      if (a.fullName > b.fullName) {
        return 1
      }
      return 0
    })
  }

  private async lookupSignatureImages(basePath: string): Promise<Map<string, string>> {
    const entries = await readdirAsync(basePath)
    const images = new Map<string, string>()
    for (const entry of entries) {
      const fullPath = path.join(basePath, entry)
      if (await fileExistsAsync(fullPath)) {
        const parsedPath = path.parse(fullPath)
        const nameParts = parsedPath.name.split('__')
        if (nameParts.length !== 3) {
          continue
        }
        const counterpartyID = nameParts[0]
        const signatoryID = nameParts[1]
        const sigType = nameParts[2]
        const counterparty = this.counterparties.get(counterpartyID)
        if (!counterparty) {
          continue
        }
        const signatory = counterparty.signatories.get(signatoryID)
        if (!signatory) {
          continue
        }
        if (sigType === 'initials' || sigType === 'full') {
          images.set(parsedPath.name, fullPath)
          logger.debug(`Found signature image ${parsedPath.name} at: ${fullPath}`)
        }
      }
    }
    return images
  }

  private async prepareTemplateParams(inputFile: string) {
    if (!this.hash) {
      throw new Error('Internal error: no hash of contract + template')
    }
    const inputPathParsed = path.parse(inputFile)
    const sigImages = await this.lookupSignatureImages(path.resolve(inputPathParsed.dir))

    this.params.hash = this.hash
    // ensure counterparties are populated fully
    this.params.counterparties = {}
    this.params.counterparties_list = []
    this.counterparties.forEach(counterparty => {
      const cvar = counterparty.toTemplateVar(sigImages)
      this.params.counterparties[counterparty.id] = cvar
      this.params.counterparties_list.push(cvar)
      if (counterparty.id in this.params) {
        this.params[counterparty.id] = cvar
      }
    })
    // additional useful parameters
    this.params.contract_path = inputPathParsed.dir
  }

  async compile(outputFile: string, style: any) {
    if (!this.filename) {
      throw new Error('Missing filename for contract')
    }
    if (!this.template) {
      throw new Error('Missing template for contract')
    }
    this.computeHash()
    await this.prepareTemplateParams(this.filename)
    logger.debug(`Using template params: ${JSON.stringify(this.params, null, 2)}`)
    // render the template to a temporary directory
    const templateExt = this.template.ext ? this.template.ext : DEFAULT_TEMPLATE_EXT
    const tmpContract = tmp.fileSync({ postfix: templateExt })
    try {
      const renderedTemplate = this.template.render(this.params)
      await writeFileAsync(
        tmpContract.name,
        renderedTemplate,
      )
      logger.debug(`Wrote contract to temporary file: ${tmpContract.name}`)
      logger.debug(`Wrote rendered template:\n${renderedTemplate}`)

      logger.info('Generating PDF...')
      if (templateExt === '.tex') {
        await this.compileWithTectonic(tmpContract.name, outputFile)
      } else {
        await this.compileWithPandoc(tmpContract.name, outputFile, style)
      }
      logger.info(`Saved output PDF file: ${outputFile}`)
    } finally {
      // ensure we clean up the temporary file
      tmpContract.removeCallback()
    }
  }

  async sign(opts: ContractSignOptions) {
    if (!opts.identity.sigInitials) {
      throw new Error('Identity does not have an initials signature file')
    }
    if (!opts.identity.sigFull) {
      throw new Error('Identity does not have a full signature file')
    }
    this.computeHash()
    if (opts.useKeybase) {
      await this.signWithKeybase(opts)
    } else {
      await this.signWithoutKeybase(opts)
    }
  }

  private computeHash() {
    if (!this.raw || !this.template) {
      throw new Error('Internal error: missing fields in contract to be able to compute hash')
    }
    const hash = crypto.createHash('sha256')
    hash.update(this.raw)
    hash.update(this.template.content)
    this.hash = hash.digest('hex').toLowerCase()
    logger.info(`SHA256 hash of contract + template: ${this.hash}`)
  }

  private async signWithKeybase(opts: ContractSignOptions) {
    if (!opts.identity.sigFull || !opts.identity.sigInitials || !this.filename || !this.template) {
      return
    }
    const parentPath = path.parse(this.filename).dir
    const concatFile = tmp.fileSync()
    const concat = this.raw + this.template.content
    try {
      await writeFileAsync(concatFile.name, concat)
      logger.debug(`Wrote contract + template to file: ${concatFile.name}`)
      const keybaseSigFile = keybaseSigFilename(parentPath, opts.counterparty, opts.signatory)
      logger.info('Using Keybase to sign contract + template...')
      await keybaseSign(concatFile.name, keybaseSigFile)
      logger.info(`Generated signature file: ${keybaseSigFile}`)
    } finally {
      concatFile.removeCallback()
    }
  }

  private async signWithoutKeybase(opts: ContractSignOptions) {
    if (!opts.identity.sigFull || !opts.identity.sigInitials || !this.filename || !this.raw || !this.template) {
      return
    }
    if (!this.hash) {
      throw new Error('Internal error: missing contract + template hash')
    }
    const initialsHash = `${this.hash.substr(0, this.hash.length / 4)}...`
    const sigHash = `${this.hash.substr(0, this.hash.length / 2)}...`

    const parentPath = path.parse(this.filename).dir
    const parsedSigInitials = path.parse(opts.identity.sigInitials)
    const parsedSigFull = path.parse(opts.identity.sigFull)

    const tmpDir = tmp.dirSync()

    try {
      const initialsHashImage = path.join(tmpDir.name, 'initials-hash.png')
      const sigHashImage = path.join(tmpDir.name, 'sig-hash.png')

      await writeGMAsync(
        initialsHashImage,
        gm(200, 50, '#ffffff').stroke('#000000').fontSize(18).drawText(10, 30, initialsHash),
      )
      await writeGMAsync(
        sigHashImage,
        gm(400, 50, '#ffffff').stroke('#000000').fontSize(20).drawText(10, 30, sigHash),
      )

      const destSigInitials = path.join(parentPath, `${initialsImageName(opts.counterparty.id, opts.signatory.id)}${parsedSigInitials.ext}`)
      await writeGMAsync(
        destSigInitials,
        gm(opts.identity.sigInitials).resize(200).append(initialsHashImage),
      )
      logger.debug(`Wrote identity signature initials to: ${destSigInitials}`)

      const destSigFull = path.join(parentPath, `${fullSigImageName(opts.counterparty.id, opts.signatory.id)}${parsedSigFull.ext}`)
      await writeGMAsync(
        destSigFull,
        gm(opts.identity.sigInitials).resize(400).append(sigHashImage),
      )
      logger.debug(`Wrote identity full signature to: ${destSigFull}`)

      logger.info(`Signed contract ${this.filename} as ${opts.signatory.fullNames} on behalf of ${opts.counterparty.fullName} using identity "${opts.identity.id}"`)
    } finally {
      tmpDir.removeCallback()
    }
  }

  private async compileWithPandoc(inputFile: string, outputFile: string, style: any) {
    // first use Pandoc to convert the document
    const pandocArgs = this.buildPandocArgs(inputFile, outputFile, style)
    logger.debug(`Using pandoc args: ${pandocArgs}`)
    const pandoc = await spawnAsync(
      'pandoc',
      pandocArgs,
      {},
    )
    logger.debug(`pandoc stdout:\n${pandoc.stdout}`)
    logger.debug(`pandoc stderr:\n${pandoc.stderr}`)
    if (pandoc.status !== null && pandoc.status !== 0) {
      throw new Error(`pandoc failed with status: ${pandoc.status}`)
    }
  }

  private buildPandocArgs(inputFile: string, outputFile: string, style: any): string[] {
    const font = 'font' in style ? style.font : DEFAULT_PDF_FONT
    const pdfEngine = 'pdf_engine' in style ? style.pdf_engine : DEFAULT_PDF_ENGINE
    return [
      inputFile,
      '-V',
      `mainfont="${font}"`,
      `--pdf-engine=${pdfEngine}`,
      '-o',
      outputFile,
    ]
  }

  private async compileWithTectonic(inputFile: string, outputFile: string) {
    const tmpOutDir = tmp.dirSync()
    const infParsed = path.parse(inputFile)
    try {
      const tectonic = await spawnAsync(
        'tectonic',
        [inputFile, '-o', tmpOutDir.name],
        {},
      )
      logger.debug(`tectonic stdout:\n${tectonic.stdout}`)
      logger.debug(`tectonic stderr:\n${tectonic.stderr}`)
      if (tectonic.status !== 0) {
        throw new Error(`tectonic failed with exit code: ${tectonic.status}`)
      }
      const tmpOutFile = path.join(tmpOutDir.name, `${infParsed.name}.pdf`)
      logger.debug(`Temporary output file should be at: ${tmpOutFile}`)
      await copyFileAsync(tmpOutFile, outputFile)
    } finally {
      tmpOutDir.removeCallback()
    }
  }

  static async fromFile(filename: string, opts?: ContractLoadOptions): Promise<Contract> {
    const content = await readFileAsync(filename, { encoding: DEFAULT_TEXT_FILE_ENCODING })
    const reader = new TomlReader()
    reader.readToml(content)

    const a = reader.result
    if (!('template' in a)) {
      throw new ContractMissingFieldError('template')
    }
    if (!('source' in a.template)) {
      throw new ContractMissingFieldError('template.source')
    }
    if (!('counterparties' in a)) {
      throw new ContractMissingFieldError('counterparties')
    }
    if (!Array.isArray(a.counterparties)) {
      throw new ContractFormatError('Expected "counterparties" field to be an array')
    }
    const templateOpts: TemplateLoadOptions = {
      contractFilename: filename,
      gitRepoCachePath: opts ? opts.gitRepoCachePath : DEFAULT_GIT_REPO_CACHE_PATH,
      format: 'format' in a.template ? templateFormatFromString(a.template.format) : undefined,
      customDelimiters: 'delimiters' in a.template ? templateDelimeters(a.template.delimiters) : undefined,
      cache: opts ? opts.cache : undefined,
    }
    const contract = new Contract()
    contract.filename = filename
    contract.raw = content
    contract.template = await Template.load(a.template.source, templateOpts)
    a.counterparties.forEach((cid: string) => {
      if (!(cid in a)) {
        throw new ContractMissingFieldError(cid)
      }
      contract.counterparties.set(cid, Counterparty.fromContract(cid, a))
    })
    contract.params = a
    return contract
  }

  static async createNew(filename: string, opts: ContractCreateOptions) {
    let vars = new Map<string, any>()
    let counterparties: string[] = []
    if (opts) {
      if (opts.counterparties) {
        counterparties = opts.counterparties
      }
      if (opts.template) {
        const template = await Template.load(opts.template, {
          contractFilename: filename,
          gitRepoCachePath: opts.gitRepoCachePath,
          cache: opts.cache,
        })
        const templateVars = new Map<string, any>()
        templateVars.set('source', path.resolve(opts.template))
        if (opts.templateFormat) {
          templateVars.set('format', templateFormatToString(opts.templateFormat))
        }
        // extract the variables from the template
        vars = template.getVariables()
        vars.set('template', templateVars)
      }
    }
    // ensure we've got our counterparties and template variable
    vars.set('counterparties', counterparties)
    await writeTOMLFileAsync(filename, templateVarsToObj(vars))
    logger.info(`Created new contract: ${filename}`)
  }
}
