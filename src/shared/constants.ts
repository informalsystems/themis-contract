import * as path from 'path'
import * as os from 'os'

export const DEFAULT_TEXT_FILE_ENCODING = 'utf8'
export const DEFAULT_CONTRACT_FILENAME = 'contract.html'
export const DEFAULT_CONTRACT_TEMPLATE = `<h1>New Contract</h1>
<p>Created on {{date}}. Start adding your contract content here.</p>`
export const DEFAULT_PARAMS_FILENAME = 'params.toml'
export const DEFAULT_PDF_FONT = 'Helvetica'
export const DEFAULT_PDF_ENGINE = 'tectonic'

export const DEFAULT_PROFILE_PATH = path.join(os.homedir(), '.neat', 'contract')

// We store cached templates in this folder, where the names of the files are
// MD5 hashes (in hex) of their source paths. This allows us to track many
// different sources' templates in a single flat folder.
export const templateCachePath = (profilePath: string): string => {
  return path.join(profilePath, 'templates')
}

export const counterpartyDBPath = (profilePath: string): string => {
  return path.join(profilePath, 'counterparties')
}

export const DEFAULT_TOML_INDENT = 2
export const DEFAULT_TOML_INDENT_SECTIONS = false
