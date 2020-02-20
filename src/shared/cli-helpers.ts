import { Command } from '@oclif/command'
import { logger } from '../shared/logging'
import { VALID_ID_FORMAT } from './constants'

export const cliWrap = async (cmd: Command, verbose: boolean, fn: Function) => {
  logger.level = verbose ? 'debug' : 'info'
  try {
    await fn()
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message + (verbose ? `\n${error.stack}` : ''))
    } else {
      logger.error(`${error}`)
    }
    cmd.exit(1)
  }
}

export const longestFieldLength = (a: any[], fieldName: string): number => {
  if (a.length === 0) {
    return 0
  }
  return a.map(v => v ? `${v[fieldName]}`.length : 0).reduce((prev, cur) => {
    return (cur > prev) ? cur : prev
  }, 0)
}

export const isValidID = (id: string): boolean => {
  return VALID_ID_FORMAT.test(id) && id.indexOf('__') === -1
}

export const parseID = (id: string): string => {
  if (!isValidID(id)) {
    throw new Error(`Invalid format for ID: "${id}"`)
  }
  return id
}
