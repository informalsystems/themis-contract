/* eslint-disable require-atomic-updates */
import { Command, flags } from '@oclif/command'
import { Contract, templateFormatFromString } from '../shared/contract'
import { DEFAULT_PROFILE_PATH, templateCachePath, gitRepoCachePath, counterpartyDBPath } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import inquirer = require('inquirer')
import { cliWrap } from '../shared/cli-helpers'
import * as openEditor from 'open-editor'
import { CounterpartyDB, Counterparty, Signatory } from '../shared/counterparties'
import { dirExistsAsync } from '../shared/async-io'

export default class New extends Command {
  static description = 'create a new contract'

  static examples = [
    '$ themis-contract new',
    '$ themis-contract new ./contract.toml',
  ]

  static flags = {
    force: flags.boolean({ char: 'f', default: false, description: 'overwrite any existing files' }),
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    template: flags.string({ char: 't', description: 'automatically prepopulate the new contract with variables from this template' }),
    templateformat: flags.string({ default: 'mustache', description: 'the template format to use', options: ['mustache', 'handlebars'] }),
    noprompt: flags.boolean({ description: 'do not prompt for more information (use defaults)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    noedit: flags.boolean({ default: false, description: 'do not open your $EDITOR after creating the contract' }),
  }

  static args = [
    { name: 'output', description: 'where to write the new contract', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(New)
    let template = flags.template
    if (!template && !flags.noprompt) {
      const a1 = await inquirer.prompt([{
        type: 'confirm',
        name: 'useTemplate',
        message: 'Would you like to prepopulate the contract with variables from a template?',
        default: false,
      }])
      if (a1.useTemplate) {
        template = (await inquirer.prompt([
          {
            type: 'input',
            name: 'template',
            message: 'Where is the template located? (Git/HTTPS URL or file path)',
          },
        ])).template
      }
    }
    const cdbPath = counterpartyDBPath(flags.profile)
    const counterparties = new Map<string, Counterparty>()
    if (await dirExistsAsync(cdbPath)) {
      const counterpartyDB = await CounterpartyDB.load(cdbPath)
      const selectedCounterparties: Counterparty[] = (await inquirer.prompt([{
        type: 'checkbox',
        name: 'counterparties',
        message: 'Select from predefined counterparties',
        choices: counterpartyDB.all().map(c => {
          return { name: c.fullName, value: c }
        }),
      }])).counterparties

      for (const cp of selectedCounterparties) {
        const availSigs: Signatory[] = []
        cp.signatories.forEach(sig => availSigs.push(sig))
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'templateID',
            default: cp.id,
            message: `What ID would you like to use in the template to refer to counterparty "${cp.id}?"`,
          },
          {
            type: 'checkbox',
            name: 'signatories',
            message: `Select signatories for counterparty "${cp.id}"`,
            choices: availSigs.map(s => {
              return { name: s.fullNames, value: s }
            }),
            validate: signatories => {
              if (signatories.length === 0) {
                return 'At least one signatory needs to be selected for a given counterparty'
              }
              return true
            },
          },
        ])
        cp.signatories.clear()
        answers.signatories.forEach((s: Signatory) => cp.signatories.set(s.id, s))
        counterparties.set(answers.templateID, cp)
      }
    }

    await cliWrap(this, flags.verbose, async () => {
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      await Contract.createNew(args.output, {
        template: template,
        templateFormat: templateFormatFromString(flags.templateformat),
        cache: cache,
        force: flags.force,
        gitRepoCachePath: gitRepoCachePath(flags.profile),
        counterparties: counterparties,
      })

      if (!flags.noedit) {
        openEditor([args.output])
      }
    })
  }
}
