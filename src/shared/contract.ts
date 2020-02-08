import { TomlReader } from '@sgarciac/bombadil'
import * as Handlebars from 'handlebars'
import * as tmp from 'tmp'
import * as path from 'path'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_PDF_FONT, DEFAULT_PDF_ENGINE } from './constants'
import { isGitURL } from './git-url'
import { statAsync, readFileAsync, writeFileAsync, spawnAsync, copyFileAsync, readdirAsync, fileExistsAsync } from './async-io'
import { DocumentCache } from './document-cache'
import { logger } from './logging'
import axios from 'axios'
import { extractTemplateVariables, templateVarsToObj, initialsImageName, fullSigImageName } from './template-helpers'
import { writeTOMLFileAsync } from './toml'
import { TemplateError, ContractMissingFieldError, ContractFormatError } from './errors'
import { Counterparty, Signatory } from './counterparties'
import { Identity } from './identities'

/**
 * A contract template. Uses Mustache for template rendering.
 */
export class Template {
  // This template's source
  private src: string

  // The raw Mustache content of the template
  private content: string

  constructor(src: string, content?: string) {
    this.src = src
    this.content = content ? content : ''
  }

  getSource(): string {
    return this.src
  }

  getContent(): string {
    return this.content
  }

  getVariables(): Map<string, any> {
    return extractTemplateVariables(this.content)
  }

  /**
   * Automatically determines the nature of the given source and tries to load a
   * template from there.
   * @param {string} src The source from which to load a template.
   * @param {DocumentCache} cache For remote templates, optionally cache them
   *   here.
   * @returns {Template} A template, if one can be successfully loaded.
   */
  static async load(src: string, cache?: DocumentCache): Promise<Template> {
    try {
      if ((await statAsync(src)).isFile()) {
        return Template.loadFromFile(src)
      }
    } catch (error) {
      // ignore any errors, just try load from a remote
    }
    // try to load it as a remote
    return Template.loadFromRemote(src, cache)
  }

  static async loadFromFile(filename: string, encoding?: string): Promise<Template> {
    logger.debug(`Attempting to load template as file: ${filename}`)
    const content = await readFileAsync(filename, { encoding: encoding ? encoding : DEFAULT_TEXT_FILE_ENCODING })
    return new Template(filename, content)
  }

  static async loadFromRemote(url: string, cache?: DocumentCache): Promise<Template> {
    if (isGitURL(url)) {
      throw new TemplateError('Loading templates from Git repositories is not yet supported')
    }
    return Template.loadFromURL(url, cache)
  }

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
    const template = new Template(url, res.data)
    if (cache) {
      await cache.add(url, template.getContent())
    }
    return template
  }

  // Renders this template to a string using the specified parameters.
  render(params: any, signatureImages: Map<string, string>): string {
    Handlebars.registerHelper('signature', (counterpartyID, signatoryID) => {
      logger.debug(`Looking up image for ${counterpartyID}.${signatoryID}`)
      const imgSrc = signatureImages.get(initialsImageName(counterpartyID, signatoryID))
      return imgSrc ? `<img src="${imgSrc}">` : ''
    })
    Handlebars.registerHelper('initials', (counterpartyID, signatoryID) => {
      const imgSrc = signatureImages.get(fullSigImageName(counterpartyID, signatoryID))
      return imgSrc ? `<img src="${imgSrc}">` : ''
    })
    return Handlebars.compile(this.content)(params)
  }
}

export type ContractCreateOptions = {
  template?: string;
  force?: boolean;
  cache?: DocumentCache;
  counterparties?: string[];
}

/**
 * A contract is effectively a configuration file that describes:
 *
 *   1. A template (Mustache)
 *   2. Counterparties (including signatories)
 *   3. Parameters to use to fill in the contract template
 */
export class Contract {
  template: Template

  counterparties = new Map<string, Counterparty>()

  params: any = {}

  constructor(template: Template, counterparties?: Map<string, Counterparty>, params?: any) {
    this.template = template
    if (counterparties) {
      this.counterparties = counterparties
    }
    if (params) {
      this.params = params
    }
  }

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

  async compile(inputFile: string, outputFile: string, style: any) {
    const inputPathParsed = path.parse(inputFile)
    // render the template to a temporary directory
    const tmpContract = tmp.fileSync({ postfix: '.html' })
    const sigImages = await this.lookupSignatureImages(path.resolve(inputPathParsed.dir))
    try {
      const renderedTemplate = this.template.render(this.params, sigImages)
      await writeFileAsync(
        tmpContract.name,
        renderedTemplate,
      )
      logger.debug(`Wrote contract to temporary file: ${tmpContract.name}`)
      logger.debug(`Wrote rendered template:\n${renderedTemplate}`)

      logger.info('Generating PDF...')
      const pandocArgs = this.buildPandocArgs(tmpContract.name, outputFile, style)
      logger.debug(`Using pandoc args: ${pandocArgs}`)
      const pandoc = await spawnAsync(
        'pandoc',
        pandocArgs,
      )
      logger.debug(`pandoc stdout:\n${pandoc.stdout}`)
      logger.debug(`pandoc stderr:\n${pandoc.stderr}`)
      if (pandoc.status !== null && pandoc.status !== 0) {
        logger.error(`pandoc failed with status: ${pandoc.status}`)
      } else {
        logger.info(`Successfully generated PDF: ${outputFile}`)
      }
    } finally {
      // ensure we clean up the temporary file
      tmpContract.removeCallback()
    }
  }

  async sign(contractPath: string, counterparty: Counterparty, signatory: Signatory, identity: Identity) {
    if (!identity.sigInitials) {
      throw new Error('Identity does not have an initials signature file')
    }
    if (!identity.sigFull) {
      throw new Error('Identity does not have a full signature file')
    }
    const parentPath = path.parse(contractPath).dir
    const parsedSigInitials = path.parse(identity.sigInitials)
    const parsedSigFull = path.parse(identity.sigFull)

    const destSigInitials = path.join(parentPath, `${initialsImageName(counterparty.id, signatory.id)}${parsedSigInitials.ext}`)
    await copyFileAsync(identity.sigInitials, destSigInitials)
    logger.debug(`Copied identity signature initials to: ${destSigInitials}`)

    const destSigFull = path.join(parentPath, `${fullSigImageName(counterparty.id, signatory.id)}${parsedSigFull.ext}`)
    await copyFileAsync(identity.sigInitials, destSigFull)
    logger.debug(`Copied identity full signature to: ${destSigFull}`)

    logger.info(`Signed contract ${contractPath} as ${signatory.fullNames} on behalf of ${counterparty.fullName} using identity "${identity.id}"`)
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

  static async fromAny(a: any, cache?: DocumentCache): Promise<Contract> {
    if (!('template' in a)) {
      throw new ContractMissingFieldError('template')
    }
    if (!('counterparties' in a)) {
      throw new ContractMissingFieldError('counterparties')
    }
    if (!Array.isArray(a.counterparties)) {
      throw new ContractFormatError('Expected "counterparties" field to be an array')
    }
    const template = await Template.load(a.template, cache)
    const counterparties = new Map<string, Counterparty>()
    a.counterparties.forEach((cid: string) => {
      if (!(cid in a)) {
        throw new ContractMissingFieldError(cid)
      }
      counterparties.set(cid, Counterparty.fromContract(cid, a))
    })
    return new Contract(template, counterparties, a)
  }

  static async fromFile(filename: string, cache?: DocumentCache): Promise<Contract> {
    const content = await readFileAsync(filename, { encoding: DEFAULT_TEXT_FILE_ENCODING })
    const reader = new TomlReader()
    reader.readToml(content)
    return Contract.fromAny(reader.result, cache)
  }

  static async createNew(filename: string, opts?: ContractCreateOptions) {
    let vars = new Map<string, any>()
    let counterparties: string[] = []
    if (opts) {
      if (opts.counterparties) {
        counterparties = opts.counterparties
      }
      if (opts.template) {
        const template = await Template.load(opts.template, opts.cache)
        // extract the variables from the template
        vars = template.getVariables()
        vars.set('template', opts.template)
      }
    }
    // ensure we've got our counterparties and template variable
    vars.set('counterparties', counterparties)
    await writeTOMLFileAsync(filename, templateVarsToObj(vars))
    logger.info(`Created new contract: ${filename}`)
  }
}
