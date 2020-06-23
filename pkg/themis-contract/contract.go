package themis_contract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"strings"
	"text/template"

	"github.com/BurntSushi/toml"
	"github.com/alexkappa/mustache"
	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"

	_ "github.com/informalsystems/themis-contract/pkg/themis-contract/statik"
)

// FileType indicates the file type of a contract.
type FileType string

const (
	DhallType FileType = "dhall"
	JSONType  FileType = "json"
	YAMLType  FileType = "yaml"
	TOMLType  FileType = "toml"
)

const (
	gitMsgNewContract string = `Add new contract

Add contract derived from upstream at {{.Upstream.Location}}`

	gitMsgUpdateContract string = `Update contract

Update contract with upstream at {{.Upstream.Location}} (hash {{.Upstream.Hash}}) and Template at {{.Template.File.Location}} (hash {{.Template.File.Hash}})`

	gitMsgSignContract string = `Sign contract

Sign the contract {{.ContractFile}} with hash {{.ContractHash}} (signatory e-mail: {{.Email}})
`
)

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
func New(contractPath, upstreamLoc string, ctx *Context) (*Contract, error) {
	if len(upstreamLoc) == 0 {
		return nil, fmt.Errorf("when creating a contract with the `new` command, an upstream contract must be supplied as a template")
	}

	// load (and optionally cache) the upstream contract
	upstream, err := Load(upstreamLoc, ctx)
	if err != nil {
		return nil, err
	}
	log.Debug().Msg(fmt.Sprintf("Loaded upstream contract: %v", upstream))

	// derive a copy of the upstream contract in our local path
	contract, err := upstream.deriveTo(contractPath, ctx)
	if err != nil {
		return nil, err
	}

	if ctx.autoCommit {
		if !isGitRepo(contractPath) {
			log.Info().Msgf("Initializing Git repository in contract folder: %s", contractPath)
			if err := gitInit(contractPath); err != nil {
				return nil, fmt.Errorf("failed to initialize Git repository in contract folder: %s", err)
			}
		} else {
			log.Info().Msgf("Contract folder %s is already within a Git repository", contractPath)
		}
		if err := gitAddAndCommit(contractPath, contract.allLocalRelativeFiles(), gitMsgNewContract, contract); err != nil {
			return nil, fmt.Errorf("failed to auto-commit change to contract repo: %s", err)
		}
	}

	return contract, nil
}

// Load will parse the contract at the given location into memory. If the
// location given is remote, the remote contract will be fetched and cached
// first prior to being opened. All components of the contract, including
// parameters file and template, will also be fetched if remote.
func Load(loc string, ctx *Context) (*Contract, error) {
	log.Info().Msgf("Loading contract: %s", loc)
	contract, err := loadContractComponents(loc, true, ctx)
	if err != nil {
		return nil, err
	}
	log.Debug().Msgf("Loaded contract components: %v", contract)

	// parse the parameters file
	contract.params, err = readContractParams(contract.ParamsFile.localPath)
	if err != nil {
		return nil, err
	}
	log.Debug().Msgf("Extracted contract parameters: %v", contract.params)
	// update signatories from the parameters
	contract.signatories, err = extractContractSignatories(contract.params, path.Dir(contract.path.localPath))
	if err != nil {
		return nil, err
	}
	log.Debug().Msgf("Extracted contract signatories: %v", contract.signatories)
	// update the parameters with signatories' possible signatures
	contract.params, err = updateContractSignatories(contract.params, contract.signatories)
	if err != nil {
		return nil, err
	}
	return contract, nil
}

func loadContractComponents(loc string, checkHashes bool, ctx *Context) (*Contract, error) {
	entrypoint, err := ResolveFileRef(loc, "", false, ctx.cache)
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
		contract.ParamsFile, err = ResolveRelFileRef(entrypoint, contract.ParamsFile, checkHashes, ctx.cache)
	} else {
		contract.ParamsFile, err = ResolveFileRef(contract.ParamsFile.Location, contract.ParamsFile.Hash, checkHashes, ctx.cache)
	}
	if err != nil {
		return nil, err
	}

	if contract.Template.File.IsRelative() {
		contract.Template.File, err = ResolveRelFileRef(entrypoint, contract.Template.File, checkHashes, ctx.cache)
	} else {
		contract.Template.File, err = ResolveFileRef(contract.Template.File.Location, contract.Template.File.Hash, checkHashes, ctx.cache)
	}
	if err != nil {
		return nil, err
	}
	return contract, nil
}

// Update will attempt to load the contract at the given location and update the
// hashes to its parameters and/or template file(s). It necessarily does not do
// any integrity checks on the parameters and/or template files prior to loading
// them.
func Update(loc string, ctx *Context) error {
	if fileRefType(loc) != LocalRef {
		return fmt.Errorf("only contracts located in the local filesystem can be updated")
	}
	log.Info().Msgf("Loading contract: %s", loc)
	// here we don't need to check the integrity of the contract up-front
	contract, err := loadContractComponents(loc, false, ctx)
	if err != nil {
		return err
	}
	// all we need to do now is save the updated details we've loaded
	if err := contract.Save(ctx); err != nil {
		return err
	}

	if ctx.autoCommit {
		contractDir := path.Dir(contract.path.localPath)
		log.Debug().Msgf("Git auto-commit is on. Attempting to commit changes to %s", contractDir)
		if err := gitAddAndCommit(contractDir, contract.allLocalRelativeFiles(), gitMsgUpdateContract, contract); err != nil {
			return fmt.Errorf("failed to auto-commit change to contract repo: %s", err)
		}
	}

	return nil
}

// Path returns the file reference for this contract.
func (c *Contract) Path() *FileRef {
	return c.path
}

// deriveTo will copy this contract to the given destination path. On success it
// returns the new configuration of the contract, with the paths updated.
func (c *Contract) deriveTo(destPath string, ctx *Context) (*Contract, error) {
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
			Location:  c.ParamsFile.Filename(),
			Hash:      c.ParamsFile.Hash,
			localPath: destParamsFile,
		},
		Template: &Template{
			Format: c.Template.Format,
			File: &FileRef{
				Location:  c.Template.File.Filename(),
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
	if err := dest.Save(ctx); err != nil {
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
func (c *Contract) Save(ctx *Context) error {
	log.Info().Msgf("Writing contract: %s", c.path.localPath)

	var content []byte
	err := fmt.Errorf("unrecognized file type: %s", c.fileType)

	switch c.fileType {
	case DhallType:
		rawTpl, err := readStaticResource("/templates/contract.dhall.tmpl", ctx.fs)
		if err != nil {
			return fmt.Errorf("failed to read from internal resource: %s", err)
		}
		tpl, err := template.New("contract").Parse(string(rawTpl))
		if err != nil {
			return err
		}
		// render the template in-memory so if it fails we haven't destroyed the
		// output contract file
		var buf bytes.Buffer
		if err := tpl.Execute(&buf, c); err != nil {
			return fmt.Errorf("failed to execute Mustache template: %s", err)
		}
		return ioutil.WriteFile(c.path.localPath, buf.Bytes(), 0644)

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
	if err := ioutil.WriteFile(c.path.localPath, content, 0644); err != nil {
		return fmt.Errorf("failed to write contract to %s", c.path.localPath)
	}
	return nil
}

// Compile takes a parsed contract and attempts to generate the output artifact
// that constitutes the final contract (as a PDF file).
func (c *Contract) Compile(output string, ctx *Context) error {
	// first we render the contract with its parameters to a temporary location
	tempDir, err := ioutil.TempDir("", "themis-contract")
	if err != nil {
		return err
	}
	tempContract := path.Join(tempDir, c.Template.File.Filename())
	if err := c.Render(tempContract); err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	// then we use pandoc to convert the temporary contract to a PDF file
	resourcePaths := strings.Join([]string{".", ctx.ActiveProfile().Path()}, ":")
	pandocOutput, err := exec.Command(
		"pandoc",
		tempContract,
		"-o",
		output,
		"--resource-path",
		resourcePaths,
	).CombinedOutput()
	log.Debug().Msgf("pandoc execution output:\n%s\n", pandocOutput)
	if err != nil {
		return err
	}
	log.Info().Msgf("Successfully rendered contract to %s", output)
	return nil
}

// Render takes the current contract template and renders it using the current
// parameters. The output file is the same format as the template, just with all
// of the parameters substituted in.
func (c *Contract) Render(output string) error {
	log.Info().Msg("Rendering contract")
	log.Debug().Msgf("Attempting to load template file: %s", c.Template.File.localPath)
	tf, err := os.Open(c.Template.File.localPath)
	if err != nil {
		return err
	}
	defer tf.Close()
	tpl, err := mustache.Parse(tf)
	if err != nil {
		return fmt.Errorf("failed to parse template: %s", err)
	}

	log.Debug().Msgf("Writing rendered template to output file: %s", output)
	of, err := os.Create(output)
	if err != nil {
		return fmt.Errorf("failed to create output file: %s", err)
	}
	defer of.Close()

	if err := tpl.Render(of, c.params); err != nil {
		return fmt.Errorf("failed to render template: %s", err)
	}
	return nil
}

// Sign attempts to sign the contract on behalf of the signatory with the
// given ID. If `sigId` is empty (""), it attempts to infer the signatory on
// behalf of whom you want to sign based on the default signatory for your
// current profile.
func (c *Contract) Sign(signatoryId string, ctx *Context) error {
	signature, err := ctx.CurSignature()
	if err != nil {
		return err
	}
	var signatory *Signatory
	if len(signatoryId) == 0 {
		// look for a signatory whose e-mail address matches our signature's
		signatory = c.FindSignatoryByEmail(signature.Email)
		if signatory == nil {
			return fmt.Errorf("cannot find signatory matching current profile's signature e-mail address of \"%s\"", signature.Email)
		}
	} else {
		signatory = c.FindSignatoryById(signatoryId)
		if signatory == nil {
			return fmt.Errorf("cannot find signatory in contract with ID \"%s\"", signatoryId)
		}
	}
	// apply the signature to our contract on behalf of the given signatory
	sigImagePath, err := signature.applyTo(c.path.localPath, signatory.Id)
	if err != nil {
		return fmt.Errorf("failed to apply signature \"%s\" to contract: %s", signature.id, err)
	}
	if ctx.autoCommit {
		contractDir := path.Dir(c.path.localPath)
		commitFiles := []string{path.Base(c.path.localPath), path.Base(sigImagePath)}
		commitCtx := struct {
			Email        string
			ContractFile string
			ContractHash string
		}{
			Email:        signatory.Email,
			ContractFile: commitFiles[0],
			ContractHash: c.path.Hash,
		}
		if err := gitAddAndCommit(contractDir, commitFiles, gitMsgSignContract, &commitCtx); err != nil {
			return fmt.Errorf("failed to automatically commit signing action to contract Git repository: %s", err)
		}
	}
	return nil
}

func (c *Contract) FindSignatoryByEmail(email string) *Signatory {
	for _, sig := range c.signatories {
		if sig.Email == email {
			return sig
		}
	}
	return nil
}

func (c *Contract) FindSignatoryById(id string) *Signatory {
	for _, sig := range c.signatories {
		if sig.Id == id {
			return sig
		}
	}
	return nil
}

func (c *Contract) Signatories() []*Signatory {
	return c.signatories
}

func (c *Contract) String() string {
	return fmt.Sprintf("Contract{ParamsFile: %v, Template: %v, Upstream: %v, path: %v}", c.ParamsFile, c.Template, c.Upstream, c.path)
}

func (c *Contract) allLocalRelativeFiles() []string {
	return []string{
		path.Base(c.path.localPath),
		path.Base(c.ParamsFile.localPath),
		path.Base(c.Template.File.localPath),
	}
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
	log.Debug().Msgf("dhall-to-json output:\n%s\n", content)
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
func extractContractSignatories(params map[string]interface{}, contractPath string) ([]*Signatory, error) {
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

	// clear out any potential signature info
	for _, r := range result {
		r.Signature = ""
	}

	// scan the contract path for signatures for each signatory
	expectedSigImages := map[string]int{}
	for i, sig := range result {
		sigImgFile := sigImageFilename(sig.Id)
		if _, ok := expectedSigImages[sigImgFile]; ok {
			return nil, fmt.Errorf("duplicate signatory ID in contract parameters: %s", sig.Id)
		}
		expectedSigImages[sigImgFile] = i
	}
	files, err := ioutil.ReadDir(contractPath)
	if err != nil {
		return nil, err
	}
	for _, fi := range files {
		if fi.IsDir() {
			continue
		}
		sigId, ok := expectedSigImages[fi.Name()]
		if !ok {
			continue
		}
		result[sigId].Signature = path.Join(contractPath, fi.Name())
		log.Debug().Msgf("Discovered signature image \"%s\" for signatory \"%s\"", result[sigId].Signature, result[sigId].Id)
	}
	return result, nil
}

func updateContractSignatories(params map[string]interface{}, signatories []*Signatory) (map[string]interface{}, error) {
	sigJSON, err := json.Marshal(signatories)
	if err != nil {
		return nil, err
	}
	var sigArr []interface{}
	if err = json.Unmarshal(sigJSON, &sigArr); err != nil {
		return nil, err
	}
	params["signatories"] = sigArr
	log.Debug().Msgf("Updated contract signatories: %v", params)
	return params, nil
}
