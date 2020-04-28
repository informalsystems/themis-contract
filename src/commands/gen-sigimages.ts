import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { templateCachePath, DEFAULT_PROFILE_PATH, gitRepoCachePath } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import { cliWrap } from '../shared/cli-helpers'

export default class GenerateSignatureImages extends Command {
  static description = 'generates signature images from their cryptographic signatures'

  static examples = [
    '$ themis-contract gen-sigimages ./contract/contract.toml',
    '$ themis-contract gsi ./contract/contract.toml',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    verify: flags.boolean({ description: 'verify all signatures before generating images' }),
    font: flags.string({ description: 'specify a font spec to search for to select a font for your signature' }),
    overwrite: flags.boolean({ default: false, description: 'always overwrite existing images' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(GenerateSignatureImages)
    await cliWrap(this, flags.verbose, async () => {
      // configure our template cache
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      const contract = await Contract.fromFile(args.path, {
        gitRepoCachePath: gitRepoCachePath(flags.profile),
        cache: cache,
      })
      await contract.generateSigImages({
        overwriteExisting: flags.overwrite,
        verify: flags.verify,
        font: flags.font,
      })
    })
  }
}
