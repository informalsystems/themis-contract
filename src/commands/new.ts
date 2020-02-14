import { Command, flags } from '@oclif/command'
import { Contract, templateFormatFromString } from '../shared/contract'
import { DEFAULT_PROFILE_PATH, templateCachePath, gitRepoCachePath } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import inquirer = require('inquirer')
import { cliWrap } from '../shared/cli-helpers'
import * as openEditor from 'open-editor'

export default class New extends Command {
  static description = 'create a new contract'

  static examples = [
    '$ neat-contract new',
    '$ neat-contract new ./contract.toml',
  ]

  static flags = {
    force: flags.boolean({ char: 'f', default: false, description: 'overwrite any existing files' }),
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    template: flags.string({ char: 't', description: 'automatically prepopulate the new contract with variables from this template' }),
    templateformat: flags.string({ default: 'handlebars', description: 'the template format to use', options: ['mustache', 'handlebars'] }),
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
    await cliWrap(this, flags.verbose, async () => {
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      await Contract.createNew(args.output, {
        template: template,
        templateFormat: templateFormatFromString(flags.templateformat),
        cache: cache,
        force: flags.force,
        gitRepoCachePath: gitRepoCachePath(flags.profile),
      })

      if (!flags.noedit) {
        openEditor([args.output])
      }
    })
  }
}
