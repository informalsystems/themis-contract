import { Command } from '@oclif/command'
import { logger } from '../shared/logging'

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
