import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { logger } from '../shared/logging'

export default class New extends Command {
  static description = 'create a new contract'

  static examples = [
    '$ neat-contract new ./contract/',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    force: flags.boolean({ char: 'f', default: false, description: 'overwrite any existing files' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
  }

  static args = [
    { name: 'path', description: 'the path in which to create the new contract', default: '.' },
  ]

  async run() {
    const { args, flags } = this.parse(New)
    logger.level = flags.verbose ? 'debug' : 'info'
    Contract.createNew(args.path, flags.force)
  }
}
