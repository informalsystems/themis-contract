import { TomlReader } from '@sgarciac/bombadil'
import * as Handlebars from 'handlebars'
import * as tmp from 'tmp'
import { spawnSync } from 'child_process'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_PDF_FONT, DEFAULT_PDF_ENGINE } from './constants'
import { isGitURL } from './git-url'
import { statAsync, readFileAsync, writeFileAsync } from './async-io'
import { DocumentCache } from './document-cache'
import { logger } from './logging'
import axios from 'axios'
import { extractTemplateVariables } from './template-helpers'

export class ContractFormatError extends Error { }

export class ContractMissingFieldError extends ContractFormatError {
  constructor(fieldName: string) {
    super(`Missing field in contract: "${fieldName}"`)
  }
}

export class SignatoryMissingFieldError extends ContractFormatError {
  constructor(counterpartyId: string, signatoryId: string, fieldName: string) {
    super(`Signatory "${signatoryId}" for counterparty "${counterpartyId}" is missing field "${fieldName}"`)
  }
}

export class CounterpartyMissingFieldError extends ContractFormatError {
  constructor(counterpartyId: string, fieldName: string) {
    super(`Counterparty "${counterpartyId}" is missing field "${fieldName}"`)
  }
}

export class Signatory {
  id: string

  fullNames: string

  keybaseId?: string

  constructor(id: string, fullNames: string, keybaseId?: string) {
    this.id = id
    this.fullNames = fullNames
    this.keybaseId = keybaseId
  }

  static fromAny(counterpartyId: string, signatoryId: string, a: any): Signatory {
    if (!(signatoryId in a)) {
      throw new ContractFormatError(`Missing section for signatory "${signatoryId}" of counterparty "${counterpartyId}"`)
    }
    if (!('full_names' in a[signatoryId])) {
      throw new SignatoryMissingFieldError(counterpartyId, signatoryId, 'full_names')
    }
    let keybaseId: string | undefined
    if ('keybase_id' in a[signatoryId]) {
      keybaseId = a[signatoryId].keybase_id
    }
    return new Signatory(signatoryId, a[signatoryId].full_names, keybaseId)
  }
}

export class Counterparty {
  /** A unique identifier for this counterparty. */
  id: string

  /** The full name of this counterparty. */
  fullName: string

  /** One or more signatories for this counterparty. */
  signatories: Signatory[]

  constructor(id: string, fullName: string, signatories: Signatory[]) {
    this.id = id
    this.fullName = fullName
    this.signatories = signatories
  }

  static fromAny(id: string, a: any): Counterparty {
    if (!(id in a)) {
      throw new ContractFormatError(`Missing section for counterparty "${id}"`)
    }
    if (!('full_name' in a[id])) {
      throw new CounterpartyMissingFieldError(id, 'full_name')
    }
    if (!('signatories' in a[id])) {
      throw new CounterpartyMissingFieldError(id, 'signatories')
    }
    if (!Array.isArray(a[id].signatories)) {
      throw new ContractFormatError(`Expected "signatories" field for counterparty "${id}" to be an array`)
    }
    if (a[id].signatories.length === 0) {
      throw new ContractFormatError(`Expected at least one signatory for counterparty "${id}"`)
    }
    return new Counterparty(
      id,
      a[id].full_name,
      a[id].signatories.map((sigId: string) => Signatory.fromAny(id, sigId, a)),
    )
  }
}

export class TemplateError extends Error { }

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
  render(params: any): string {
    return Handlebars.compile(this.content)(params)
  }
}

export type ContractCreateOptions = {
  template?: string;
  force?: boolean;
  cache?: DocumentCache;
}

/**
 * A contract is effectively a configuration file that describes:
 *
 *   1. A template (Mustache)
 *   2. Counterparties (including signatories)
 *   3. Parameters to use to fill in the contract template
 */
export class Contract {
  private template: Template

  private counterparties: Counterparty[]

  private params: any

  constructor(template: Template, counterparties: Counterparty[], params: any) {
    this.template = template
    this.counterparties = counterparties
    this.params = params
  }

  async compile(outputFile: string, style: any) {
    // render the template to a temporary directory
    const tmpContract = tmp.fileSync({ postfix: '.html' })
    try {
      await writeFileAsync(
        tmpContract.name,
        this.template.render(this.params),
      )
      logger.debug(`Wrote contract to temporary file: ${tmpContract.name}`)

      logger.info('Generating PDF...')
      const pandocArgs = this.buildPandocArgs(tmpContract.name, outputFile, style)
      logger.debug(`Using pandoc args: ${pandocArgs}`)
      const pandoc = spawnSync(
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
    return new Contract(template, a.counterparties, a)
  }

  static async fromFile(filename: string, cache?: DocumentCache): Promise<Contract> {
    const content = await readFileAsync(filename, { encoding: DEFAULT_TEXT_FILE_ENCODING })
    const reader = new TomlReader()
    reader.readToml(content)
    return Contract.fromAny(reader.result, cache)
  }

  static async createNew(filename: string, opts?: ContractCreateOptions) {
    logger.info(`This should create a contract at: ${filename} (opts: ${opts})`)
  }
}
