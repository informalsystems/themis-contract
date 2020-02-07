/* eslint-disable no-await-in-loop */
import * as path from 'path'
import {ContractFormatError, SignatoryMissingFieldError, CounterpartyMissingFieldError} from './errors'
import { ensurePath, dirExistsAsync, readdirAsync, fileExistsAsync, unlinkAsync } from './async-io'
import { logger } from './logging'
import { writeTOMLFileAsync, readTOMLFileAsync } from './toml'

export class Signatory {
  id: string

  fullNames: string

  keybaseId?: string

  constructor(id: string, fullNames: string, keybaseId?: string) {
    this.id = id
    this.fullNames = fullNames
    this.keybaseId = keybaseId
  }

  toAny(): any {
    return {
      id: this.id,
      full_names: this.fullNames,
      keybase_id: this.keybaseId,
    }
  }

  static fromAny(counterpartyId: string, signatoryId: string, a: any): Signatory {
    if (!(signatoryId in a)) {
      throw new ContractFormatError(`Missing section for signatory "${signatoryId}" of counterparty "${counterpartyId}"`)
    }
    if (!('full_names' in a[signatoryId])) {
      throw new SignatoryMissingFieldError(counterpartyId, signatoryId, 'full_names')
    }
    let keybaseId: string | undefined
    if ('keybase_id' in a[signatoryId]) {
      keybaseId = a[signatoryId].keybase_id
    }
    return new Signatory(signatoryId, a[signatoryId].full_names, keybaseId)
  }
}

export class Counterparty {
  /** A unique identifier for this counterparty. */
  id: string

  /** The full name of this counterparty. */
  fullName: string

  /** One or more signatories for this counterparty. */
  signatories: Signatory[]

  constructor(id: string, fullName: string, signatories: Signatory[]) {
    this.id = id
    this.fullName = fullName
    this.signatories = signatories
  }

  async saveToFile(filename: string) {
    await writeTOMLFileAsync(filename, this.toAny())
    logger.debug(`Wrote counterparty "${this.id}" to ${filename}`)
  }

  toAny(): any {
    return {
      id: this.id,
      full_name: this.fullName,
      signatories: this.signatories.forEach(s => s.toAny()),
    }
  }

  static fromAny(id: string, a: any): Counterparty {
    if (!(id in a)) {
      throw new ContractFormatError(`Missing section for counterparty "${id}"`)
    }
    if (!('full_name' in a[id])) {
      throw new CounterpartyMissingFieldError(id, 'full_name')
    }
    if (!('signatories' in a[id])) {
      throw new CounterpartyMissingFieldError(id, 'signatories')
    }
    if (!Array.isArray(a[id].signatories)) {
      throw new ContractFormatError(`Expected "signatories" field for counterparty "${id}" to be an array`)
    }
    if (a[id].signatories.length === 0) {
      throw new ContractFormatError(`Expected at least one signatory for counterparty "${id}"`)
    }
    return new Counterparty(
      id,
      a[id].full_name,
      a[id].signatories.map((sigId: string) => Signatory.fromAny(id, sigId, a)),
    )
  }

  static async loadFromFile(filename: string): Promise<Counterparty> {
    logger.debug(`Attempting to load counterparty from file: ${filename}`)
    const v = await readTOMLFileAsync(filename)
    return new Counterparty(
      v.id,
      v.full_name,
      v.signatories ? v.signatories.forEach((sig: any) => new Signatory(sig.id, sig.full_names, sig.keybase_id)) : [],
    )
  }
}

export class CounterpartyDB {
  // Where this database is located in the filesystem
  private basePath: string

  // A mapping of counterparty IDs to counterparty details.
  private counterparties = new Map<string, Counterparty>()

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async ensure(id: string, fullName: string) {
    const c = new Counterparty(id, fullName, [])
    this.counterparties.set(id, c)
    await c.saveToFile(path.join(this.basePath, `${id}.toml`))
    logger.info(`Added counterparty "${fullName}" with ID ${id}`)
  }

  has(id: string): boolean {
    return this.counterparties.has(id)
  }

  get(id: string): Counterparty | undefined {
    return this.counterparties.get(id)
  }

  async delete(id: string) {
    const c = this.counterparties.get(id)
    if (c) {
      await unlinkAsync(path.join(this.basePath, `${id}.toml`))
      this.counterparties.delete(id)
      logger.info(`Deleted counterparty "${c.fullName}" with ID "${c.id}"`)
    }
  }

  async clear() {
    for (const id of this.counterparties.keys()) {
      await this.delete(id)
    }
  }

  /**
   * Returns a sorted list of counterparties (sorted by their full name).
   * @returns {Counterparty[]} A sorted list of counterparties in this DB.
   */
  all(): Counterparty[] {
    const result: Counterparty[] = []
    this.counterparties.forEach(c => {
      result.push(c)
    })
    return result.sort((a, b) => {
      if (a.fullName < b.fullName) {
        return -1
      }
      if (a.fullName > b.fullName) {
        return 1
      }
      return 0
    })
  }

  static async init(basePath: string): Promise<CounterpartyDB> {
    if (await dirExistsAsync(basePath)) {
      return CounterpartyDB.load(basePath)
    }
    // a fresh new database
    await ensurePath(basePath)
    logger.debug(`Created counterparty database: ${basePath}`)
    return new CounterpartyDB(basePath)
  }

  static async load(basePath: string): Promise<CounterpartyDB> {
    const entries: string[] = await readdirAsync(basePath)
    const db = new CounterpartyDB(basePath)
    for (const entry of entries) {
      const fullPath = path.join(basePath, entry)
      if (await fileExistsAsync(fullPath)) {
        const c = await Counterparty.loadFromFile(fullPath)
        db.counterparties.set(c.id, c)
      }
    }
    logger.debug(`Loaded ${db.counterparties.size} counterparties from: ${basePath}`)
    return db
  }
}
