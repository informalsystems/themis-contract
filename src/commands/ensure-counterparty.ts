import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { CounterpartyDB } from '../shared/counterparties'
import { logger } from '../shared/logging'

export default class EnsureCounterparty extends Command {
  static description = 'ensures a counterparty is cached in your profile for easy reference'

  static aliases = ['ec']

  static examples = [
    '$ neat-contract ensure-counterparty --id company_a',
    '$ neat-contract ec --id company_a',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    overwrite: flags.boolean({ default: false, description: 'overwrite the counterparty if it exists' }),
    id: flags.string({ description: 'the ID of the counterparty to add (snake_case)' }),
    fullname: flags.string({ description: 'the full name of the counterparty' }),
  }

  async run() {
    const { flags } = this.parse(EnsureCounterparty)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          when: !flags.id,
          message: 'Enter the counterparty\'s ID (snake_case):',
        },
        {
          type: 'input',
          name: 'fullName',
          when: !flags.fullname,
          message: 'Enter the full name(s) of the counterparty:',
        },
      ])
      const id = flags.id ? flags.id : answers.id
      const fullName = flags.fullname ? flags.fullname : answers.fullName

      if (!flags.overwrite && db.has(id)) {
        logger.error(`Counterparty with ID "${id}" already exists.`)
        logger.error('If you want to overwrite a counterparty, run again with "--overwrite" flag set.')
      } else {
        db.ensure(id, fullName)
      }
    })
  }
}
