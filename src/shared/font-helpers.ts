import { spawnAsync, fileExistsAsync } from './async-io'
import { logger } from './logging'

export const findFontFile = async (spec: string): Promise<string> => {
  const fcList = await spawnAsync('fc-list', [spec])
  logger.debug(`fc-list stdout:\n${fcList.stdout}`)
  logger.debug(`fc-list stderr:\n${fcList.stderr}`)
  if (fcList.status !== 0) {
    throw new Error(`Failed to execute "fc-list". Status code: ${fcList.status}`)
  }
  for (const line of fcList.stdout.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      const parts = trimmed.split(':')
      if (parts.length > 0) {
        if (await fileExistsAsync(parts[0], true)) {
          return parts[0]
        }
      }
    }
  }
  throw new Error(`Cannot find font matching spec: "${spec}"`)
}
