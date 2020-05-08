import * as init from '../shared/init'
import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH } from '../shared/constants'
import { cliWrap } from '../shared/cli-helpers'

export default class Init extends Command {
  static description = 'initialize the user environment'

  static examples = [
    '$ themis-contract init',
    '$ themis-contract init --reset',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    reset: flags.boolean({default: false, description: 'reset all initialized configurations to the default state' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
  }

  async run() {
    const { flags } = this.parse(Init)
    await cliWrap(this, flags.verbose, async () => {
      // configure our template cache
      await init.run(flags.profile, flags.reset)
    })
  }
}
