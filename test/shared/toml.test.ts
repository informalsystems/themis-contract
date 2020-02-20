import * as assert from 'assert'
import { TOML } from '../../src/shared/toml'

const assertArraysEqual = (actual: any[], expected: any[], assertObjectsEqual: Function) => {
  assert.strictEqual(actual.length, expected.length)
  for (let i = 0; i < actual.length; i++) {
    if (Array.isArray(actual[i])) {
      assertArraysEqual(actual[i], expected[i], assertObjectsEqual)
    } else if (typeof actual[i] === 'object') {
      assertObjectsEqual(actual[i], expected[i])
    } else {
      assert.strictEqual(actual[i], expected[i])
    }
  }
}

const onlyOwnProperties = (obj: any): Function => {
  return (value: string): boolean => {
    return Object.prototype.hasOwnProperty.call(obj, value)
  }
}

const assertObjectsEqual = (actual: any, expected: any) => {
  const actualFieldNames = Object.keys(actual).filter(onlyOwnProperties).sort()
  const expectedFieldNames = Object.keys(expected).filter(onlyOwnProperties).sort()
  assertArraysEqual(actualFieldNames, expectedFieldNames, assertObjectsEqual)
  actualFieldNames.forEach(fieldName => {
    const actualVal = actual[fieldName]
    const expectedVal = expected[fieldName]
    if (Array.isArray(actualVal)) {
      assertArraysEqual(actualVal, expectedVal, assertObjectsEqual)
    } else if (typeof actualVal === 'object') {
      assertObjectsEqual(actualVal, expectedVal)
    } else {
      assert.strictEqual(actualVal, expectedVal)
    }
  })
}

describe('TOML.stringify()', () => {
  describe('simple primitives only', () => {
    it('should result in same object when parsed', () => {
      const obj = {
        a_string: 'string value',
        an_int: 1,
        a_float: 5.1,
        a_boolean: true,
      }
      const s = TOML.stringify(obj)
      const parsed = TOML.parse(s)
      assertObjectsEqual(parsed, obj)
    })
  })

  describe('single nested object', () => {
    it('should result in same object when parsed', () => {
      const obj = {
        a_string: 'string value',
        an_obj: {
          obj_string: 'object string',
          obj_int: 2,
        },
      }
      const s = TOML.stringify(obj)
      const parsed = TOML.parse(s)
      assertObjectsEqual(parsed, obj)
    })
  })

  describe('arrays of primitives', () => {
    it('should result in same object when parsed', () => {
      const obj = {
        number_array: [1, 2, 3, 4, 5],
        string_array: ['apple', 'banana', 'carrot'],
        float_array: [1.1, 2.2, 3.3],
      }
      const s = TOML.stringify(obj)
      const parsed = TOML.parse(s)
      assertObjectsEqual(parsed, obj)
    })
  })

  describe('complex TOML source file', () => {
    it('should result in same object when parsed', () => {
      const obj = {
        a_string: 'string value',
        an_int: 1,
        a_float: 5.1,
        a_boolean: true,
        a_date: new Date(),
        an_int_array: [1, 2, 3, 4, 5],
        a_string_array: ['apple', 'banana', 'orange'],
        an_object_array: [{apple: 1}, {banana: 2}],
        sub_obj: {
          sub_string: 'level 1 string',
          sub_int: 2,
          sub_int_array: [1, 2, 3],
          sub_object_array: [{dogs: 1}, {cats: 2}],
          sub_sub_obj: {
            sub_sub_string: 'level 2 string',
            sub_sub_int: 3,
          },
        },
      }

      const s = TOML.stringify(obj)
      const parsed = TOML.parse(s)
      assertObjectsEqual(parsed, obj)
    })
  })
})
