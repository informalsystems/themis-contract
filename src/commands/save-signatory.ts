import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap, parseID, isValidID } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { CounterpartyDB, Signatory } from '../shared/counterparties'

export default class SaveSignatory extends Command {
  static description = 'saves a counterparty\'s signatory in your profile'

  static aliases = ['ss']

  static examples = [
    '$ neat-contract save-signatory company_a --id manderson',
    '$ neat-contract ss company_a --id manderson',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    overwrite: flags.boolean({ default: false, description: 'overwrite the signatory if they exist' }),
    id: flags.string({ description: 'the ID of the signatory to save (snake_case)', parse: parseID }),
    fullnames: flags.string({ description: 'the full names of the signatory' }),
    keybaseid: flags.string({ description: 'the Keybase ID of the signatory' }),
  }

  static args = [
    { name: 'counterpartyid', description: 'the ID of the counterparty for the signatory', required: true },
  ]

  async run() {
    const { args, flags } = this.parse(SaveSignatory)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))
      const c = db.get(args.counterpartyid)

      if (!c) {
        throw new Error(`No such counterparty with ID "${args.counterpartyid}"`)
      }

      let sigID: string | undefined = flags.id

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          when: !flags.id,
          message: 'Enter the signatory\'s ID (snake_case):',
          validate: id => {
            if (!isValidID(id)) {
              return `Invalid format for ID: ${id}`
            }
            sigID = id
            return true
          },
        },
        {
          type: 'confirm',
          name: 'overwrite',
          when: () => {
            return !flags.overwrite && sigID && c.hasSignatory(sigID)
          },
          message: 'Signatory already exists. Overwrite?',
          default: false,
          validate: overwrite => {
            if (!flags.overwrite && !overwrite && sigID && c.hasSignatory(sigID)) {
              throw new Error('Cancelling saving of signatory')
            }
            return true
          },
        },
        {
          type: 'input',
          name: 'fullNames',
          when: !flags.fullnames,
          message: 'Enter the full name(s) of the signatory:',
        },
        {
          type: 'confirm',
          name: 'hasKeybaseID',
          when: !flags.keybaseid,
          message: 'Does the signatory have a Keybase ID? (can be added later)',
        },
        {
          type: 'input',
          name: 'keybaseID',
          when: a => {
            return !flags.keybaseid && a.hasKeybaseID
          },
          message: 'What is their Keybase ID?',
        },
      ])
      if (!sigID) {
        // this should never happen
        throw new Error('Internal error: missing signature ID')
      }
      const fullNames = flags.fullnames ? flags.fullnames : answers.fullNames
      const keybaseID = flags.keybaseid ? flags.keybaseid : answers.keybaseID

      c.setSignatory(sigID, new Signatory(sigID, fullNames, keybaseID))
      await db.save(c)
    })
  }
}
