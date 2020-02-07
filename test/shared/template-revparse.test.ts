import * as assert from 'assert'
import {extractTemplateVariables} from '../../src/shared/template-helpers'

const sampleTemplate = `Here's a basic Handlebars template.

There are {{several}} simple {{variables}} in it.

There are also {{several}} {{more.complex}} variables too.

We could even add {{#if statements}}right here{{/if}}.
`

describe('Handlebars reverse variable parsing', () => {
  it('should extract simple and complex variable names', () => {
    const vars = extractTemplateVariables(sampleTemplate)
    assert.strictEqual(vars.size, 4)
    assert.strictEqual(vars.has('several'), true)
    assert.strictEqual(vars.has('variables'), true)
    assert.strictEqual(vars.has('more'), true)
    assert.strictEqual(vars.has('statements'), true)
    assert.strictEqual(vars.get('more').has('complex'), true)
  })
})
