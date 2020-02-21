import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { templateCachePath, DEFAULT_PROFILE_PATH, gitRepoCachePath } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import { cliWrap } from '../shared/cli-helpers'

export default class Verify extends Command {
  static description = 'verify all cryptographic signatures on a contract'

  static examples = [
    '$ neat-contract verify ./contract/contract.toml',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    usekeybase: flags.boolean({ char: 'k', description: 'use Keybase to verify cryptographic signatures' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract to verify', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(Verify)
    await cliWrap(this, flags.verbose, async () => {
      // configure our template cache
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      const contract = await Contract.fromFile(args.path, {
        gitRepoCachePath: gitRepoCachePath(flags.profile),
        cache: cache,
      })
      await contract.verify({
        useKeybase: flags.usekeybase,
      })
    })
  }
}
