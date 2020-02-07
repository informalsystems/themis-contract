import { logger } from '../shared/logging'

export const cliWrap = async (verbose: boolean, fn: Function) => {
  logger.level = verbose ? 'debug' : 'info'
  try {
    await fn()
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`${error.message}\n${error.stack}`)
    } else {
      logger.error(`${error}`)
    }
  }
}
