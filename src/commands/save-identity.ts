/* eslint-disable no-await-in-loop */
import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, identityDBPath, HOMEDIR } from '../shared/constants'
import { cliWrap, parseID, isValidID } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { IdentityDB, Identity, SignatureImage } from '../shared/identities'
import { dirExistsAsync } from '../shared/async-io'
import { logger } from '../shared/logging'
import { keybaseWhoami, keybaseListKeys, keybaseKeyDesc } from '../shared/keybase-helpers'

export default class SaveIdentity extends Command {
  static description = 'saves an identity in your profile for use with signing contracts'

  static aliases = ['si']

  static examples = [
    '$ neat-contract save-identity --id manderson',
    '$ neat-contract si --id manderson',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    overwrite: flags.boolean({ default: false, description: 'overwrite the identity if it exists' }),
    id: flags.string({ description: 'a reference for identity to save (snake_case)', parse: parseID }),
    keybaseid: flags.string({ description: 'optionally specify this identity\'s keybase ID (can be used for multiple identities)' }),
  }

  async run() {
    const { flags } = this.parse(SaveIdentity)
    await cliWrap(this, flags.verbose, async () => {
      logger.info('Querying local Keybase (whoami and key listing)...')
      const keybaseWhoamiResult = await keybaseWhoami()
      logger.debug(`Keybase whoami call resulted in ID: ${keybaseWhoamiResult}`)
      const keybaseKeys = await keybaseListKeys()
      logger.debug(`Got ${keybaseKeys.length} key(s) from Keybase`)

      const db = await IdentityDB.load(identityDBPath(flags.profile))

      let identityID = flags.id
      const existingIdentity = identityID ? db.get(identityID) : undefined
      let keybaseID = flags.keybaseid
      const signatures = existingIdentity ? existingIdentity.signatureImages : new Map<string, SignatureImage>()

      if (existingIdentity && existingIdentity.keybaseID) {
        keybaseID = existingIdentity.keybaseID
      } else {
        keybaseID = keybaseWhoamiResult
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          when: !flags.id,
          message: 'Enter an ID for the new identity (snake_case):',
          validate: id => {
            if (!isValidID(id)) {
              return `Invalid format for ID: ${id}`
            }
            identityID = id
            return true
          },
        },
        {
          type: 'confirm',
          name: 'overwrite',
          when: () => !flags.overwrite && existingIdentity,
          message: 'Identity already exists. Overwrite?',
          default: false,
        },
        {
          type: 'confirm',
          name: 'setKeybaseID',
          when: a => !flags.keybaseid && (!existingIdentity || (existingIdentity && (flags.overwrite || a.overwrite))),
          message: 'Would you like to add/update a Keybase ID for this identity? (can be used for multiple identities)',
        },
        {
          type: 'input',
          name: 'keybaseID',
          when: a => a.setKeybaseID && (!existingIdentity || (existingIdentity && (flags.overwrite || a.overwrite))),
          message: 'Please enter the Keybase ID:',
          default: keybaseID,
          validate: kid => {
            keybaseID = kid
            return true
          },
        },
        {
          type: 'list',
          name: 'keybaseKeyID',
          when: () => keybaseID === keybaseWhoamiResult,
          choices: () => {
            return keybaseKeys.map(key => {
              return {
                name: keybaseKeyDesc(key),
                value: key.id,
              }
            })
          },
          message: 'Which key would you like to use?',
        },
        {
          type: 'input',
          name: 'customKeybaseKeyID',
          when: () => keybaseID && (keybaseID !== keybaseWhoamiResult),
          message: 'Please enter the 70-char hex key ID for the Keybase key you would like to use:',
          validate: kid => /^[0-9a-f]{70}$/.test(kid),
        },
      ])
      if (existingIdentity && !answers.overwrite) {
        logger.info('Not overwriting identity')
        return
      }
      if (!identityID) {
        throw new Error('Internal error: missing identity ID')
      }
      await db.save(new Identity(
        identityID,
        signatures,
        keybaseID,
        answers.customKeybaseKeyID ? answers.customKeybaseKeyID : answers.keybaseKeyID,
      ))
      logger.info('Use the "save-signature" command to manage signatures for this identity.')
    })
  }
}
