import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { CounterpartyDB, Signatory } from '../shared/counterparties'

export default class EnsureSignatory extends Command {
  static description = 'ensures a counterparty\'s signatory is cached in your profile for easy reference'

  static aliases = ['se']

  static examples = [
    '$ neat-contract ensure-signatory company_a --id manderson',
    '$ neat-contract se company_a --id manderson',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    overwrite: flags.boolean({ default: false, description: 'overwrite the signatory if they exist' }),
    id: flags.string({ description: 'the ID of the signatory to add (snake_case)' }),
    fullnames: flags.string({ description: 'the full names of the signatory' }),
    keybaseid: flags.string({ description: 'the Keybase ID of the signatory' }),
  }

  static args = [
    { name: 'counterpartyid', description: 'the ID of the counterparty for the signatory', required: true },
  ]

  async run() {
    const { args, flags } = this.parse(EnsureSignatory)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))
      const c = db.get(args.counterpartyid)

      if (!c) {
        throw new Error(`No such counterparty with ID "${args.counterpartyid}"`)
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          when: !flags.id,
          message: 'Enter the signatory\'s ID (snake_case):',
        },
        {
          type: 'confirm',
          name: 'overwrite',
          when: answers => {
            return !flags.overwrite && c.hasSignatory(answers.id)
          },
          message: 'Signatory already exists. Overwrite?',
          default: false,
          validate: answers => {
            if (!flags.overwrite && c.hasSignatory(answers.id) && !answers.overwrite) {
              throw new Error('Cancelling signatory operation')
            }
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
          when: answers => {
            return !flags.keybaseid && answers.hasKeybaseID
          },
          message: 'What is their Keybase ID?',
        },
      ])
      const id = flags.id ? flags.id : answers.id
      const fullNames = flags.fullnames ? flags.fullnames : answers.fullNames
      const keybaseID = flags.keybaseid ? flags.keybaseid : answers.keybaseID

      c.setSignatory(id, new Signatory(id, fullNames, keybaseID))
      await db.update(c)
    })
  }
}
