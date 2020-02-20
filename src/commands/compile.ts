import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { logger } from '../shared/logging'
import { readFileAsync } from '../shared/async-io'
import { DEFAULT_TEXT_FILE_ENCODING, templateCachePath, DEFAULT_PROFILE_PATH, gitRepoCachePath } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import { cliWrap } from '../shared/cli-helpers'

export default class Compile extends Command {
  static description = 'compile a contract to produce a PDF'

  static examples = [
    '$ neat-contract compile ./contract/contract.toml',
    '$ neat-contract compile -o ./contract/mycontract.pdf ./contract/contract.toml',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    output: flags.string({ char: 'o', default: './contract.pdf', description: 'where to write the output contract PDF' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    style: flags.string({ char: 's', description: 'an optional style file to specify the font and PDF engine to use when rendering the PDF' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract to compile', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(Compile)
    await cliWrap(this, flags.verbose, async () => {
      let style: any = {}
      if (flags.style) {
        style = await readFileAsync(flags.style, { encoding: DEFAULT_TEXT_FILE_ENCODING })
        logger.debug(`Loaded style: ${style}`)
      }
      // configure our template cache
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      const contract = await Contract.fromFile(args.path, {
        gitRepoCachePath: gitRepoCachePath(flags.profile),
        cache: cache,
      })
      await contract.compile(flags.output, style)
    })
  }
}
