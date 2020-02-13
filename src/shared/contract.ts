import { TomlReader } from '@sgarciac/bombadil'
import * as Handlebars from 'handlebars'
import * as tmp from 'tmp'
import * as path from 'path'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_PDF_FONT, DEFAULT_PDF_ENGINE, DEFAULT_TEMPLATE_EXT, DEFAULT_GIT_REPO_CACHE_PATH } from './constants'
import { isGitURL } from './git-url'
import { readFileAsync, writeFileAsync, spawnAsync, copyFileAsync, readdirAsync, fileExistsAsync } from './async-io'
import { DocumentCache } from './document-cache'
import { logger } from './logging'
import axios from 'axios'
import { extractTemplateVariables, templateVarsToObj, initialsImageName, fullSigImageName, hasSignedMustacheHelper } from './template-helpers'
import { writeTOMLFileAsync } from './toml'
import { TemplateError, ContractMissingFieldError, ContractFormatError } from './errors'
import { Counterparty, Signatory } from './counterparties'
import { Identity } from './identities'
// import * as Git from 'nodegit'
import * as mime from 'mime-types'
import { URL } from 'url'
import { keybaseSign, keybaseSigFilename } from './keybase-helpers'

export type TemplateLoadOptions = {
  contractFilename: string;
  gitRepoCachePath: string;
  cache?: DocumentCache;
}

/**
 * A contract template. Uses Mustache for template rendering.
 */
export class Template {
  /** This template's source. */
  src: string

  /** The raw Mustache content of the template. */
  content: string

  /** The file extension to use for this template. */
  ext?: string

  constructor(src: string, content?: string, ext?: string) {
    this.src = src
    this.content = content ? content : ''
    if (ext) {
      this.ext = ext
    }
  }

  getVariables(): Map<string, any> {
    return extractTemplateVariables(this.content)
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
    return Template.loadFromFile(filename)
  }

  static async loadFromFile(filename: string, encoding?: string): Promise<Template> {
    logger.debug(`Attempting to load template as file: ${filename}`)
    const content = await readFileAsync(filename, { encoding: encoding ? encoding : DEFAULT_TEXT_FILE_ENCODING })
    const parsedFilename = path.parse(filename)
    return new Template(filename, content, parsedFilename.ext)
  }

  static async loadFromRemote(url: string, opts?: TemplateLoadOptions): Promise<Template> {
    const gitRepoCachePath = opts ? opts.gitRepoCachePath : DEFAULT_GIT_REPO_CACHE_PATH
    const cache = opts ? opts.cache : undefined
    if (isGitURL(url)) {
      // return Template.loadFromGit(url, gitRepoCachePath, cache)
      throw new Error(`Git repository remotes are not yet supported (${gitRepoCachePath})`)
    }
    return Template.loadFromURL(url, cache)
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

  static async loadFromURL(url: string, cache?: DocumentCache): Promise<Template> {
    logger.debug(`Attempting to load template from remote URL: ${url}`)
    if (cache) {
      // check if we can load the document from cache
      const cachedContent = await cache.getContent(url)
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
    const template = new Template(url, res.data, ext)
    if (cache) {
      await cache.add(url, template.content)
    }
    return template
  }

  // Renders this template to a string using the specified parameters.
  render(params: any): string {
    Handlebars.registerHelper('has_signed', hasSignedMustacheHelper)
    return Handlebars.compile(this.content)(params)
  }
}

export type ContractCreateOptions = {
  gitRepoCachePath: string;
  template?: string;
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
    const inputPathParsed = path.parse(inputFile)
    const sigImages = await this.lookupSignatureImages(path.resolve(inputPathParsed.dir))

    // ensure counterparties are populated fully
    this.params.counterparties = {}
    this.counterparties.forEach(counterparty => {
      this.params.counterparties[counterparty.id] = counterparty.toTemplateVar(sigImages)
      if (counterparty.id in this.params) {
        this.params[counterparty.id] = this.params.counterparties[counterparty.id]
      }
    })
  }

  async compile(outputFile: string, style: any) {
    if (!this.filename) {
      throw new Error('Missing filename for contract')
    }
    if (!this.template) {
      throw new Error('Missing template for contract')
    }
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
    if (opts.useKeybase) {
      await this.signWithKeybase(opts)
    } else {
      await this.signWithoutKeybase(opts)
    }
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
    if (!opts.identity.sigFull || !opts.identity.sigInitials || !this.filename) {
      return
    }
    const parentPath = path.parse(this.filename).dir
    const parsedSigInitials = path.parse(opts.identity.sigInitials)
    const parsedSigFull = path.parse(opts.identity.sigFull)

    const destSigInitials = path.join(parentPath, `${initialsImageName(opts.counterparty.id, opts.signatory.id)}${parsedSigInitials.ext}`)
    await copyFileAsync(opts.identity.sigInitials, destSigInitials)
    logger.debug(`Copied identity signature initials to: ${destSigInitials}`)

    const destSigFull = path.join(parentPath, `${fullSigImageName(opts.counterparty.id, opts.signatory.id)}${parsedSigFull.ext}`)
    await copyFileAsync(opts.identity.sigInitials, destSigFull)
    logger.debug(`Copied identity full signature to: ${destSigFull}`)

    logger.info(`Signed contract ${this.filename} as ${opts.signatory.fullNames} on behalf of ${opts.counterparty.fullName} using identity "${opts.identity.id}"`)
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

  static async fromAny(filename: string, raw: string, a: any, opts?: ContractLoadOptions): Promise<Contract> {
    if (!('template' in a)) {
      throw new ContractMissingFieldError('template')
    }
    if (!('counterparties' in a)) {
      throw new ContractMissingFieldError('counterparties')
    }
    if (!Array.isArray(a.counterparties)) {
      throw new ContractFormatError('Expected "counterparties" field to be an array')
    }
    const contract = new Contract()
    contract.filename = filename
    contract.raw = raw
    contract.template = await Template.load(a.template, {
      contractFilename: filename,
      gitRepoCachePath: opts ? opts.gitRepoCachePath : DEFAULT_GIT_REPO_CACHE_PATH,
      cache: opts ? opts.cache : undefined,
    })
    a.counterparties.forEach((cid: string) => {
      if (!(cid in a)) {
        throw new ContractMissingFieldError(cid)
      }
      contract.counterparties.set(cid, Counterparty.fromContract(cid, a))
    })
    contract.params = a
    return contract
  }

  static async fromFile(filename: string, opts?: ContractLoadOptions): Promise<Contract> {
    const content = await readFileAsync(filename, { encoding: DEFAULT_TEXT_FILE_ENCODING })
    const reader = new TomlReader()
    reader.readToml(content)
    return Contract.fromAny(filename, content, reader.result, opts)
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
        // extract the variables from the template
        vars = template.getVariables()
        vars.set('template', template.src)
      }
    }
    // ensure we've got our counterparties and template variable
    vars.set('counterparties', counterparties)
    await writeTOMLFileAsync(filename, templateVarsToObj(vars))
    logger.info(`Created new contract: ${filename}`)
  }
}
