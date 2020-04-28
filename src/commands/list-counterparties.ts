import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap, longestFieldLength } from '../shared/cli-helpers'
import { CounterpartyDB } from '../shared/counterparties'
import {cli} from 'cli-ux'
import { logger } from '../shared/logging'

export default class ListCounterparties extends Command {
  static description = 'prints a table of all counterparties and their IDs'

  static aliases = ['lsc']

  static examples = [
    '$ themis-contract list-counterparties',
    '$ themis-contract lsc',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    ...cli.table.flags(),
  }

  async run() {
    const { flags } = this.parse(ListCounterparties)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))
      const sorted = db.all()
      if (sorted.length === 0) {
        logger.info('Empty counterparties database')
        return
      }
      const longestID = longestFieldLength(sorted, 'id')
      const longestName = longestFieldLength(sorted, 'fullName')
      cli.table(sorted, {
        id: {
          header: 'id',
          minWidth: longestID + 5,
        },
        fullName: {
          header: 'full_name',
          minWidth: longestName + 5,
        },
        signatories: {
          header: 'signatories',
          get: row => row.signatories.size,
        },
      }, {
        printLine: this.log,
        ...flags,
      })
    })
  }
}
