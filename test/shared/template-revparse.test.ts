import * as assert from 'assert'
import { extractHandlebarsTemplateVariables, extractMustacheTemplateVariables } from '../../src/shared/template-helpers'

const handlebarsTemplate = `Here's a basic Handlebars template.

There are {{several}} simple {{variables}} in it.

There are also {{several}} {{more.complex}} variables too.

We could even add {{#if statements}}right here{{/if}}.
`

const mustacheTemplate = `Here's a basic Mustache template.

There are {{several}} simple {{variables}} in it.

There are also {{several}} {{more.complex}} variables too.

If we wanted to, we could add {{#conditional}}with {{inner}}{{/conditional}} variables.
`

const mustacheTemplateCustomDelimiters = `Here's a basic Mustache template.

There are <<several>> simple <<variables>> in it.

There are also <<several>> <<more.complex>> variables too.

If we wanted to, we could add <<#conditional>>with <<inner>><</conditional>> variables.
`

describe('Handlebars reverse variable parsing', () => {
  it('should extract simple and complex variable names', () => {
    const vars = extractHandlebarsTemplateVariables(handlebarsTemplate)
    assert.strictEqual(vars.size, 4)
    assert.strictEqual(vars.has('several'), true)
    assert.strictEqual(vars.has('variables'), true)
    assert.strictEqual(vars.has('more'), true)
    assert.strictEqual(vars.has('statements'), true)
    assert.strictEqual(vars.get('more').has('complex'), true)
  })
})

describe('Mustache reverse variable parsing', () => {
  it('should extract simple and complex variables with standard delimiters', () => {
    const vars = extractMustacheTemplateVariables(mustacheTemplate)
    assert.strictEqual(vars.size, 4)
    assert.strictEqual(vars.has('several'), true)
    assert.strictEqual(vars.has('variables'), true)
    assert.strictEqual(vars.has('more'), true)
    assert.strictEqual(vars.has('conditional'), true)
    assert.strictEqual(vars.get('more').has('complex'), true)
  })

  it('should extract simple and complex variables with custom delimiters', () => {
    const vars = extractMustacheTemplateVariables(mustacheTemplateCustomDelimiters, ['<<', '>>'])
    assert.strictEqual(vars.size, 4)
    assert.strictEqual(vars.has('several'), true)
    assert.strictEqual(vars.has('variables'), true)
    assert.strictEqual(vars.has('more'), true)
    assert.strictEqual(vars.has('conditional'), true)
    assert.strictEqual(vars.get('more').has('complex'), true)
  })
})
