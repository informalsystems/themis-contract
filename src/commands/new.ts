import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { logger } from '../shared/logging'
import { DEFAULT_PROFILE_PATH, templateCachePath } from '../shared/constants'
import cli from 'cli-ux'
import { DocumentCache } from '../shared/document-cache'

export default class New extends Command {
  static description = 'create a new contract'

  static examples = [
    '$ neat-contract new',
    '$ neat-contract new ./contract.toml',
  ]

  static flags = {
    force: flags.boolean({ char: 'f', default: false, description: 'overwrite any existing files' }),
    help: flags.help({ char: 'h' }),
    profilePath: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
  }

  static args = [
    { name: 'output', description: 'where to write the new contract', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(New)
    logger.level = flags.verbose ? 'debug' : 'info'
    const cache = await DocumentCache.init(templateCachePath(flags.profilePath))
    const useTemplate = await cli.confirm('Extract new contract parameters from a template? [y/n]')
    let template: string | undefined
    if (useTemplate) {
      template = await cli.prompt('What is the template\'s path/URL?')
    }
    await Contract.createNew(args.output, {
      template: template,
      cache: cache,
      force: flags.force,
    })
  }
}
