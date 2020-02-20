import * as assert from 'assert'
import { Contract, TemplateFormat } from '../../src/shared/contract'
import * as tmp from 'tmp'
import * as path from 'path'
import { writeFileAsync } from '../../src/shared/async-io'
import { computeContentHash } from '../../src/shared/document-cache'

const TEST_TEMPLATE_CORRECT = `<h1>Correct Contract</h1>
<p>Effective {{date}}</p>

{{#each counterparties}}
  <p>Signed by {{this.full_name}}</p>
  {{#each this.signatories}}
    <p>{{#has_signed this}}<img src="{{this.signature_image}}">{{else}}Not yet signed{{/has_signed}}</p>
    <p>{{this.full_names}}</p>
  {{/each}}
{{/each}}
`

const TEST_CONTRACT_CORRECT = `date = "1 January 2020"
counterparties = [
  "client",
  "supplier"
]

[template]
source = "./contract.html"
format = "mustache"
hash = "${computeContentHash(TEST_TEMPLATE_CORRECT)}"

[client]
full_name = "Company XYZ"
signatories = [
  "client_sig01"
]

[client_sig01]
full_names = "Client Sig01"

[supplier]
full_name = "ABC Limited"
signatories = [
  "supplier_sig01"
]

[supplier_sig01]
full_names = "Supplier Sig01"
`

describe('Contract', () => {
  describe('#loadFromFile()', () => {
    it('should parse a well-formed contract and template', async () => {
      const tmpDir = tmp.dirSync()
      const tmpTemplate = path.join(tmpDir.name, 'contract.html')
      const tmpContract = path.join(tmpDir.name, 'contract.toml')
      await writeFileAsync(tmpTemplate, TEST_TEMPLATE_CORRECT)
      await writeFileAsync(tmpContract, TEST_CONTRACT_CORRECT)
      const contract = await Contract.fromFile(tmpContract)
      tmpDir.removeCallback()

      if (!contract.template) {
        throw new Error('Contract template is undefined')
      }
      assert.strictEqual(contract.template.src, tmpTemplate)
      assert.strictEqual(contract.template.format, TemplateFormat.Mustache)
      assert.strictEqual(contract.counterparties.size, 2)
      const client = contract.counterparties.get('client')
      if (!client) {
        throw new Error('Expected "client" counterparty')
      }
      assert.strictEqual(client.id, 'client')
      assert.strictEqual(client.fullName, 'Company XYZ')
      assert.strictEqual(client.signatories.size, 1)

      const supplier = contract.counterparties.get('supplier')
      if (!supplier) {
        throw new Error('Expected "supplier" counterparty')
      }
      assert.strictEqual(supplier.id, 'supplier')
      assert.strictEqual(supplier.fullName, 'ABC Limited')
      assert.strictEqual(supplier.signatories.size, 1)
    })
  })
})
