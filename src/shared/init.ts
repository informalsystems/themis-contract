import * as path from 'path'
import {INSTALLATION_DIR, PANDOC_DEFAULTS_FILE_NAME } from '../shared/constants'
import { copyFileAsync, fileExistsAsync } from '../shared/async-io'
import { logger } from '../shared/logging'

export const PANDOC_DEFAULTS_SRC = path.join(INSTALLATION_DIR, PANDOC_DEFAULTS_FILE_NAME)

// Workaround for inability to use variables as keys in object literal
const buildFileDict: () => Record<string, string> = () => {
  const r: Record<string, string> = {}
  r[PANDOC_DEFAULTS_SRC] = PANDOC_DEFAULTS_FILE_NAME
  return r
}

// Mapping source files to destinations, given relative to the users profile
export const FILES_TO_INSTALL = buildFileDict()

/**
 * Initializes the user's system with default configurations.
 *
 * @param {string} profile The directory in which configurations and resources
 * are stored.
 *
 * @param {boolean} reset Whether or not existing configurations should be
 * reinitialized. If `false`, no existing configurations values will be
 * altered.
 */
export const run = async (profile: string, reset: boolean) => {
  for (const [src, name] of Object.entries(FILES_TO_INSTALL)) {
    const dest = path.join(profile, name)
    if (await fileExistsAsync(dest) && !reset) {
      logger.debug(`skipping initialization of ${dest}: file already exists`)
    } else {
      await copyFileAsync(src, dest)
      logger.debug(`${reset ? 're-' : ''}initialized ${dest}`)
    }
  }
}
