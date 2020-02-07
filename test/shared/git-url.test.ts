import * as assert from 'assert'
import { GitURL } from '../../src/shared/git-url'

describe('GitURL', () => {
  describe('#parse()', () => {
    describe('git://git@github.com:informalsystems/neat-contract.git', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git://git@github.com:informalsystems/neat-contract.git')
        assert.deepStrictEqual(url.protocols, ['git'])
        assert.strictEqual(url.username, 'git')
        assert.strictEqual(url.password, '')
        assert.strictEqual(url.host, 'github.com')
        assert.strictEqual(url.port, '')
        assert.strictEqual(url.path, 'informalsystems/neat-contract.git')
        assert.strictEqual(url.hash, '')
      })
    })

    describe('git://git@github.com:2222:informalsystems/neat-contract.git', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git://git@github.com:2222:informalsystems/neat-contract.git')
        assert.deepStrictEqual(url.protocols, ['git'])
        assert.strictEqual(url.username, 'git')
        assert.strictEqual(url.password, '')
        assert.strictEqual(url.host, 'github.com')
        assert.strictEqual(url.port, '2222')
        assert.strictEqual(url.path, 'informalsystems/neat-contract.git')
        assert.strictEqual(url.hash, '')
      })
    })

    describe('git://git@github.com:2222:informalsystems/neat-contract.git#v0.1.0', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git://git@github.com:2222:informalsystems/neat-contract.git#v0.1.0')
        assert.deepStrictEqual(url.protocols, ['git'])
        assert.strictEqual(url.username, 'git')
        assert.strictEqual(url.password, '')
        assert.strictEqual(url.host, 'github.com')
        assert.strictEqual(url.port, '2222')
        assert.strictEqual(url.path, 'informalsystems/neat-contract.git')
        assert.strictEqual(url.hash, 'v0.1.0')
      })
    })

    describe('git+ssh://git@github.com:2222:informalsystems/neat-contract.git#v0.1.0', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git+ssh://git@github.com:2222:informalsystems/neat-contract.git#v0.1.0')
        assert.deepStrictEqual(url.protocols, ['git', 'ssh'])
        assert.strictEqual(url.username, 'git')
        assert.strictEqual(url.password, '')
        assert.strictEqual(url.host, 'github.com')
        assert.strictEqual(url.port, '2222')
        assert.strictEqual(url.path, 'informalsystems/neat-contract.git')
        assert.strictEqual(url.hash, 'v0.1.0')
      })
    })

    describe('git+https://user:pass@somewhere.com:8000/some/path#hash', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git+https://user:pass@somewhere.com:8000/some/path#hash')
        assert.deepStrictEqual(url.protocols, ['git', 'https'])
        assert.strictEqual(url.username, 'user')
        assert.strictEqual(url.password, 'pass')
        assert.strictEqual(url.host, 'somewhere.com')
        assert.strictEqual(url.port, '8000')
        assert.strictEqual(url.path, '/some/path')
        assert.strictEqual(url.hash, 'hash')
      })
    })

    describe('git+https://user:pass@somewhere.com:8000/some/path', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git+https://user:pass@somewhere.com:8000/some/path')
        assert.deepStrictEqual(url.protocols, ['git', 'https'])
        assert.strictEqual(url.username, 'user')
        assert.strictEqual(url.password, 'pass')
        assert.strictEqual(url.host, 'somewhere.com')
        assert.strictEqual(url.port, '8000')
        assert.strictEqual(url.path, '/some/path')
        assert.strictEqual(url.hash, '')
      })
    })

    describe('git+https://somewhere.com/some/path', () => {
      it('should parse correctly', () => {
        const url = GitURL.parse('git+https://somewhere.com/some/path')
        assert.deepStrictEqual(url.protocols, ['git', 'https'])
        assert.strictEqual(url.username, '')
        assert.strictEqual(url.password, '')
        assert.strictEqual(url.host, 'somewhere.com')
        assert.strictEqual(url.port, '')
        assert.strictEqual(url.path, '/some/path')
        assert.strictEqual(url.hash, '')
      })
    })
  })
})
