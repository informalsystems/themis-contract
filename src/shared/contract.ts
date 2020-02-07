import { TomlReader } from '@sgarciac/bombadil'
import * as mustache from 'mustache'
import * as tmp from 'tmp'
import { spawnSync } from 'child_process'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_PDF_FONT, DEFAULT_PDF_ENGINE } from './constants'
import { isGitURL } from './git-url'
import * as requestAsync from 'request-promise-native'
import { statAsync, readFileAsync, writeFileAsync } from './async-io'
import { DocumentCache } from './document-cache'
import { logger } from './logging'

// const DEFAULT_FONT = 'Helvetica'
// const DEFAULT_PDF_ENGINE = 'tectonic'

// const DEFAULT_CONTRACT_FILE = 'contract.html'
// const DEFAULT_CONTRACT_TEMPLATE = `<h1>New Contract</h1>
// <p>Created on {{date}}. Start adding your contract content here.</p>`

// const DEFAULT_TMPL = `
// # If you want to reference a specific file
// template = "../icf-grant-template-v1.0.0.html"

// # You could also reference a Git repository
// # template = "git://

// counterparties = [
//   "icf",
//   "company_a"
// ]

// [icf]
// full_name = "Interchain Foundation"
// signatories = [
//   "aflemming",
//   "ebuchman"
// ]

// [aflemming]
// full_names = "Arianne Flemming"
// keybase_id = "aflemming"

// [ebuchman]
// full_names = "Ethan Buchman"
// keybase_id = "ebuchman"
// `

// const DEFAULT_PARAMS_FILE = 'params.toml'
// const DEFAULT_PARAMS = `counterparties = []
// date = "${moment().format('YYYY-MM-DD')}"
// `

// const DEFAULT_STYLE_FILE = 'style.toml'
// const DEFAULT_STYLE = `font = "${DEFAULT_FONT}"
// pdf_engine = "${DEFAULT_PDF_ENGINE}"
// `

// const DEFAULT_ENCODING = 'utf8'

// const forceWriteFileSync = (filename: string, data: string, force?: boolean) => {
//   const exists = fs.existsSync(filename)
//   if (!exists || (exists && force)) {
//     fs.writeFileSync(filename, data)
//     logger.debug(`Wrote output file: ${filename}`)
//   } else {
//     logger.debug(`File already exists and not forcing, so skipping: ${filename}`)
//   }
// }

// const readFileSyncWithDefault = (basePath: string, filename: string, defaultData?: string): string => {
//   const filePath = path.join(basePath, filename)
//   if (!fs.existsSync(filePath)) {
//     if (defaultData) {
//       forceWriteFileSync(filePath, defaultData)
//     }
//   }
//   return fs.readFileSync(filePath, { encoding: DEFAULT_ENCODING })
// }

// const readTomlFileSync = (basePath: string, filename: string, defaultData?: string): any => {
//   const content = readFileSyncWithDefault(basePath, filename, defaultData)
//   const reader = new TomlReader()
//   reader.readToml(content)
//   return reader.result
// }

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
  // The raw Mustache content of the template
  private content: string

  constructor(content?: string) {
    this.content = content ? content : ''
  }

  getContent(): string {
    return this.content
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
    const content = await readFileAsync(filename, { encoding: encoding ? encoding : DEFAULT_TEXT_FILE_ENCODING })
    const template = new Template()
    template.content = content
    return template
  }

  static async loadFromRemote(url: string, cache?: DocumentCache): Promise<Template> {
    if (isGitURL(url)) {
      throw new TemplateError('Loading templates from Git repositories is not yet supported')
    }
    return Template.loadFromURL(url, cache)
  }

  static async loadFromURL(url: string, cache?: DocumentCache): Promise<Template> {
    if (cache) {
      // check if we can load the document from cache
      const cachedContent = await cache.getContent(url)
      if (cachedContent !== null) {
        logger.debug(`Found template in cache: ${url}`)
        return new Template(cachedContent)
      }
    }
    const res = await requestAsync({
      uri: url,
      method: 'GET',
      resolveWithFullResponse: true,
    })
    if (res.statusCode && res.statusCode >= 300) {
      throw new TemplateError(`GET request to ${url} resulted in status code ${res.statusCode}`)
    }
    const template = new Template(res.body)
    if (cache) {
      await cache.add(url, template.getContent())
    }
    return template
  }

  // Renders this template to a string using the specified parameters.
  render(params: any): string {
    return mustache.render(this.content, params)
  }
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

  static async createNew(basePath: string, force?: boolean) {
    logger.info(`This will create a contract in ${basePath} (force=${force})`)
  }
}

// class ContractOld {
//   private template = ''

//   private params: any

//   private style: any

//   static createNew(basePath: string, force?: boolean) {
//     if (!fs.existsSync(basePath)) {
//       fs.mkdirSync(basePath)
//       logger.debug(`Created folder: ${basePath}`)
//     }
//     forceWriteFileSync(path.join(basePath, DEFAULT_CONTRACT_FILE), DEFAULT_CONTRACT_TEMPLATE, force)
//     forceWriteFileSync(path.join(basePath, DEFAULT_PARAMS_FILE), DEFAULT_PARAMS, force)
//     forceWriteFileSync(path.join(basePath, DEFAULT_STYLE_FILE), DEFAULT_STYLE, force)
//     logger.info(`Contract available at ${basePath}`)
//   }

//   static loadFromPath(basePath: string): Contract {
//     const contract = new Contract()
//     contract.template = readFileSyncWithDefault(
//       basePath,
//       DEFAULT_CONTRACT_FILE,
//       DEFAULT_CONTRACT_TEMPLATE,
//     )
//     contract.params = readTomlFileSync(
//       basePath,
//       DEFAULT_PARAMS_FILE,
//       DEFAULT_PARAMS,
//     )
//     contract.style = readTomlFileSync(
//       basePath,
//       DEFAULT_STYLE_FILE,
//       DEFAULT_STYLE,
//     )
//     return contract
//   }

//   compile(outputFile: string) {
//     // render the template to a temporary directory
//     const contractFile = tmp.fileSync({ postfix: '.html' })
//     try {
//       fs.writeFileSync(
//         contractFile.name,
//         mustache.render(this.template, this.params),
//       )
//       logger.debug(`Wrote contract to temporary file: ${contractFile.name}`)

//       logger.info('Generating PDF...')
//       const pandocArgs = this.buildPandocArgs(contractFile.name, outputFile)
//       logger.debug(`Using pandoc args: ${pandocArgs}`)
//       const pandoc = spawnSync(
//         'pandoc',
//         pandocArgs,
//       )
//       logger.debug(`pandoc stdout:\n${pandoc.stdout}`)
//       logger.debug(`pandoc stderr:\n${pandoc.stderr}`)
//       if (pandoc.status !== null && pandoc.status !== 0) {
//         logger.error(`pandoc failed with status: ${pandoc.status}`)
//       } else {
//         logger.info(`Successfully generated PDF: ${outputFile}`)
//       }
//     } finally {
//       // ensure we clean up the temporary file
//       contractFile.removeCallback()
//     }
//   }

//   private buildPandocArgs(inputFile: string, outputFile: string): string[] {
//     const font = 'font' in this.style ? this.style.font : DEFAULT_FONT
//     const pdfEngine = 'pdf_engine' in this.style ? this.style.pdf_engine : DEFAULT_PDF_ENGINE
//     return [
//       inputFile,
//       '-V',
//       `mainfont="${font}"`,
//       `--pdf-engine=${pdfEngine}`,
//       '-o',
//       outputFile,
//     ]
//   }
// }
