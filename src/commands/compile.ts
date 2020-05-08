import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { templateCachePath, DEFAULT_PROFILE_PATH, gitRepoCachePath, DEFAULT_PANDOC_DEFAULTS_FILE } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import { cliWrap } from '../shared/cli-helpers'

export default class Compile extends Command {
  static description = 'compile a contract to produce a PDF'

  static examples = [
    '$ themis-contract compile ./contract/contract.toml',
    '$ themis-contract compile -o ./contract/mycontract.pdf ./contract/contract.toml',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    output: flags.string({ char: 'o', default: './contract.pdf', description: 'where to write the output contract PDF' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    defaults: flags.string({ char: 'd', default: DEFAULT_PANDOC_DEFAULTS_FILE, description: 'a custom pandoc defaults file configuring pandoc compilation of templates' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    verify: flags.boolean({ description: 'verify the contract before compiling it' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract to compile', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(Compile)
    await cliWrap(this, flags.verbose, async () => {
      // configure our template cache
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      const contract = await Contract.fromFile(args.path, {
        gitRepoCachePath: gitRepoCachePath(flags.profile),
        cache: cache,
      })
      await contract.compile(flags.output, {
        defaults: flags.defaults,
        verify: flags.verify,
      })
    })
  }
}
