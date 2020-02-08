import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, counterpartyDBPath } from '../shared/constants'
import { cliWrap } from '../shared/cli-helpers'
import { CounterpartyDB } from '../shared/counterparties'
import { logger } from '../shared/logging'
import * as inquirer from 'inquirer'

export default class RemoveCounterparty extends Command {
  static description = 'remove a counterparty from your local profile'

  static aliases = ['rmc']

  static examples = [
    '$ neat-contract rm-counterparty company_a',
    '$ neat-contract rm-counterparty -y company_a',
    '$ neat-contract rm-counterparty --all',
  ]

  static flags = {
    all: flags.boolean({ char: 'a', default: false, description: 'remove all counterparties from database'}),
    autoconfirm: flags.boolean({ char: 'y', default: false, description: 'automatically answer "yes" to questions about removing counterparties'}),
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
  }

  static args = [
    { name: 'id', description: 'the ID of the counterparty to remove' },
  ]

  async run() {
    const { args, flags } = this.parse(RemoveCounterparty)
    await cliWrap(this, flags.verbose, async () => {
      const db = await CounterpartyDB.init(counterpartyDBPath(flags.profile))

      if (flags.all) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to delete ALL counterparties?',
          when: !flags.autoconfirm,
          default: false,
        }])
        if (flags.autoconfirm || answer.confirm) {
          await db.clear()
        } else {
          logger.info('Not deleting any counterparties')
        }
        return
      }

      if (db.has(args.id)) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete counterparty "${args.id}"?`,
          when: !flags.autoconfirm,
          default: false,
        }])
        if (flags.autoconfirm || answer.confirm) {
          await db.delete(args.id)
        } else {
          logger.info('Not deleting counterparty')
        }
      } else {
        throw new Error(`No such counterparty with ID: ${args.id}`)
      }
    })
  }
}
