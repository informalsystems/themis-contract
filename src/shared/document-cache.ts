import * as path from 'path'
import * as crypto from 'crypto'
import { ensurePath, fileExistsAsync, readFileAsync, writeFileAsync } from './async-io'
import { DEFAULT_TEXT_FILE_ENCODING } from './constants'
import { logger } from './logging'

const INDEX_FILENAME = 'index.json'

// Allows us to generate relatively unique filenames for potentially long source
// URLs with characters that cannot be accommodated in the filesystem.
const computeCacheFilename = (src: string): string => {
  const hash = crypto.createHash('md5')
  hash.update(src)
  return hash.digest('hex')
}

const computeContentHash = (content: string): string => {
  const hash = crypto.createHash('sha256')
  hash.update(content)
  return hash.digest('hex')
}

export class DocumentCache {
  // The base path for the document cache
  private basePath: string

  // A mapping of source addresses to cached document metadata.
  private index: any = {}

  constructor(basePath: string) {
    this.basePath = basePath
  }

  /**
   * Initializes a document cache at the given base path. If the path does not
   * exist, it will be created.
   * @param {string} basePath The directory in which cached files and index data
   *   will be stored.
   */
  static async init(basePath: string): Promise<DocumentCache> {
    await ensurePath(basePath)
    const cache = new DocumentCache(basePath)
    await cache.loadIndex()
    return cache
  }

  indexPath(): string {
    return path.join(this.basePath, INDEX_FILENAME)
  }

  async loadIndex() {
    // make sure the index is clear before we load anything
    this.index = {}
    const indexPath = this.indexPath()
    if (!await fileExistsAsync(indexPath)) {
      // nothing to load
      return
    }
    this.index = JSON.parse(
      await readFileAsync(indexPath, { encoding: DEFAULT_TEXT_FILE_ENCODING }),
    )
    logger.debug(`Loaded ${Object.keys(this.index).length} items into document cache index`)
  }

  async saveIndex() {
    await writeFileAsync(this.indexPath(), JSON.stringify(this.index))
  }

  async add(src: string, content: string) {
    const filename = computeCacheFilename(src)
    await writeFileAsync(path.join(this.basePath, filename), content)
    this.index[src] = {
      filename: filename,
      lastUpdated: Date.now(),
      hash: computeContentHash(content),
    }
    await this.saveIndex()
    logger.debug(`Added cached document from source: ${src} (SHA256 hash: ${this.index[src].hash})`)
  }

  has(src: string): boolean {
    return src in this.index
  }

  getMeta(src: string): any | null {
    if (src in this.index) {
      return this.index[src]
    }
    return null
  }

  async getContent(src: string): Promise<string | null> {
    if (src in this.index) {
      return readFileAsync(
        path.join(this.basePath, this.index[src].filename),
        { encoding: DEFAULT_TEXT_FILE_ENCODING },
      )
    }
    return null
  }
}
