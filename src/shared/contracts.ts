import * as fs from 'fs'
import * as path from 'path'
import { logger } from './logging'
import { TomlReader } from '@sgarciac/bombadil'
import * as mustache from 'mustache'
import * as tmp from 'tmp'
import { spawnSync } from 'child_process'
import * as moment from 'moment'

const DEFAULT_FONT = 'Helvetica'
const DEFAULT_PDF_ENGINE = 'tectonic'

const DEFAULT_CONTRACT_FILE = 'contract.html'
const DEFAULT_CONTRACT_TEMPLATE = `<h1>New Contract</h1>
<p>Created on {{date}}. Start adding your contract content here.</p>`

const DEFAULT_PARAMS_FILE = 'params.toml'
const DEFAULT_PARAMS = `counterparties = []
date = "${moment().format('YYYY-MM-DD')}"
`

const DEFAULT_STYLE_FILE = 'style.toml'
const DEFAULT_STYLE = `font = "${DEFAULT_FONT}"
pdf_engine = "${DEFAULT_PDF_ENGINE}"
`

const DEFAULT_ENCODING = 'utf8'

const forceWriteFileSync = (filename: string, data: string, force?: boolean) => {
  const exists = fs.existsSync(filename)
  if (!exists || (exists && force)) {
    fs.writeFileSync(filename, data)
    logger.debug(`Wrote output file: ${filename}`)
  } else {
    logger.debug(`File already exists and not forcing, so skipping: ${filename}`)
  }
}

const readFileSyncWithDefault = (basePath: string, filename: string, defaultData?: string): string => {
  const filePath = path.join(basePath, filename)
  if (!fs.existsSync(filePath)) {
    if (defaultData) {
      forceWriteFileSync(filePath, defaultData)
    }
  }
  return fs.readFileSync(filePath, { encoding: DEFAULT_ENCODING })
}

const readTomlFileSync = (basePath: string, filename: string, defaultData?: string): any => {
  const content = readFileSyncWithDefault(basePath, filename, defaultData)
  const reader = new TomlReader()
  reader.readToml(content)
  return reader.result
}

export default class Contract {
  private template = ''

  private params: any

  private style: any

  static createNew(basePath: string, force?: boolean) {
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath)
      logger.debug(`Created folder: ${basePath}`)
    }
    forceWriteFileSync(path.join(basePath, DEFAULT_CONTRACT_FILE), DEFAULT_CONTRACT_TEMPLATE, force)
    forceWriteFileSync(path.join(basePath, DEFAULT_PARAMS_FILE), DEFAULT_PARAMS, force)
    forceWriteFileSync(path.join(basePath, DEFAULT_STYLE_FILE), DEFAULT_STYLE, force)
    logger.info(`Contract available at ${basePath}`)
  }

  static loadFromPath(basePath: string): Contract {
    const contract = new Contract()
    contract.template = readFileSyncWithDefault(
      basePath,
      DEFAULT_CONTRACT_FILE,
      DEFAULT_CONTRACT_TEMPLATE,
    )
    contract.params = readTomlFileSync(
      basePath,
      DEFAULT_PARAMS_FILE,
      DEFAULT_PARAMS,
    )
    contract.style = readTomlFileSync(
      basePath,
      DEFAULT_STYLE_FILE,
      DEFAULT_STYLE,
    )
    return contract
  }

  compile(outputFile: string) {
    // render the template to a temporary directory
    const contractFile = tmp.fileSync({postfix: '.html'})
    try {
      fs.writeFileSync(
        contractFile.name,
        mustache.render(this.template, this.params),
      )
      logger.debug(`Wrote contract to temporary file: ${contractFile.name}`)

      logger.info('Generating PDF...')
      const pandocArgs = this.buildPandocArgs(contractFile.name, outputFile)
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
      contractFile.removeCallback()
    }
  }

  private buildPandocArgs(inputFile: string, outputFile: string): string[] {
    const font = 'font' in this.style ? this.style.font : DEFAULT_FONT
    const pdfEngine = 'pdf_engine' in this.style ? this.style.pdf_engine : DEFAULT_PDF_ENGINE
    return [
      inputFile,
      '-V',
      `mainfont="${font}"`,
      `--pdf-engine=${pdfEngine}`,
      '-o',
      outputFile,
    ]
  }
}
