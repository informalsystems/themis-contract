/* eslint-disable no-await-in-loop */
import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, identityDBPath } from '../shared/constants'
import { cliWrap, parseID } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { IdentityDB, SignatureImage } from '../shared/identities'
import { fileExistsAsync } from '../shared/async-io'
import { logger } from '../shared/logging'

export default class SaveSignatureImage extends Command {
  static description = 'saves a signature image for a specific identity for use in signing contracts'

  static aliases = ['ssi']

  static examples = [
    '$ neat-contract save-sigimage manderson',
    '$ neat-contract ssi manderson',
    '$ neat-contract ssi manderson --id fullsig --filename /path/to/full-signature.png',
    '$ neat-contract ssi manderson --id initials --filename /path/to/my-initials.png',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    overwrite: flags.boolean({ default: false, description: 'overwrite the signature image if it exists' }),
    id: flags.string({ description: 'an ID for the signature image (e.g. "full", "initials")', parse: parseID }),
    filename: flags.string({ description: 'the path to the image file to use for this signature', required: true }),
  }

  static args = [
    { name: 'identityid', description: 'the ID of the identity whose signature image is to be saved', required: true },
  ]

  async run() {
    const { args, flags } = this.parse(SaveSignatureImage)
    await cliWrap(this, flags.verbose, async () => {
      const db = await IdentityDB.load(identityDBPath(flags.profile))
      const identity = db.get(args.identityid)
      if (!identity) {
        throw new Error(`Cannot find identity with ID "${args.identityid}"`)
      }
      if (!flags.id) {
        throw new Error('Missing ID for signature image')
      }
      if (!(await fileExistsAsync(flags.filename))) {
        throw new Error(`File does not exist: ${flags.filename}`)
      }
      if (!flags.overwrite && identity.signatureImages.has(flags.id)) {
        const answer = await inquirer.prompt({
          type: 'confirm',
          name: 'overwrite',
          message: 'A signature image with that ID already exists. Overwrite it?',
          default: false,
        })
        if (!answer.overwrite) {
          logger.info('Not overwriting signature image')
          return
        }
      }
      identity.signatureImages.set(flags.id, new SignatureImage(flags.id, flags.filename))
      await db.save(identity)
    })
  }
}
