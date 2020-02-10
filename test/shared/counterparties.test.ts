import * as assert from 'assert'
import { Counterparty } from '../../src/shared/counterparties'
import * as tmp from 'tmp'
import * as path from 'path'
import { writeFileAsync } from '../../src/shared/async-io'

const TEST_COUNTERPARTY = `full_name = "Counterparty A"
signatories = [
  "sig01",
  "sig02"
]

[sig01]
full_names = "Signatory 01"
keybase_id = "signatory01"

[sig02]
full_names = "Signatory 02"
keybase_id = "signatory02"
`

describe('Counterparty', async () => {
  describe('#loadFromFile()', async () => {
    const tmpDir = tmp.dirSync()
    const tmpFilename = path.join(tmpDir.name, 'cp01.toml')
    await writeFileAsync(tmpFilename, TEST_COUNTERPARTY)
    const counterparty = await Counterparty.loadFromFile(tmpFilename)
    tmpDir.removeCallback()

    assert.strictEqual(counterparty.id, 'cp01')
    assert.strictEqual(counterparty.fullName, 'Counterparty A')
    assert.strictEqual(counterparty.signatories.size, 2)
    const sig01 = counterparty.signatories.get('sig01')
    if (!sig01) {
      throw new Error('Expected sig01 to be defined')
    }
    assert.strictEqual(sig01.id, 'sig01')
    assert.strictEqual(sig01.fullNames, 'Signatory 01')
    assert.strictEqual(sig01.keybaseId, 'signatory01')
    const sig02 = counterparty.signatories.get('sig02')
    if (!sig02) {
      throw new Error('Expected sig02 to be defined')
    }
    assert.notStrictEqual(sig02, undefined)
    assert.strictEqual(sig02.id, 'sig02')
    assert.strictEqual(sig02.fullNames, 'Signatory 02')
    assert.strictEqual(sig02.keybaseId, 'signatory02')
  })
})
