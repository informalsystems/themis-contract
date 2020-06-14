package contract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"text/template"

	"github.com/BurntSushi/toml"
	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

// FileType indicates the file type of a contract.
type FileType string

const (
	DhallType FileType = "dhall"
	JSONType  FileType = "json"
	YAMLType  FileType = "yaml"
	TOMLType  FileType = "toml"
)

// TODO: Use URL source for Themis Contract Dhall package.
const DhallContractTemplate string = `{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = "../../config/package.dhall"

let contract : ThemisContract.Contract =
    { params =
        { location = "{{.ParamsFile.Location}}"
        , hash = "{{.ParamsFile.Hash}}"
        }
    , upstream =
		{ location = "{{.Upstream.Location}}"
		, hash = "{{.Upstream.Hash}}"
		}
    , template =
        { format = ThemisContract.TemplateFormat.{{.Template.Format}}
        , file =
            { location = "{{.Template.File.Location}}"
            , hash = "{{.Template.File.Hash}}"
            }
        }
    }

in contract
`

// Contract encapsulates all of the relevant data we need in order to deal with
// the contract (rendering, signature management, etc.).
type Contract struct {
	ParamsFile *FileRef  `json:"params" yaml:"params" toml:"params"`       // Where to find the parameters file for the contract.
	Template   *Template `json:"template" yaml:"template" toml:"template"` // The details of the contract text template to use when rendering the contract.
	Upstream   *FileRef  `json:"upstream" yaml:"upstream" toml:"upstream"` // The upstream contract from which this contract has been derived (if any).

	path        *FileRef               // The path to the contract (remote and/or local).
	fileType    FileType               // What type of file is the original contract file?
	params      map[string]interface{} // The parameters extracted from the parameters file.
	signatories []*Signatory           // Cached signatories extracted from the parameters.
}

// New creates a new contract in the configured path from the specified upstream
// contract.
func New(contractPath, upstreamLoc string, cache Cache) (*Contract, error) {
	if len(upstreamLoc) == 0 {
		return nil, fmt.Errorf("when creating a contract with the `new` command, an upstream contract must be supplied as a template")
	}

	// load (and optionally cache) the upstream contract
	upstream, err := Load(upstreamLoc, cache)
	if err != nil {
		return nil, err
	}
	log.Debug().Msg(fmt.Sprintf("Loaded upstream contract: %v", upstream))

	// derive a copy of the upstream contract in our local path
	contract, err := upstream.deriveTo(contractPath)
	if err != nil {
		return nil, err
	}

	return contract, nil
}

// Load will parse the contract at the given location into memory. If the
// location given is remote, the remote contract will be fetched and cached
// first prior to being opened.
func Load(loc string, cache Cache) (*Contract, error) {
	log.Info().Msgf("Attempting to load contract: %s", loc)
	entrypoint, err := ResolveFileRef(loc, cache)
	if err != nil {
		return nil, err
	}
	contract, err := parseFileRefAsContract(entrypoint)
	if err != nil {
		return nil, err
	}
	// see if we need to resolve the parameters file or the template relative
	// to the contract entrypoint
	if contract.ParamsFile.IsRelative() {
		contract.ParamsFile, err = ResolveRelFileRef(entrypoint, contract.ParamsFile, cache)
		if err != nil {
			return nil, err
		}
	}
	if contract.Template.File.IsRelative() {
		contract.Template.File, err = ResolveRelFileRef(entrypoint, contract.Template.File, cache)
		if err != nil {
			return nil, err
		}
	}
	// parse the parameters file
	contract.params, err = readContractParams(contract.ParamsFile.localPath)
	if err != nil {
		return nil, err
	}
	log.Debug().Msgf("Extracted contract parameters: %v", contract.params)
	// update signatories from the parameters
	contract.signatories, err = extractContractSignatories(contract.params)
	if err != nil {
		return nil, err
	}
	log.Debug().Msgf("Extracted contract signatories: %v", contract.signatories)
	return contract, nil
}

// Path returns the file reference for this contract.
func (c *Contract) Path() *FileRef {
	return c.path
}

// deriveTo will copy this contract to the given destination path. On success it
// returns the new configuration of the contract, with the paths updated.
func (c *Contract) deriveTo(destPath string) (*Contract, error) {
	log.Debug().Str("path", destPath).Msg("Ensuring contract destination path exists")
	// ensure the destination path exists
	if err := os.MkdirAll(destPath, 0755); err != nil {
		return nil, err
	}
	destContractFile := path.Join(destPath, c.path.Filename())
	destParamsFile := path.Join(destPath, c.ParamsFile.Filename())
	destTemplateFile := path.Join(destPath, c.Template.File.Filename())
	files := map[string]string{
		c.ParamsFile.localPath:    destParamsFile,
		c.Template.File.localPath: destTemplateFile,
	}
	for srcFile, destFile := range files {
		log.Debug().Msgf("Copying %s to %s", srcFile, destFile)
		if err := copyFile(srcFile, destFile); err != nil {
			return nil, err
		}
	}
	// generate the destination contract
	dest := &Contract{
		ParamsFile: &FileRef{
			Location:  path.Join(".", c.ParamsFile.Filename()),
			Hash:      c.ParamsFile.Hash,
			localPath: destParamsFile,
		},
		Template: &Template{
			Format: c.Template.Format,
			File: &FileRef{
				Location:  path.Join(".", c.Template.File.Filename()),
				Hash:      c.Template.File.Hash,
				localPath: destTemplateFile,
			},
		},
		Upstream: &FileRef{
			Location:  c.path.Location,
			Hash:      c.path.Hash,
			localPath: c.path.localPath,
		},
		path: &FileRef{
			Location:  destContractFile,
			Hash:      "",
			localPath: destContractFile,
		},
		fileType: c.fileType,
	}
	if err := dest.Save(); err != nil {
		return nil, err
	}
	var err error
	// update the file hash
	dest.path.Hash, err = hashOfFile(dest.path.localPath)
	if err != nil {
		return nil, err
	}
	return dest, nil
}

// Save will write the contract with its current configuration to its local
// path.
func (c *Contract) Save() error {
	log.Info().Msgf("Writing contract: %s", c.path.localPath)

	var content []byte
	err := fmt.Errorf("unrecognized file type: %s", c.fileType)

	switch c.fileType {
	case DhallType:
		tpl, err := template.New("contract").Parse(DhallContractTemplate)
		if err != nil {
			return err
		}

		f, err := os.Create(c.path.localPath)
		if err != nil {
			return err
		}
		defer f.Close()

		return tpl.Execute(f, c)

	case JSONType:
		content, err = json.Marshal(c)

	case YAMLType:
		content, err = yaml.Marshal(c)

	case TOMLType:
		var buf bytes.Buffer
		enc := toml.NewEncoder(&buf)
		err = enc.Encode(c)
		content = buf.Bytes()
	}
	if err != nil {
		return err
	}
	return ioutil.WriteFile(c.path.localPath, content, 0644)
}

// Compile takes a parsed contract and attempts to generate the output artifact
// that constitutes the final contract (as a PDF file).
func (c *Contract) Compile(output string) error {
	return nil
}

// SignAs attempts to sign the contract on behalf of the signatory with the
// given ID.
func (c *Contract) SignAs(themisHome, sigId string) error {
	return nil
}

func (c *Contract) Signatories() []*Signatory {
	return c.signatories
}

func (c *Contract) String() string {
	return fmt.Sprintf("Contract{ParamsFile: %v, Template: %v, Upstream: %v}", c.ParamsFile, c.Template, c.Upstream)
}

func parseFileRefAsContract(ref *FileRef) (*Contract, error) {
	origDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	// we have to chdir here to ensure that Dhall relative import resolution works
	if err := os.Chdir(ref.Dir()); err != nil {
		return nil, err
	}
	// try to reset the working directory
	defer os.Chdir(origDir)

	var contract *Contract

	switch ref.Ext() {
	case ".dhall":
		contract, err = parseDhallContract(ref.localPath)
	case ".json":
		contract, err = parseJSONContract(ref.localPath)
	case ".toml":
		contract, err = parseTOMLContract(ref.localPath)
	case ".yml", ".yaml":
		contract, err = parseYAMLContract(ref.localPath)
	default:
		return nil, fmt.Errorf("unrecognized contract format with extension \"%s\"", ref.Ext())
	}
	if err != nil {
		return nil, err
	}
	contract.path = ref
	return contract, nil
}

// The Dhall library for Golang doesn't seem to handle deserialization of
// optional records into structs quite well, so for the time being we'll be
// converting the Dhall contract to JSON first and then parsing it from JSON.
func parseDhallContract(filename string) (*Contract, error) {
	log.Debug().Msgf("Converting Dhall file to JSON: %s", filename)
	content, err := exec.Command("dhall-to-json", "--file", filename).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to convert Dhall file %s to JSON: %v", filename, err)
	}
	contract := &Contract{}
	if err := json.Unmarshal(content, contract); err != nil {
		return nil, err
	}
	contract.fileType = DhallType
	return contract, nil
}

func parseJSONContract(filename string) (*Contract, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	contract := &Contract{}
	if err := json.Unmarshal(content, contract); err != nil {
		return nil, err
	}
	contract.fileType = JSONType
	return contract, nil
}

func parseYAMLContract(filename string) (*Contract, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	contract := &Contract{}
	if err := yaml.Unmarshal(content, contract); err != nil {
		return nil, err
	}
	contract.fileType = YAMLType
	return contract, nil
}

func parseTOMLContract(filename string) (*Contract, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	contract := &Contract{}
	if err := toml.Unmarshal(content, contract); err != nil {
		return nil, err
	}
	contract.fileType = TOMLType
	return contract, nil
}

func readContractParams(filename string) (map[string]interface{}, error) {
	var content []byte
	var err error
	params := make(map[string]interface{})
	ext := path.Ext(filename)
	switch ext {
	case ".dhall":
		log.Debug().Msgf("Converting params file from Dhall to JSON: %s", filename)
		content, err = exec.Command("dhall-to-json", "--file", filename).CombinedOutput()
		log.Debug().Msgf("dhall-to-json output:\n%s\n", content)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Dhall file %s to JSON: %v", filename, err)
		}

	case ".json", ".yml", ".yaml", ".toml":
		content, err = ioutil.ReadFile(filename)

	default:
		return nil, fmt.Errorf("unrecognized file format for parameters file: %s", ext)
	}
	if err != nil {
		return nil, err
	}
	switch ext {
	case ".dhall", ".json":
		err = json.Unmarshal(content, &params)
	case ".yml", ".yaml":
		err = yaml.Unmarshal(content, &params)
	case ".toml":
		err = toml.Unmarshal(content, &params)
	}
	if err != nil {
		return nil, err
	}
	return params, nil
}

// We extract signatories by grabbing the "signatories" field, marshalling it
// to JSON, and then unmarshalling it into our desired array of Signatory
// instances. Inefficient, but it works and it was quick to code.
func extractContractSignatories(params map[string]interface{}) ([]*Signatory, error) {
	sigs, exists := params["signatories"]
	if !exists {
		return nil, fmt.Errorf("missing field \"signatories\" in contract parameters")
	}
	// convert the signatories entry to JSON
	sigsJSON, err := json.Marshal(sigs)
	if err != nil {
		return nil, err
	}
	var result []*Signatory
	// now unmarshal the JSON as our resultant array
	if err := json.Unmarshal(sigsJSON, &result); err != nil {
		return nil, err
	}
	return result, nil
}
