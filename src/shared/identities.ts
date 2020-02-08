/* eslint-disable no-await-in-loop */
import * as path from 'path'
import { readTOMLFileAsync, writeTOMLFileAsync } from './toml'
import { DBError } from './errors'
import { ensurePath, readdirAsync, fileExistsAsync, unlinkAsync } from './async-io'
import { logger } from './logging'

export class SignatureImage {
  filename: string

  constructor(filename: string) {
    this.filename = filename
  }

  toDB(): any {
    return this.filename
  }

  static fromDB(a: any): SignatureImage {
    return new SignatureImage(a)
  }
}

export class Identity {
  id: string

  // Signature files mapped by way of their IDs (e.g. "initials", "full")
  signatureImages = new Map<string, SignatureImage>()

  keybaseID: string | undefined

  keybaseKeyID: string | undefined

  constructor(id: string, signatureImages?: Map<string, SignatureImage>, keybaseID?: string, keybaseKeyID?: string) {
    this.id = id
    if (signatureImages) {
      this.signatureImages = signatureImages
    }
    if (keybaseID) {
      this.keybaseID = keybaseID
    }
    if (keybaseKeyID) {
      this.keybaseKeyID = keybaseKeyID
    }
  }

  getFilename(): string {
    return `${this.id}.toml`
  }

  toDB(): any {
    const sigImages: any = {}
    this.signatureImages.forEach((sig, id) => {
      sigImages[id] = sig.toDB()
    })
    return {
      signature_images: sigImages,
      keybase_id: this.keybaseID,
      keybase_key_id: this.keybaseKeyID,
    }
  }

  async saveToPath(basePath: string) {
    await writeTOMLFileAsync(path.join(basePath, this.getFilename()), this.toDB())
  }

  static fromDB(id: string, a: any): Identity {
    const result = new Identity(id)
    if (!('signature_images' in a)) {
      throw new DBError(`Missing field "signature_images" in identity DB entry for "${id}"`)
    }
    for (const sigID in a.signature_images) {
      if (Object.prototype.hasOwnProperty.call(a.signature_images, sigID)) {
        result.signatureImages.set(sigID, SignatureImage.fromDB(a.signature_images[sigID]))
      }
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
