import { Command, flags } from '@oclif/command'
import Contract from '../shared/contracts'
import { logger } from '../shared/logging'

export default class Compile extends Command {
  static description = 'compile a contract to produce a PDF'

  static examples = [
    '$ neat-contract compile ./contract/',
    '$ neat-contract compile -o ./contract/mycontract.pdf ./contract/',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    outputFile: flags.string({ char: 'o', default: './contract.pdf', description: 'where to write the output contract PDF' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract to compile', default: '.' },
  ]

  async run() {
    const { args, flags } = this.parse(Compile)
    logger.level = flags.verbose ? 'debug' : 'info'
    const contract = Contract.loadFromPath(args.path)
    contract.compile(flags.outputFile)
  }
}
