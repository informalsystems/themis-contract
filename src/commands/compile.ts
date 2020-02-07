import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { logger } from '../shared/logging'
import { readFileAsync } from '../shared/async-io'
import { DEFAULT_TEXT_FILE_ENCODING, templateCachePath, DEFAULT_PROFILE_PATH } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'

export default class Compile extends Command {
  static description = 'compile a contract to produce a PDF'

  static examples = [
    '$ neat-contract compile ./contract/',
    '$ neat-contract compile -o ./contract/mycontract.pdf ./contract/',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    outputFile: flags.string({ char: 'o', default: './contract.pdf', description: 'where to write the output contract PDF' }),
    profilePath: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    styleFile: flags.string({ char: 's', description: 'an optional style file to specify the font and PDF engine to use when rendering the PDF' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract to compile', default: '.' },
  ]

  async run() {
    const { args, flags } = this.parse(Compile)
    logger.level = flags.verbose ? 'debug' : 'info'
    let style: any = {}
    if (flags.styleFile) {
      try {
        style = await readFileAsync(flags.styleFile, { encoding: DEFAULT_TEXT_FILE_ENCODING })
      } catch (error) {
        logger.error(`Failed to read style file (${flags.styleFile}): ${error}`)
      }
      logger.debug(`Loaded style: ${style}`)
    }
    try {
      // configure our template cache
      const cache = await DocumentCache.init(templateCachePath(flags.profilePath))
      const contract = await Contract.fromFile(args.path, cache)
      await contract.compile(flags.outputFile, style)
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`${error.message}\n${error.stack}`)
      } else {
        logger.error(`${error}`)
      }
    }
  }
}
