import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, identityDBPath } from '../shared/constants'
import { cliWrap, longestFieldLength } from '../shared/cli-helpers'
import { IdentityDB } from '../shared/identities'
import { cli } from 'cli-ux'
import { logger } from '../shared/logging'

export default class ListIdentities extends Command {
  static description = 'prints a table of all of your saved identities'

  static aliases = ['lsi']

  static examples = [
    '$ neat-contract list-identities',
    '$ neat-contract lsi',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    ...cli.table.flags(),
  }

  async run() {
    const { flags } = this.parse(ListIdentities)
    await cliWrap(this, flags.verbose, async () => {
      const db = await IdentityDB.load(identityDBPath(flags.profile))
      const sorted = db.list()
      if (sorted.length === 0) {
        logger.info('No saved identities yet. Try adding one with the "save-identity" command.')
        return
      }
      const longestID = longestFieldLength(sorted, 'id')
      const longestKeybaseID = longestFieldLength(sorted, 'keybaseID')
      cli.table(sorted, {
        id: {
          header: 'ID',
          minWidth: longestID + 5,
        },
        sigInitials: {
          header: 'Initials',
          minWidth: 'Initials'.length + 5,
          get: row => row.sigInitials ? 'yes' : '',
        },
        sigFull: {
          header: 'Signature',
          minWidth: 'Signature'.length + 5,
          get: row => row.sigFull ? 'yes' : '',
        },
        keybaseID: {
          header: 'Keybase ID',
          minWidth: longestKeybaseID + 5,
          get: row => row.keybaseID ? row.keybaseID : '(none)',
        },
        keybaseKeyID: {
          header: 'Keybase Key ID',
          extended: true,
          get: row => row.keybaseKeyID ? row.keybaseKeyID : '(none)',
        },
      }, {
        printLine: this.log,
        ...flags,
      })
    })
  }
}
