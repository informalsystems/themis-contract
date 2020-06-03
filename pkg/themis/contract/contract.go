package contract

import (
	"fmt"
	"os"
	"path"
	"text/template"

	"github.com/philandstuff/dhall-golang"
	"github.com/rs/zerolog/log"
)

// TODO: Use URL source for Themis Contract Dhall package.
const ContractTemplate string = `{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = ../../config/package.dhall

let contract : ThemisContract.Contract =
    { params =
        { location = "{{.Params.Path.LocalRelPath}}"
        , hash = "{{.Params.Path.Hash}}"
        }
    , upstream =
		{ location = "{{.Upstream.Location}}"
		, hash = "{{.Upstream.Hash}}"
		}
    , template =
        { format = ThemisContract.TemplateFormat.{{.Template.TemplateFormat.DhallId}}
        , file =
            { location = "{{.Template.File.LocalRelPath}}"
            , hash = "{{.Template.File.Hash}}"
            }
        }
    }

in contract
`

// Contract encapsulates all of the relevant data we need in order to deal with
// the contract (rendering, signature management, etc.).
type Contract struct {
	Path     *FileRef  `dhall:"-"`        // The path to the contract (remote and/or local).
	Params   *FileRef  `dhall:"params"`   // Where to find the parameters file for the contract.
	Template *Template `dhall:"template"` // The details of the contract text template to use when rendering the contract.
	Upstream *FileRef  `dhall:"upstream"` // The upstream contract from which this contract has been derived (if any).

	signatories []*Signatory // Cached signatories extracted from the parameters file.
}

// New creates a new contract in the configured path from the specified upstream
// contract.
func New(contractPath, upstreamLoc, cachePath string) (*Contract, error) {
	if len(upstreamLoc) == 0 {
		return nil, fmt.Errorf("when creating a contract with the `new` command, an upstream contract must be supplied as a template")
	}

	// load (and optionally cache) the upstream contract
	upstream, err := Load(upstreamLoc, cachePath)
	if err != nil {
		return nil, err
	}
	log.Debug().Msg(fmt.Sprintf("Loaded upstream contract: %v", upstream))

	// make a copy of the upstream contract in our local path
	contract, err := upstream.CopyTo(contractPath)
	if err != nil {
		return nil, err
	}
	// the only field we need to update
	contract.Upstream = upstream.Path
	// save the updated contract's details
	if err := contract.Save(); err != nil {
		return nil, err
	}

	return contract, nil
}

// Load will parse the contract at the given location into memory. If the
// location given is remote, the remote contract will be fetched and cached
// first prior to being opened.
func Load(loc, cachePath string) (*Contract, error) {
	log.Info().Str("location", loc).Msg("Attempting to resolve contract entrypoint")
	entrypoint, err := ResolveFileRef(loc, cachePath)
	if err != nil {
		return nil, err
	}
	ec, err := entrypoint.ReadAll()
	if err != nil {
		return nil, err
	}
	contract := &Contract{}
	// TODO: Do we need to support TOML/JSON/YAML here?
	if err = dhall.Unmarshal([]byte(ec), contract); err != nil {
		return nil, err
	}
	// see if we need to resolve the parameters file or the template relative
	// to the contract entrypoint
	if contract.Params.IsRelative() {
		contract.Params, err = ResolveRelFileRef(entrypoint, contract.Params, cachePath)
		if err != nil {
			return nil, err
		}
	}
	if contract.Template.File.IsRelative() {
		contract.Template.File, err = ResolveRelFileRef(entrypoint, contract.Template.File, cachePath)
		if err != nil {
			return nil, err
		}
	}
	return contract, nil
}

// CopyTo will copy this contract to the given destination path. On success it
// returns the new configuration of the contract, with the paths updated.
func (c *Contract) CopyTo(destPath string) (*Contract, error) {
	log.Debug().Str("path", destPath).Msg("Ensuring contract destination path exists")
	// ensure the destination path exists
	if err := os.MkdirAll(destPath, 0755); err != nil {
		return nil, err
	}
	destFile, err := LocalFileRef(path.Join(destPath, c.Path.Filename()))
	if err != nil {
		return nil, err
	}
	destParamsFile, err := LocalFileRef(path.Join(destPath, c.Params.Filename()))
	if err != nil {
		return nil, err
	}
	destTemplateFile, err := LocalFileRef(path.Join(destPath, c.Template.File.Filename()))
	if err != nil {
		return nil, err
	}
	dest := &Contract{
		Path:   destFile,
		Params: destParamsFile,
		Template: &Template{
			Format: c.Template.Format,
			File:   destTemplateFile,
		},
	}
	files := map[string]*FileRef{
		destFile.localPath:         c.Path,
		destParamsFile.localPath:   c.Params,
		destTemplateFile.localPath: c.Template.File,
	}
	for destFile, srcRef := range files {
		log.Info().
			Str("from", srcRef.localPath).
			Str("to", destFile).
			Msg("Copying file")
		if err := srcRef.CopyTo(destFile); err != nil {
			return nil, err
		}
	}
	return dest, nil
}

func (c *Contract) Save() error {
	log.Info().Str("filename", c.Path.localPath).Msg("Writing contract")

	tpl, err := template.New("contract").Parse(ContractTemplate)
	if err != nil {
		return err
	}

	f, err := os.Create(c.Path.localPath)
	if err != nil {
		return err
	}
	defer f.Close()

	return tpl.Execute(f, c)
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
