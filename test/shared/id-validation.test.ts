import * as assert from 'assert'
import { isValidID } from '../../src/shared/cli-helpers'

describe('isValidID()', () => {
  it('should validate: simple_snake_case', () => {
    assert.strictEqual(isValidID('simple_snake_case'), true)
  })
  it('should validate: justoneword', () => {
    assert.strictEqual(isValidID('justoneword'), true)
  })
  it('should validate: WithCaps', () => {
    assert.strictEqual(isValidID('WithCaps'), true)
  })
  it('should validate: WithCapsAnd12345', () => {
    assert.strictEqual(isValidID('WithCapsAnd12345'), true)
  })
  it('should invalidate: 0123startswithdigits', () => {
    assert.strictEqual(isValidID('0123startswithdigits'), false)
  })
  it('should invalidate: has spaces', () => {
    assert.strictEqual(isValidID('has spaces'), false)
  })
  it('should invalidate: is-kebab-case', () => {
    assert.strictEqual(isValidID('is-kebab-case'), false)
  })
  it('should invalidate: contains#special%chars', () => {
    assert.strictEqual(isValidID('contains#special%chars'), false)
  })
})
