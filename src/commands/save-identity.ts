/* eslint-disable no-await-in-loop, require-atomic-updates */
import { Command, flags } from '@oclif/command'
import { DEFAULT_PROFILE_PATH, identityDBPath } from '../shared/constants'
import { cliWrap, parseID, isValidID } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { IdentityDB, Identity } from '../shared/identities'
import { logger } from '../shared/logging'
import { keybaseWhoami, keybaseListKeys, keybaseKeyDesc } from '../shared/keybase-helpers'
import { fileExistsAsync } from '../shared/async-io'

const askToOverwrite = async (msg: string): Promise<boolean> => {
  return (await inquirer.prompt([{
    type: 'confirm',
    name: 'overwrite',
    message: msg,
    default: false,
  }])).overwrite
}

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
    keybasekeyid: flags.string({ description: 'optionally specify this identity\'s keybase key ID (can be used for multiple identities)' }),
    siginitials: flags.string({ description: 'optional path to image to use for signing initials' }),
    sigfull: flags.string({ description: 'optional path to image to use for a full signature' }),
  }

  async run() {
    const { flags } = this.parse(SaveIdentity)
    await cliWrap(this, flags.verbose, async () => {
      if (flags.siginitials) {
        if (!(await fileExistsAsync(flags.siginitials))) {
          throw new Error(`File specified for signing initials does not exist: ${flags.siginitials}`)
        }
      }
      if (flags.sigfull) {
        if (!(await fileExistsAsync(flags.sigfull))) {
          throw new Error(`File specified for full signature does not exist: ${flags.sigfull}`)
        }
      }

      logger.info('Querying local Keybase (whoami and key listing)...')
      const keybaseWhoamiResult = await keybaseWhoami()
      logger.debug(`Keybase whoami call resulted in ID: ${keybaseWhoamiResult}`)
      const keybaseKeys = await keybaseListKeys()
      logger.debug(`Got ${keybaseKeys.length} key(s) from Keybase`)

      const identityID = flags.id ? flags.id : (await inquirer.prompt([{
        type: 'input',
        name: 'id',
        message: 'Enter an ID for the new identity (snake_case):',
        validate: isValidID,
      }])).id

      const db = await IdentityDB.load(identityDBPath(flags.profile))
      const identityExists = db.has(identityID)

      if (identityExists && !flags.overwrite) {
        if (!(await askToOverwrite('Identity already exists. Overwrite?'))) {
          logger.info('Not overwriting identity.')
          return
        }
      }

      const identity = db.getOrDefault(identityID, () => new Identity(identityID))

      identity.keybaseID = flags.keybaseid ? flags.keybaseid : identity.keybaseID
      identity.keybaseKeyID = flags.keybasekeyid ? flags.keybasekeyid : identity.keybaseKeyID
      identity.sigInitials = flags.siginitials ? flags.siginitials : identity.sigInitials
      identity.sigFull = flags.sigfull ? flags.sigfull : identity.sigFull

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'keybaseID',
          when: !flags.keybaseid,
          message: 'Please enter the Keybase ID:',
          default: identity.keybaseID ? identity.keybaseID : keybaseWhoamiResult,
        },
        {
          type: 'list',
          name: 'keybaseKeyID',
          when: a => !flags.keybasekeyid && keybaseWhoamiResult in [flags.keybaseid, a.keybaseID, identity.keybaseID],
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
          when: a => !flags.keybasekeyid && (!a.keybaseKeyID || a.keybaseKeyID.length === 0),
          message: 'Please enter the 70-char hex key ID for the Keybase key you would like to use:',
          validate: kid => /^[0-9a-f]{70}$/.test(kid),
        },
      ])
      identity.keybaseID = answers.keybaseID ? answers.keybaseID : identity.keybaseID
      identity.keybaseKeyID = answers.keybaseKeyID ? answers.keybaseKeyID : identity.keybaseKeyID
      identity.keybaseKeyID = answers.customKeybaseKeyID ? answers.customKeybaseKeyID : identity.keybaseKeyID
      identity.sigInitials = flags.siginitials
      identity.sigFull = flags.sigfull
      await db.save(identity)
    })
  }
}
