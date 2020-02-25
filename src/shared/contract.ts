import { TomlReader } from '@sgarciac/bombadil'
import * as Handlebars from 'handlebars'
import * as tmp from 'tmp'
import * as path from 'path'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_PDF_FONT, DEFAULT_PDF_ENGINE, DEFAULT_TEMPLATE_EXT, DEFAULT_GIT_REPO_CACHE_PATH, RESERVED_TEMPLATE_VARS } from './constants'
import { isGitURL, GitURL } from './git-url'
import { readFileAsync, writeFileAsync, spawnAsync, copyFileAsync, readdirAsync, fileExistsAsync, writeGMAsync, dirExistsAsync } from './async-io'
import { DocumentCache, computeCacheFilename, computeContentHash } from './document-cache'
import { logger } from './logging'
import axios from 'axios'
import { extractHandlebarsTemplateVariables, extractMustacheTemplateVariables, templateVarsToObj, initialsImageName, fullSigImageName, sigFileName } from './template-helpers'
import { writeTOMLFileAsync } from './toml'
import { TemplateError, ContractMissingFieldError, ContractFormatError } from './errors'
import { Counterparty, Signatory, mergeParams } from './counterparties'
import { Identity } from './identities'
import * as mime from 'mime-types'
import { URL } from 'url'
import { keybaseSign, keybaseSigFilename, keybaseVerifySignature } from './keybase-helpers'
import * as crypto from 'crypto'
import * as gm from 'gm'
import * as Mustache from 'mustache'
import { gitPullAll, gitClone, gitCheckout } from './git-helpers'
import { generateCryptographicSigImages } from './barcode-helpers'
import { getSignatureTimestamp } from './crypto-helpers'

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

const stripReservedTemplateVars = (vars: Map<string, any>): Map<string, any> => {
  for (const v of RESERVED_TEMPLATE_VARS) {
    vars.delete(v)
  }
  return vars
}

export type TemplateLoadOptions = {
  contractFilename: string;
  gitRepoCachePath: string;
  format?: TemplateFormat;
  customDelimiters?: string[];
  cache?: DocumentCache;
  encoding?: string;
  expectedContentHash?: string;
}

/**
 * A contract template.
 */
export class Template {
  /** This template's source. */
  src: string

  /** The raw Mustache/Handlebars content of the template. */
  content: string

  /** Cryptographic hash of the content (SHA256 in our case). */
  contentHash: string

  /** The file extension to use for this template. */
  ext?: string

  /** Which template engine should we use? */
  format = TemplateFormat.Handlebars

  /** Custom delimiters (for Mustache templates only). */
  customDelimiters?: string[]

  constructor(src: string, content: string) {
    this.src = src
    this.content = content
    this.contentHash = computeContentHash(content)
  }

  validateContentHash(expectedHash: string) {
    if (this.contentHash !== expectedHash) {
      throw new Error(`Template hash mismatch. Expected ${expectedHash}, but got ${this.contentHash}`)
    }
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
    let template: Template
    if (src.indexOf('://') > -1) {
      template = await Template.loadFromRemote(src, opts)
    } else {
      let filename = src
      if (!path.isAbsolute(filename)) {
        if (opts) {
          filename = path.resolve(path.parse(opts.contractFilename).dir, filename)
        } else {
          throw new Error('If template path is relative, the full contract filename must be supplied')
        }
      }
      template = await Template.loadFromFile(filename, opts)
    }
    if (opts && opts.expectedContentHash) {
      template.validateContentHash(opts.expectedContentHash)
    }
    return template
  }

  private static async loadFromFile(filename: string, opts?: TemplateLoadOptions): Promise<Template> {
    const resolvedFilename = path.resolve(filename)
    logger.debug(`Attempting to load template as file: ${resolvedFilename}`)
    const content = await readFileAsync(resolvedFilename, { encoding: (opts && opts.encoding) ? opts.encoding : DEFAULT_TEXT_FILE_ENCODING })
    const parsedFilename = path.parse(resolvedFilename)
    const template = new Template(resolvedFilename, content)
    template.ext = parsedFilename.ext
    template.format = (opts && opts.format) ? opts.format : template.format
    template.customDelimiters = (opts && opts.customDelimiters) ? opts.customDelimiters : template.customDelimiters
    return template
  }

  private static async loadFromRemote(url: string, opts?: TemplateLoadOptions): Promise<Template> {
    if (opts && opts.cache) {
      const cachedMeta = opts.cache.getMeta(url)
      if (cachedMeta !== null) {
        const format = templateFormatFromString(cachedMeta.format)
        const ext: string = cachedMeta.ext
        // check if we can load the document from cache
        const cachedContent = await opts.cache.getContent(url)
        if (cachedContent !== null) {
          logger.debug(`Found template in cache: ${url}`)
          const template = new Template(url, cachedContent)
          template.format = format
          template.ext = ext
          return template
        }
        throw new Error(`Cached template had metadata, but could not load it from the filesystem: ${url}`)
      }
    }
    if (isGitURL(url)) {
      return Template.loadFromGit(url, opts)
    }
    return Template.loadFromURL(url, opts)
  }

  private static async loadFromGit(url: string, opts?: TemplateLoadOptions): Promise<Template> {
    logger.info(`Attempting to load template from Git repository: ${url}`)
    const gitRepoCachePath = opts ? opts.gitRepoCachePath : DEFAULT_GIT_REPO_CACHE_PATH
    const gitURL = GitURL.parse(url)
    if (gitURL.innerPath() === '') {
      throw new Error(`Missing file path in Git repository URL: ${url}`)
    }

    const repoIDHash = computeCacheFilename(gitURL.repository())
    const repoLocalPath = path.join(gitRepoCachePath, repoIDHash)
    logger.debug(`Parsed Git repository as: ${gitURL.repository()}`)
    logger.debug(`Using local repository path: ${repoLocalPath}`)

    // if we've cloned this repo before
    if (await dirExistsAsync(repoLocalPath)) {
      logger.debug('Local repository exists. Updating...')
      await gitPullAll(repoLocalPath)
    } else {
      logger.debug('Local repository does not exist. Cloning...')
      await gitClone(gitURL.repository(), repoLocalPath)
    }
    const ref = gitURL.hash.length > 0 ? gitURL.hash : 'master'
    logger.debug(`Checking out ref: ${ref}`)
    await gitCheckout(repoLocalPath, ref)

    const templatePath = path.join(repoLocalPath, ...gitURL.innerPath().split('/'))
    if (!(await fileExistsAsync(templatePath))) {
      throw new Error(`Cannot find template in Git repository: ${templatePath}`)
    }
    const templateContent = await readFileAsync(
      templatePath,
      { encoding: (opts && opts.encoding) ? opts.encoding : DEFAULT_TEXT_FILE_ENCODING },
    )
    const parsedTemplatePath = path.parse(templatePath)
    const template = new Template(url, templateContent)
    template.ext = parsedTemplatePath.ext
    template.format = (opts && opts.format) ? opts.format : template.format
    template.customDelimiters = (opts && opts.customDelimiters) ? opts.customDelimiters : template.customDelimiters
    if (opts && opts.cache) {
      await opts.cache.add(url, template.content, {format: templateFormatToString(template.format), ext: template.ext})
    }
    return template
  }

  private static async loadFromURL(url: string, opts?: TemplateLoadOptions): Promise<Template> {
    logger.info(`Attempting to load template from remote URL: ${url}`)
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
      await opts.cache.add(url, template.content, {format: templateFormatToString(template.format), ext: template.ext})
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
  customDelimiters?: string[];
  counterparties?: Map<string, Counterparty>;
}

export type ContractLoadOptions = {
  gitRepoCachePath: string;
  cache?: DocumentCache;
}

export type ContractCompileOptions = {
  style?: any;
  verify?: boolean;
}

export type ContractSignOptions = {
  counterparty: Counterparty;
  signatory: Signatory;
  identity: Identity;
  useKeybase: boolean;
  signatureFont?: string;
}

export type ContractVerificationOptions = {
  useKeybase: boolean;
}

export type SignatureInfo = {
  filename: string;
  counterparty: Counterparty;
  signatory: Signatory;
  expectedKeybaseID: string;
}

export type ContractSigImageGenerationOptions = {
  overwriteExisting?: boolean;
  verify?: boolean;
  font?: string;
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

  /** Hex digest containing the hash of the contract. */
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

  private async lookupSignatureProperties(basePath: string): Promise<Map<string, string>> {
    const entries = await readdirAsync(basePath)
    const files = new Map<string, string>()
    for (const entry of entries) {
      const fullPath = path.join(basePath, entry)
      if (await fileExistsAsync(fullPath, true)) {
        const parsedPath = path.parse(fullPath)
        const nameParts = parsedPath.name.split('__')
        if (nameParts.length < 2 || nameParts.length > 3) {
          continue
        }
        const counterpartyID = nameParts[0]
        const signatoryID = nameParts[1]
        const counterparty = this.counterparties.get(counterpartyID)
        if (!counterparty) {
          continue
        }
        const signatory = counterparty.signatories.get(signatoryID)
        if (!signatory) {
          continue
        }
        // if this is potentially a signature
        if (nameParts.length === 2) {
          if (parsedPath.ext !== '.sig') {
            continue
          }
          files.set(`${parsedPath.name}`, fullPath)
          files.set(`${parsedPath.name}__signed_date`, (await getSignatureTimestamp(fullPath)).format('Do MMMM YYYY'))
          logger.debug(`Found cryptographic signature ${parsedPath.name} at: ${fullPath}`)
        }
        const sigType = nameParts[2]
        if (sigType === 'initials' || sigType === 'full') {
          files.set(parsedPath.name, fullPath)
          logger.debug(`Found signature image ${parsedPath.name} at: ${fullPath}`)
        }
      }
    }
    return files
  }

  private async prepareTemplateParams(inputFile: string) {
    if (!this.hash) {
      throw new Error('Internal error: no hash of contract')
    }
    const inputPathParsed = path.parse(inputFile)
    const sigProps = await this.lookupSignatureProperties(path.resolve(inputPathParsed.dir))

    this.params.hash = this.hash
    // ensure counterparties are populated fully
    this.params.counterparties = {}
    this.params.counterparties_list = []
    this.counterparties.forEach(counterparty => {
      const cvar = counterparty.toTemplateVar(sigProps)
      this.params.counterparties[counterparty.id] = cvar
      this.params.counterparties_list.push(cvar)
      if (counterparty.id in this.params) {
        this.params[counterparty.id] = cvar
      }
    })
    // additional useful parameters
    this.params.contract_path = inputPathParsed.dir
  }

  async compile(outputFile: string, opts?: ContractCompileOptions) {
    if (!this.filename) {
      throw new Error('Missing filename for contract')
    }
    if (!this.template) {
      throw new Error('Missing template for contract')
    }
    this.computeHash()
    await this.prepareTemplateParams(this.filename)
    if (opts && opts.verify) {
      await this.verify({
        useKeybase: true,
      })
    }

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
        await this.compileWithPandoc(tmpContract.name, outputFile, opts && opts.style ? opts.style : {})
      }
      logger.info(`Saved output PDF file: ${outputFile}`)
    } finally {
      // ensure we clean up the temporary file
      tmpContract.removeCallback()
    }
  }

  async sign(opts: ContractSignOptions) {
    this.computeHash()
    if (opts.useKeybase) {
      await this.signWithKeybase(opts)
    } else {
      await this.signWithoutKeybase(opts)
    }
  }

  /**
   * Verifies all signatures associated with this contract.
   * @param {ContractValiationOptions} opts Options for validating this contract.
   */
  async verify(opts: ContractVerificationOptions) {
    if (!this.filename) {
      throw new Error('Missing filename for contract')
    }
    if (!opts.useKeybase) {
      throw new Error('Only contracts signed using Keybase can be validated')
    }

    logger.info(`Attempting to verify contract: ${this.filename}`)

    const parsedFilename = path.parse(path.resolve(this.filename))
    const sigProps = await this.lookupSignatureProperties(parsedFilename.dir)
    let errors = 0
    let expectedSigs = 0
    const sigsToVerify: SignatureInfo[] = []

    this.counterparties.forEach(c => {
      c.signatories.forEach(s => {
        expectedSigs++
        const sigFile = sigProps.get(sigFileName(c.id, s.id))
        if (!sigFile) {
          logger.error(`(${errors + 1}) Missing signature for signatory "${s.fullNames}" of counterparty "${c.fullName}"`)
          errors++
          return
        }
        if (!s.keybaseId) {
          logger.error(`(${errors + 1}) Missing Keybase ID for signatory "${s.fullNames}" of counterparty "${c.fullName}"`)
          errors++
          return
        }
        sigsToVerify.push({
          filename: sigFile,
          counterparty: c,
          signatory: s,
          expectedKeybaseID: s.keybaseId,
        })
      })
    })
    if (expectedSigs === 0) {
      logger.error(`(${errors + 1}) No signatories for contract - cannot verify it`)
      errors++
    }
    for (const sig of sigsToVerify) {
      try {
        await keybaseVerifySignature(this.filename, sig.filename, sig.expectedKeybaseID)
        logger.info(`Successfully verified signature for signatory "${sig.signatory.fullNames}" of counterparty "${sig.counterparty.fullName}"`)
      } catch (error) {
        logger.error(`(${errors + 1}) Verification failed for signatory "${sig.signatory.fullNames}" of counterparty "${sig.counterparty.fullName}"`)
        errors++
      }
    }
    if (errors > 0) {
      throw new Error(`Found ${errors} error${errors === 1 ? '' : 's'} while verifying contract`)
    }
    logger.info('Successfully verified all required signatures on contract')
  }

  /**
   * Allows us to generate signature images for cryptographic signatures.
   * @param {ContractSigImageGenerationOptions} opts Configuration options.
   */
  async generateSigImages(opts?: ContractSigImageGenerationOptions) {
    if (opts && opts.verify) {
      await this.verify({useKeybase: true})
    }
    if (!this.filename) {
      throw new Error('Internal error: missing filename for contract')
    }
    const inputPathParsed = path.parse(this.filename)
    const sigProps = await this.lookupSignatureProperties(path.resolve(inputPathParsed.dir))

    for (const [key, filename] of sigProps) {
      const keyParts = key.split('__')
      if (keyParts.length !== 2) {
        continue
      }
      const counterparty = this.counterparties.get(keyParts[0])
      if (!counterparty) {
        continue
      }
      const signatory = counterparty.signatories.get(keyParts[1])
      if (!signatory) {
        continue
      }
      // should we produce a signature image for this signature file?
      if (!sigProps.has(`${key}__full`) || (opts && opts.overwriteExisting)) {
        const parsedPath = path.parse(filename)
        await generateCryptographicSigImages(filename, parsedPath.dir, {
          counterparty: counterparty,
          signatory: signatory,
          font: opts && opts.font ? opts.font : undefined,
        })
      } else {
        logger.info(`Not updating signature images for: ${filename} (use --overwrite to overwrite this signature's images)`)
      }
    }
  }

  private computeHash() {
    if (!this.raw || !this.template) {
      throw new Error('Internal error: missing fields in contract to be able to compute hash')
    }
    const hash = crypto.createHash('sha256')
    // we only compute the hash from the raw contract data, since the hash of
    // the template should be embedded in the raw contract data
    hash.update(this.raw)
    this.hash = hash.digest('hex').toLowerCase()
    logger.info(`SHA256 hash of contract: ${this.hash}`)
  }

  private async signWithKeybase(opts: ContractSignOptions) {
    if (!opts.identity.keybaseID) {
      throw new Error(`Identity "${opts.identity.id}" is missing a Keybase ID`)
    }
    if (!opts.identity.keybaseKeyID) {
      throw new Error(`Identity "${opts.identity.id}" is missing a Keybase key ID`)
    }
    if (!this.filename || !this.template || !this.hash) {
      return
    }
    const parentPath = path.parse(this.filename).dir
    const tmpDir = tmp.dirSync()
    const keybaseSigFile = keybaseSigFilename(parentPath, opts.counterparty, opts.signatory)

    try {
      const tmpContract = path.join(tmpDir.name, 'contract.toml')
      await writeFileAsync(tmpContract, this.raw)
      logger.debug(`Wrote contract to file: ${tmpContract}`)
      logger.info('Using Keybase to sign contract...')
      await keybaseSign(tmpContract, keybaseSigFile, opts.identity.keybaseKeyID)
      logger.info(`Generated signature file: ${keybaseSigFile}`)
    } finally {
      tmpDir.removeCallback()
    }

    await generateCryptographicSigImages(keybaseSigFile, parentPath, {
      counterparty: opts.counterparty,
      signatory: opts.signatory,
      font: opts.signatureFont,
    })
  }

  private async signWithoutKeybase(opts: ContractSignOptions) {
    if (!opts.identity.sigInitials) {
      throw new Error(`Identity "${opts.identity.id}" is missing an initials image`)
    }
    if (!opts.identity.sigFull) {
      throw new Error(`Identity "${opts.identity.id}" is missing a full signature image`)
    }
    if (!this.filename || !this.raw || !this.template) {
      return
    }
    if (!this.hash) {
      throw new Error('Internal error: missing contract hash')
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
        gm(opts.identity.sigFull).resize(400).append(sigHashImage),
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
    if (!('hash' in a.template)) {
      throw new ContractMissingFieldError('template.hash')
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
      expectedContentHash: 'hash' in a.template ? a.template.hash : undefined,
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
    const counterparties = new Map<string, Counterparty>()
    const counterpartyIDs: string[] = []
    if (opts) {
      if (opts.counterparties) {
        opts.counterparties.forEach((c, id) => {
          counterparties.set(id, c)
          counterpartyIDs.push(id)
        })
      }
      if (opts.template) {
        const templateFormat = opts.templateFormat ? opts.templateFormat : undefined
        const template = await Template.load(opts.template, {
          contractFilename: filename,
          gitRepoCachePath: opts.gitRepoCachePath,
          format: templateFormat,
          customDelimiters: opts.customDelimiters,
          cache: opts.cache,
        })
        const templateVars = new Map<string, any>()
        templateVars.set('source', template.src)
        templateVars.set('format', templateFormatToString(template.format))
        templateVars.set('hash', template.contentHash)
        // extract the variables from the template
        vars = template.getVariables()
        vars.set('template', templateVars)
      }
    }
    // ensure we've got our counterparties and template variable
    vars.set('counterparties', counterpartyIDs)
    counterparties.forEach((c, id) => {
      vars.set(id, {
        full_name: c.fullName,
        signatories: c.listSignatories().map(sig => sig.id),
      })
      c.signatories.forEach(s => {
        let st: any = {
          full_names: s.fullNames,
        }
        if (s.keybaseId) {
          st.keybase_id = s.keybaseId
        }
        if (s.additionalParams) {
          st = mergeParams(st, s.additionalParams)
        }
        vars.set(s.id, st)
      })
    })
    const varsObj = templateVarsToObj(stripReservedTemplateVars(vars))
    logger.debug(`Extracted template variables: ${JSON.stringify(varsObj, null, 2)}`)
    await writeTOMLFileAsync(filename, varsObj)
    logger.info(`Created new contract: ${filename}`)
  }
}
