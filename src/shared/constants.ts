import * as path from 'path'
import * as os from 'os'

export const DEFAULT_TEXT_FILE_ENCODING = 'utf8'
export const DEFAULT_CONTRACT_FILENAME = 'contract.html'
export const DEFAULT_CONTRACT_TEMPLATE = `<h1>New Contract</h1>
<p>Created on {{date}}. Start adding your contract content here.</p>`
export const DEFAULT_PARAMS_FILENAME = 'params.toml'
export const DEFAULT_TEMPLATE_EXT = '.md'

export const HOMEDIR = os.homedir()
export const DEFAULT_PROFILE_PATH = path.join(HOMEDIR, '.themis', 'contract')
export const DEFAULT_PANDOC_DEFAULTS_FILE = path.join(HOMEDIR, '.themis', 'pandoc-defaults.yaml')

// We store cached templates in this folder, where the names of the files are
// MD5 hashes (in hex) of their source paths. This allows us to track many
// different sources' templates in a single flat folder.
export const templateCachePath = (profilePath: string): string => {
  return path.join(profilePath, 'templates')
}

export const counterpartyDBPath = (profilePath: string): string => {
  return path.join(profilePath, 'counterparties')
}

export const identityDBPath = (profilePath: string): string => {
  return path.join(profilePath, 'identities')
}

export const gitRepoCachePath = (profilePath: string): string => {
  return path.join(profilePath, 'cached-repos')
}
export const DEFAULT_GIT_REPO_CACHE_PATH = gitRepoCachePath(DEFAULT_PROFILE_PATH)

export const DEFAULT_TOML_INDENT = 2
export const DEFAULT_TOML_INDENT_SECTIONS = false

export const VALID_ID_FORMAT = /^[a-zA-Z](\w+)$/

export const RESERVED_TEMPLATE_VARS = [
  'contract_path',
  'counterparties_list',
  'hash',
]

export const DEFAULT_SIGNATURE_HASH_FONT = 'Roboto:style=Regular'

// Available from https://fonts.google.com/specimen/Sacramento
export const DEFAULT_SIGNATURE_FONT = 'Sacramento:style=Regular'
