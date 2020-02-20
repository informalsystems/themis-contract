import { URL } from 'url'

export class ParserError extends Error { }

/**
 * Allows us to represent Git URLs (not WHATWG-compatible).
 */
export class GitURL {
  protocols: string[] = []

  username = ''

  password = ''

  host = ''

  port = ''

  path = ''

  hash = ''

  static parse(url: string): GitURL {
    const result = new GitURL()

    const protoURLSplit = url.split('://', 2)
    if (protoURLSplit.length !== 2) {
      throw new ParserError(`Malformed URL (missing protocol separator): ${url}`)
    }
    const protocols = protoURLSplit[0].split('+')
    result.protocols = protocols

    // Non-SSH variant of Git URL - use standard parser
    if (protocols.indexOf('https') >= 0) {
      const u = new URL(`https://${protoURLSplit[1]}`)
      result.username = u.username
      result.password = u.password
      result.host = u.hostname
      result.port = u.port
      result.path = u.pathname
      result.hash = u.hash.startsWith('#') ? u.hash.substr(1) : u.hash
      return result
    }

    const authURLSplit = protoURLSplit[1].split('@', 2)
    let hostPortPath = authURLSplit[0]
    // if we have auth details at all
    if (authURLSplit.length > 1) {
      const usernamePasswordSplit = authURLSplit[0].split(':', 2)
      result.username = usernamePasswordSplit[0]
      if (usernamePasswordSplit.length > 1) {
        result.password = usernamePasswordSplit[1]
      }
      hostPortPath = authURLSplit[1]
    }

    const hostPortPathSplit = hostPortPath.split(':', 3)
    let pathHash = ''
    if (hostPortPathSplit.length === 0) {
      throw new ParserError(`Invalid host:port:path for SSH URL: ${hostPortPath}`)
    }
    result.host = hostPortPathSplit[0]
    if (hostPortPathSplit.length === 2) {
      pathHash = hostPortPathSplit[1]
    } else if (hostPortPathSplit.length === 3) {
      result.port = hostPortPathSplit[1]
      pathHash = hostPortPathSplit[2]
    } else if (hostPortPathSplit.length > 3) {
      throw new ParserError(`Too many colons in SSH URL: ${hostPortPath}`)
    }

    if (pathHash.length > 0) {
      const pathHashParts = pathHash.split('#', 2)
      result.path = pathHashParts[0]
      if (pathHashParts.length > 1) {
        result.hash = pathHashParts[1]
      }
    }
    return result
  }

  toString(): string {
    const protocols = this.protocols.join('+')
    const auth = this.username.length > 0 ? (this.password.length > 0 ? `${this.username}:${this.password}@` : `${this.username}@`) : ''
    const host = this.host + (this.port.length > 0 ? `:${this.port}` : '')
    const hash = this.hash.length > 0 ? `#${this.hash}` : ''
    return `${protocols}://${auth}${host}:${this.path}${hash}`
  }

  basePath(): string {
    const pathParts = this.path.split('/')
    let basePath = ''
    let partCount = 0
    for (const pathPart of pathParts) {
      if (partCount > 0) {
        basePath += '/'
      }
      basePath += pathPart
      partCount++
      if (pathPart.endsWith('.git') || partCount >= 2) {
        break
      }
    }
    return basePath
  }

  innerPath(): string {
    const innerPath = this.path.replace(this.basePath(), '')
    if (innerPath.startsWith('/')) {
      return innerPath.substr(1)
    }
    return innerPath
  }

  protocol(): string {
    for (const proto of this.protocols) {
      if (proto !== 'git') {
        return proto
      }
    }
    return 'ssh'
  }

  /**
   * @returns {string} The URL of the base repository (no path or hash).
   */
  repository(): string {
    return `${this.username}@${this.host}${this.port.length > 0 ? ':' + this.port : ''}:${this.basePath()}`
  }
}

export const isGitURL = (url: string): boolean => {
  return url.split('://')[0].split('+').indexOf('git') >= 0
}
