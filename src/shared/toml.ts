import { TomlReader } from '@sgarciac/bombadil'
import { readFileAsync, writeFileAsync } from './async-io'
import { DEFAULT_TEXT_FILE_ENCODING, DEFAULT_TOML_INDENT, DEFAULT_TOML_INDENT_SECTIONS } from './constants'

export class TOMLParserError extends Error {}

export type TOMLStringifyOptions = {
  indent?: number;
  indentSections?: boolean;
}

export class TOML {
  /**
   * A wholly insufficient, hacky, insecure TOML serializer. Purely prototype
   * material.
   * @param {any} data The data to serialize.
   * @param {TOMLStringifyOptions | undefined} opts Optional indentation (space) count.
   * @returns {string} The serialized TOML content as a string.
   */
  static stringify(data: any, opts?: TOMLStringifyOptions): string {
    if (Array.isArray(data) || typeof data !== 'object') {
      throw new TypeError('TOML.stringify() can only be called on objects')
    }
    const indent = opts ? (opts.indent ? opts.indent : DEFAULT_TOML_INDENT) : DEFAULT_TOML_INDENT
    const indentSections = opts ? (opts.indentSections === undefined ? DEFAULT_TOML_INDENT_SECTIONS : opts.indentSections) : DEFAULT_TOML_INDENT_SECTIONS
    return TOML.recursiveStringify(data, [], indent, indentSections)
  }

  static parse(s: string): any {
    const reader = new TomlReader()
    reader.readToml(s)
    if (reader.errors.length > 0) {
      if (reader.errors.length === 1) {
        throw reader.errors[0]
      }
      throw new TOMLParserError(`Got ${reader.errors.length} error during TOML parsing:\n${reader.errors.join('\n')}`)
    }
    return reader.result
  }

  private static recursiveStringify(data: any, sections: string[], indent: number, indentSections: boolean): string {
    const nesting = indentSections ? sections.length : 0
    const i = ''.padEnd(indent * nesting, ' ')
    // we keep track of properties for this level separately to objects
    let properties = ''
    let objs = ''
    for (const fieldName in data) {
      if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
        const val = data[fieldName]
        // skip undefined/nulls
        if (val === undefined || val === null) {
          continue
        }
        let prop = ''
        switch (typeof val) {
        case 'string':
          prop = TOML.serializeString(val)
          break
        case 'number':
        case 'boolean':
          prop = `${val}`
          break
        case 'bigint':
          prop = `"${val}"`
          break
        case 'object':
          if (Array.isArray(val)) {
            prop = TOML.serializeArray(val, i, indent, false)
          } else if (val instanceof Date) {
            prop = TOML.serializeDate(val)
          } else {
            objs += TOML.recursiveStringify(val, [...sections, fieldName], indent, indentSections) + '\n'
          }
          break
        }
        if (prop.length > 0) {
          properties += `${i}${fieldName} = ${prop}\n`
        }
      }
    }

    const sectionHeader = sections.length > 0 ? `${i}[${sections.join('.')}]\n` : ''
    return `${sectionHeader}${properties}\n${objs}`
  }

  private static serializeString(s: string): string {
    if (s.indexOf('\n') >= 0) {
      return `"""${s.replace(/\[^\\\]"""/g, '\\"""')}"""`
    }
    return `"${s.replace(/\[^\\\]"/g, '\\"')}"`
  }

  private static serializeArray(a: any[], pad: string, indent: number, inline: boolean): string {
    if (a.length === 0) {
      return '[]'
    }
    const i = inline ? '' : pad + ''.padEnd(indent, ' ')
    const inner: string[] = []
    for (const v of a) {
      switch (typeof v) {
      case 'string':
        inner.push(`${i}${TOML.serializeString(v)}`)
        break
      case 'number':
      case 'boolean':
        inner.push(`${i}${v}`)
        break
      case 'bigint':
        inner.push(`${i}"${v}"`)
        break
      case 'object':
        // nested array
        if (Array.isArray(v)) {
          inner.push(`${i}${TOML.serializeArray(v, i, indent, inline)}`)
        } else if (v instanceof Date) {
          inner.push(`${i}${TOML.serializeDate(v)}`)
        } else {
          inner.push(`${i}${TOML.serializeInlineObject(v)}`)
        }
      }
    }
    return inline ? `[${inner.join(', ')}]` : `[\n${inner.join(',\n')}\n${pad}]`
  }

  private static serializeInlineObject(a: any): string {
    const nameVals: string[] = []
    for (const fieldName in a) {
      if (Object.prototype.hasOwnProperty.call(a, fieldName)) {
        const v = a[fieldName]
        switch (typeof v) {
        case 'string':
          nameVals.push(`${fieldName} = ${TOML.serializeString(v)}`)
          break
        case 'number':
        case 'boolean':
          nameVals.push(`${fieldName} = ${v}`)
          break
        case 'bigint':
          nameVals.push(`${fieldName} = "${v}"`)
          break
        case 'object':
          // nested inline array
          if (Array.isArray(v)) {
            nameVals.push(`${fieldName} = ${TOML.serializeArray(v, '', 0, true)}`)
          } else if (v instanceof Date) {
            nameVals.push(`${fieldName} = ${TOML.serializeDate(v)}`)
          } else {
            nameVals.push(`${fieldName} = ${TOML.serializeInlineObject(v)}`)
          }
        }
      }
    }
    return `{${nameVals.join(', ')}}`
  }

  private static serializeDate(d: Date): string {
    // return standard ISO format
    return d.toISOString()
  }
}

/**
 * Parse a TOML file (async) into memory as an object.
 * @param {string} filename The file from which to read the TOML data.
 * @param {string} encoding Optional encoding to use. Default: `utf8`.
 */
export const readTOMLFileAsync = async (filename: string, encoding?: string): Promise<any> => {
  return TOML.parse(
    await readFileAsync(
      filename,
      { encoding: encoding ? encoding : DEFAULT_TEXT_FILE_ENCODING },
    ),
  )
}

/**
 * Serializes data into TOML format and writes it to the specified file.
 * @param {string} filename The file to which to write the TOML.
 * @param {string} data The data (object) to write to the file.
 * @param {string} encoding Optional encoding to use. Default: `utf8`.
 */
export const writeTOMLFileAsync = async (filename: string, data: any, encoding?: string) => {
  return writeFileAsync(
    filename,
    TOML.stringify(data),
    { encoding: encoding ? encoding : DEFAULT_TEXT_FILE_ENCODING },
  )
}
