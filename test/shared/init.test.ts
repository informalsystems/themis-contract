import * as assert from 'assert'
import * as init from '../../src/shared/init'
import * as tmp from 'tmp'
import * as path from 'path'
import { fileExistsAsync, writeFileAsync, readFileAsync } from '../../src/shared/async-io'

const assertFileExists = async (file: string) => {
  assert.strictEqual(await fileExistsAsync(file), true, `file ${file} was not created`)
}

const writeDummyFiles  = async (dir: string, content: string) => {
  const files: string[] = []
  for (const e of Object.entries(init.FILES_TO_INSTALL)) {
    const dest = path.join(dir, e[1])
    await writeFileAsync(dest, content)
    files.push(dest)
  }
  return files
}

describe('Init', () => {
  describe('#run', () => {
    it('should install the expected resources', async () => {
      const tmpDir = tmp.dirSync()
      await init.run(tmpDir.name, false)

      for (const e of Object.entries(init.FILES_TO_INSTALL)) {
        await assertFileExists(path.join(tmpDir.name, e[1]))
      }

      tmpDir.removeCallback()
    })

    it('should not overwrite existing configurations', async () => {
      const dummyContent = 'SOME CONTENT'
      const tmpDir = tmp.dirSync()

      const files = await writeDummyFiles(tmpDir.name, dummyContent)
      await init.run(tmpDir.name, false)

      // Ensure the file content HAS NOT changed
      for (let i = 0; i < files.length; i++) {
        const content = (await readFileAsync(files[i])).toString()
        assert.strictEqual(dummyContent, content, `Expected ${dummyContent} but found ${content}`)
      }

      tmpDir.removeCallback()
    })

    it('should overwrite existing configurations when reset flag is true', async () => {
      const dummyContent = 'SOME CONTENT'
      const tmpDir = tmp.dirSync()

      const files = await writeDummyFiles(tmpDir.name, dummyContent)
      await init.run(tmpDir.name, true)

      // Ensure the file content HAS changed
      for (let i = 0; i < files.length; i++) {
        const content = (await readFileAsync(files[i])).toString()
        assert.notStrictEqual(dummyContent, content, `Found unexpected ${dummyContent}`)
      }

      tmpDir.removeCallback()
    })
  })
})
