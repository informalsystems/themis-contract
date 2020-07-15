package themis_contract

import "fmt"

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
// TODO: Use a list of files for the template as opposed to a single one to allow for complex templates.
type Template struct {
	Format TemplateFormat `json:"format" yaml:"format" toml:"format"`
	File   *FileRef       `json:"file" yaml:"file" toml:"file"`
}

func (t *Template) String() string {
	return fmt.Sprintf("Template{Format: \"%s\", File: %v}", t.Format, t.File)
}
