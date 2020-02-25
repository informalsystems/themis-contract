/* eslint-disable no-await-in-loop */
import * as path from 'path'
import { readTOMLFileAsync, writeTOMLFileAsync } from './toml'
import { ensurePath, readdirAsync, fileExistsAsync, unlinkAsync } from './async-io'
import { logger } from './logging'

export class Identity {
  id: string

  /** The full path to the identity's partial signature image, for initialing. */
  sigInitials?: string

  /** The full path to the identity's full signature image. */
  sigFull?: string

  keybaseID?: string

  keybaseKeyID?: string

  constructor(id: string) {
    this.id = id
  }

  getFilename(): string {
    return `${this.id}.toml`
  }

  toDB(): any {
    return {
      sig_initials: this.sigInitials,
      sig_full: this.sigFull,
      keybase_id: this.keybaseID,
      keybase_key_id: this.keybaseKeyID,
    }
  }

  canSignWithKeybase(): boolean {
    if (this.keybaseID && this.keybaseKeyID) {
      return true
    }
    return false
  }

  canSignWithImages(): boolean {
    if (this.sigInitials && this.sigFull) {
      return true
    }
    return false
  }

  async saveToPath(basePath: string) {
    await writeTOMLFileAsync(path.join(basePath, this.getFilename()), this.toDB())
  }

  static fromDB(id: string, a: any): Identity {
    const result = new Identity(id)
    if ('sig_initials' in a) {
      result.sigInitials = a.sig_initials
    }
    if ('sig_full' in a) {
      result.sigFull = a.sig_full
    }
    if ('keybase_id' in a) {
      result.keybaseID = a.keybase_id
    }
    if ('keybase_key_id' in a) {
      result.keybaseKeyID = a.keybase_key_id
    }
    return result
  }

  static async loadFromFile(filename: string): Promise<Identity> {
    const parsedPath = path.parse(filename)
    const id = parsedPath.name
    const a = await readTOMLFileAsync(filename)
    return Identity.fromDB(id, a)
  }
}

export class IdentityDB {
  private basePath: string

  private identities = new Map<string, Identity>()

  constructor(basePath: string) {
    this.basePath = basePath
  }

  get(id: string): Identity | undefined {
    return this.identities.get(id)
  }

  getOrDefault(id: string, defaultVal: () => Identity): Identity {
    const stored = this.identities.get(id)
    return stored ? stored : defaultVal()
  }

  has(id: string): boolean {
    return this.identities.has(id)
  }

  list(): Identity[] {
    const result: Identity[] = []
    this.identities.forEach(v => result.push(v))
    return result
  }

  async save(i: Identity) {
    await i.saveToPath(this.basePath)
    this.identities.set(i.id, i)
    logger.info(`Updated identity "${i.id}"`)
  }

  async delete(id: string) {
    const i = this.identities.get(id)
    if (i) {
      await unlinkAsync(path.join(this.basePath, i.getFilename()))
      this.identities.delete(id)
      logger.info(`Deleted identity with ID "${id}"`)
    }
  }

  static async load(basePath: string): Promise<IdentityDB> {
    await ensurePath(basePath)
    const entries: string[] = await readdirAsync(basePath)
    const db = new IdentityDB(basePath)
    for (const entry of entries) {
      const fullPath = path.join(basePath, entry)
      if (await fileExistsAsync(fullPath)) {
        const i = await Identity.loadFromFile(fullPath)
        db.identities.set(i.id, i)
      }
    }
    logger.debug(`Loaded ${db.identities.size} identities from: ${basePath}`)
    return db
  }
}
