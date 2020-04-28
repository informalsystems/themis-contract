import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap, isValidID, parseID } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { CounterpartyDB, Counterparty } from '../shared/counterparties'

export default class SaveCounterparty extends Command {
  static description = 'saves a counterparty to your profile for easy retrieval later'

  static aliases = ['sc']

  static examples = [
    '$ themis-contract save-counterparty',
    '$ themis-contract save-counterparty --id company_a',
    '$ themis-contract sc --id company_a',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    overwrite: flags.boolean({ default: false, description: 'overwrite the counterparty if it exists' }),
    id: flags.string({ description: 'the ID of the counterparty to save (snake_case)', parse: parseID }),
    fullname: flags.string({ description: 'the full name of the counterparty' }),
  }

  async run() {
    const { flags } = this.parse(SaveCounterparty)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))

      let counterpartyID: string | undefined = flags.id

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          when: !counterpartyID,
          message: 'Enter the counterparty\'s ID (snake_case):',
          validate: id => {
            if (!isValidID(id)) {
              return `Invalid format for ID: ${id}`
            }
            counterpartyID = id
            return true
          },
        },
        {
          type: 'confirm',
          name: 'overwrite',
          when: () => {
            return !flags.overwrite && counterpartyID && db.has(counterpartyID)
          },
          message: 'Counterparty already exists. Overwrite?',
          default: false,
          validate: overwrite => {
            if (!flags.overwrite && !overwrite && counterpartyID && db.has(counterpartyID)) {
              throw new Error('Cancelling saving of counterparty')
            }
            return true
          },
        },
        {
          type: 'input',
          name: 'fullName',
          when: !flags.fullname,
          message: 'Enter the full name(s) of the counterparty:',
        },
      ])
      if (!counterpartyID) {
        throw new Error('Internal error: missing counterparty ID')
      }
      const fullName = flags.fullname ? flags.fullname : answers.fullName
      db.save(new Counterparty(counterpartyID, fullName))
    })
  }
}
