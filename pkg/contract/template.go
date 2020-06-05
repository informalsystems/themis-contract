package contract

// TemplateFormat is a string-based enumeration type.
type TemplateFormat string

// For this version of the prototype, we currently only support Mustache
// templating.
// TODO: Consider whether Handlebars support is actually required.
// TODO: Consider Jinja2-like support (e.g. Pongo2: https://github.com/flosch/pongo2).
const (
	Mustache TemplateFormat = "Mustache"
)

// Template refers to the contract text template to use when rendering a
// contract.
type Template struct {
	Format TemplateFormat `json:"format" yaml:"format" toml:"format"`
	File   *FileRef       `json:"file" yaml:"file" toml:"file"`
}
