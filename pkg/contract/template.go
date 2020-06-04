package contract

import "fmt"

// TemplateFormat is a string-based enumeration type.
type TemplateFormat string

// For this version of the prototype, we currently only support Mustache
// templating.
// TODO: Consider whether Handlebars support is actually required.
// TODO: Consider Jinja2-like support (e.g. Pongo2: https://github.com/flosch/pongo2).
const (
	Mustache TemplateFormat = "mustache"
)

// Template refers to the contract text template to use when rendering a
// contract.
type Template struct {
	Format TemplateFormat `json:"format"`
	File   *FileRef       `json:"file"`
}

// PreloadTemplate parses the given template path, fetches the template remotely
// if necessary and caches it, computes its hash, and returns information about
// the template.
func PreloadTemplate(path string, tf TemplateFormat) (Template, error) {
	return Template{}, nil
}

// ParseTemplateFormat parses the given string and attempts to interpret it as
// a template format indicator.
func ParseTemplateFormat(tf string) (TemplateFormat, error) {
	switch tf {
	case string(Mustache):
		return Mustache, nil
	}
	return "", fmt.Errorf("invalid template format: %s", tf)
}

func (tf TemplateFormat) DhallId() string {
	switch tf {
	case Mustache:
		return "Mustache"
	}
	return ""
}
