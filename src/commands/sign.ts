import { Command, flags } from '@oclif/command'
import { Contract } from '../shared/contract'
import { templateCachePath, DEFAULT_PROFILE_PATH, identityDBPath, gitRepoCachePath } from '../shared/constants'
import { DocumentCache } from '../shared/document-cache'
import { cliWrap } from '../shared/cli-helpers'
import * as inquirer from 'inquirer'
import { IdentityDB } from '../shared/identities'
import { logger } from '../shared/logging'
import { Signatory } from '../shared/counterparties'

export default class Sign extends Command {
  static description = 'sign a contract'

  static examples = [
    '$ neat-contract sign ./contract/contract.toml',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    profile: flags.string({ char: 'p', default: DEFAULT_PROFILE_PATH, description: 'your local profile path (for managing identities, templates, etc.)' }),
    verbose: flags.boolean({ char: 'v', default: false, description: 'increase output logging verbosity to DEBUG level' }),
    counterparty: flags.string({ char: 'c', description: 'the ID of the counterparty (in the contract) on behalf of whom you are signing' }),
    signatory: flags.string({ char: 's', description: 'the ID of the signatory (in the contract) as whom you are signing' }),
    identity: flags.string({ char: 'i', description: 'the ID of the local identity to use to sign' }),
    usekeybase: flags.boolean({ char: 'k', description: 'use Keybase to generate cryptographic signatures' }),
  }

  static args = [
    { name: 'path', description: 'path to the contract to sign', default: 'contract.toml' },
  ]

  async run() {
    const { args, flags } = this.parse(Sign)
    await cliWrap(this, flags.verbose, async () => {
      const cache = await DocumentCache.init(templateCachePath(flags.profile))
      const identityDB = await IdentityDB.load(identityDBPath(flags.profile))
      const contract = await Contract.fromFile(args.path, {
        gitRepoCachePath: gitRepoCachePath(flags.profile),
        cache: cache,
      })

      const counterpartyID = flags.counterparty ? flags.counterparty : (await inquirer.prompt([{
        type: 'list',
        name: 'id',
        message: 'On behalf of which counterparty will you be signing the contract?',
        choices: contract.sortedCounterparties().map(c => {
          return {
            name: c.fullName,
            value: c.id,
          }
        }),
      }])).id
      const counterparty = contract.counterparties.get(counterpartyID)
      if (!counterparty) {
        throw new Error(`No such counterparty with ID "${counterpartyID}"`)
      }

      const signatoryID = flags.signatory ? flags.signatory : (await inquirer.prompt([{
        type: 'list',
        name: 'id',
        message: 'As which signatory will you be signing on behalf of the counterparty?',
        choices: counterparty.listSignatories().map((s: Signatory) => {
          return {
            name: s.fullNames,
            value: s.id,
          }
        }),
      }])).id
      logger.debug(`counterparty.signatories = ${counterparty.signatories}`)
      const signatory = counterparty.signatories.get(signatoryID)
      if (!signatory) {
        throw new Error(`No such signatory with ID "${signatoryID}"`)
      }

      const identityID = flags.identity ? flags.identity : (await inquirer.prompt([{
        type: 'list',
        name: 'id',
        message: 'Which identity do you want to use to sign?',
        choices: identityDB.list().filter(i => i.canSign()).sort((a, b) => {
          return (a.id < b.id) ? -1 : ((a.id > b.id) ? 1 : 0)
        }).map(i => {
          return { name: i.id, value: i.id }
        }),
      }])).id
      const identity = identityDB.get(identityID)
      if (!identity) {
        throw new Error(`No such identity: "${identityID}"`)
      }
      if (!identity.canSign()) {
        throw new Error(`Identity is missing information and cannot be used to sign: "${identityID}" (see "list-identities" for more information)`)
      }

      await contract.sign({
        counterparty: counterparty,
        signatory: signatory,
        identity: identity,
        useKeybase: flags.usekeybase,
      })
      logger.info('Now compile the contract and you should see the signatures in the relevant places')
    })
  }
}
