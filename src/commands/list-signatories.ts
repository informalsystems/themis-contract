import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap, longestFieldLength } from '../shared/cli-helpers'
import { CounterpartyDB } from '../shared/counterparties'
import {cli} from 'cli-ux'
import { logger } from '../shared/logging'

export default class ListSignatories extends Command {
  static description = 'prints a table of all signatories for a specific counterparty and their IDs'

  static aliases = ['lss']

  static examples = [
    '$ neat-contract list-signatories',
    '$ neat-contract lss',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    ...cli.table.flags(),
  }

  static args = [
    { name: 'counterpartyid', description: 'the ID of the counterparty whose signatories must be listed', required: true },
  ]

  async run() {
    const { args, flags } = this.parse(ListSignatories)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))
      const c = db.get(args.counterpartyid)

      if (!c) {
        throw new Error(`No such counterparty with ID "${args.counterpartyid}"`)
      }

      const sigs = c.listSignatories()
      if (sigs.length === 0) {
        logger.info(`No signatories for counterparty with ID "${args.counterpartyid}"`)
        return
      }
      const longestID = longestFieldLength(sigs, 'id')
      const longestFullNames = longestFieldLength(sigs, 'fullNames')
      cli.table(sigs, {
        id: {
          header: 'id',
          minWidth: longestID + 5,
        },
        fullNames: {
          header: 'full_names',
          minWidth: longestFullNames + 5,
        },
        keybaseId: {
          header: 'keybase_id',
          extended: true,
        },
      }, {
        printLine: this.log,
        ...flags,
      })
    })
  }
}
