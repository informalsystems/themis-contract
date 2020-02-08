
import { KeybaseError } from './errors'
import { spawnAsync } from './async-io'

export const keybaseWhoami = async (): Promise<string> => {
  const keybase = await spawnAsync('keybase', ['whoami'])
  if (keybase.status && keybase.status !== 0) {
    throw new KeybaseError(`"keybase whoami" exited with status code ${keybase.status}`)
  }
  return keybase.stdout.trim()
}

export type KeybaseKeyInfo = {
  id: string;
  pgpFingerprint: string;
  identities: string[];
}

export const keybaseKeyDesc = (key: KeybaseKeyInfo): string => {
  const tooManyIdentities = key.identities.length > 2
  const identities = tooManyIdentities ? key.identities.slice(0, 2) : key.identities
  return `${key.id.substr(0, 16)}... for ${identities.join(', ')}${tooManyIdentities ? '...' : ''}`
}

const emptyKeybaseKeyInfo = (): KeybaseKeyInfo => {
  return {
    id: '',
    pgpFingerprint: '',
    identities: [],
  }
}

export const keybaseListKeys = async (): Promise<KeybaseKeyInfo[]> => {
  const keybase = await spawnAsync('keybase', ['pgp', 'list'])
  if (keybase.status && keybase.status !== 0) {
    throw new KeybaseError(`"keybase pgp list" exited with status code ${keybase.status}`)
  }
  const lines = keybase.stdout.split('\n')
  const result: KeybaseKeyInfo[] = []
  let curKeyInfo = emptyKeybaseKeyInfo()
  let matchingIdentities = false

  for (const line of lines) {
    const lineTrimmed = line.trim()
    if (matchingIdentities) {
      if (lineTrimmed.length === 0) {
        matchingIdentities = false
        result.push(curKeyInfo)
        curKeyInfo = emptyKeybaseKeyInfo()
        continue
      }
      curKeyInfo.identities.push(lineTrimmed)
    }
    let match = /^Keybase Key ID:\s+([0-9a-f]+)$/.exec(lineTrimmed)
    if (match) {
      curKeyInfo.id = match[1]
      continue
    }
    match = /^PGP Fingerprint:\s+([0-9a-f]+)$/.exec(lineTrimmed)
    if (match) {
      curKeyInfo.pgpFingerprint = match[1]
      continue
    }
    if (/^PGP Identities:$/.test(line)) {
      matchingIdentities = true
    }
  }
  return result
}
