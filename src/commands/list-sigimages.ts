import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, identityDBPath } from '../shared/constants'
import { cliWrap, longestFieldLength } from '../shared/cli-helpers'
import { IdentityDB, SignatureImage } from '../shared/identities'
import { cli } from 'cli-ux'

export default class ListSignatureImages extends Command {
  static description = 'prints a table of all of the signature images for a particular identity'

  static aliases = ['lssi']

  static examples = [
    '$ neat-contract list-sigimages manderson',
    '$ neat-contract lssi manderson',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    ...cli.table.flags(),
  }

  static args = [
    { name: 'identityid', description: 'the ID of the identity whose signature images you want to list', required: true },
  ]

  async run() {
    const { args, flags } = this.parse(ListSignatureImages)
    await cliWrap(this, flags.verbose, async () => {
      const db = await IdentityDB.load(identityDBPath(flags.profile))
      const identity = db.get(args.identityid)

      if (!identity) {
        throw new Error(`Cannot find identity with ID "${args.identityid}"`)
      }

      const sigImages: SignatureImage[] = []
      identity.signatureImages.forEach(si => sigImages.push(si))

      const longestID = longestFieldLength(sigImages, 'id')
      cli.table(sigImages, {
        id: {
          header: 'ID',
          minWidth: longestID + 5,
        },
        filename: {
          header: 'Filename',
        },
      }, {
        printLine: this.log,
        ...flags,
      })
    })
  }
}
