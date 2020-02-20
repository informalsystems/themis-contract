import * as openpgp from 'openpgp'
import { readFileAsync } from './async-io'
import { DEFAULT_TEXT_FILE_ENCODING } from './constants'
import * as moment from 'moment'

export const getSignatureTimestamp = async (detachedSigFile: string): Promise<moment.Moment> => {
  const content = await readFileAsync(detachedSigFile, { encoding: DEFAULT_TEXT_FILE_ENCODING })
  const sig = await openpgp.signature.readArmored(content)
  if (sig.packets.length === 0) {
    throw new Error(`No data in detached signature: ${detachedSigFile}`)
  }
  // TypeScript interface is wholly insufficient right now
  const packets: any = sig.packets
  return moment(packets[0].created)
}
