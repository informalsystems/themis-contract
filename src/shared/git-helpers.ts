import { spawnAsync } from './async-io'
import { logger } from './logging'

export const gitCheckout = async (localPath: string, ref: string) => {
  const git = await spawnAsync('git', ['checkout', ref], { cwd: localPath })
  logger.debug(`git stdout:\n${git.stdout}`)
  logger.debug(`git stderr:\n${git.stderr}`)
  if (git.status !== 0) {
    throw new Error(`Git checkout exited with status code: ${git.status}`)
  }
}

export const gitPullAll = async (localPath: string) => {
  // first we check out master before pulling anything
  await gitCheckout(localPath, 'master')
  const git = await spawnAsync('git', ['pull', '--all'], { cwd: localPath })
  logger.debug(`git stdout:\n${git.stdout}`)
  logger.debug(`git stderr:\n${git.stderr}`)
  if (git.status !== 0) {
    throw new Error(`Git pull exited with status code: ${git.status}`)
  }
}

export const gitClone = async (url: string, localPath: string) => {
  const git = await spawnAsync('git', ['clone', url, localPath])
  logger.debug(`git stdout:\n${git.stdout}`)
  logger.debug(`git stderr:\n${git.stderr}`)
  if (git.status !== 0) {
    throw new Error(`Git clone exited with status code: ${git.status}`)
  }
}
