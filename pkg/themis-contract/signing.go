package themis_contract

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

// Signature is what we apply to a contract to sign it.
// TODO: Investigate GPG-based signing.
type Signature struct {
	Name      string `json:"name,omitempty"` // An optional short, descriptive name for the signature.
	Email     string `json:"email"`          // The e-mail address associated with a specific signature.
	ImagePath string `json:"image"`          // The filesystem path to the image constituting the image-based signature.

	id   string // A unique ID associated with this signature (derived from the filesystem path).
	path string // The filesystem path to the signature's information.
}

// SignatureDB is a local database of signatures which can be applied to
// contracts when signing.
type SignatureDB struct {
	sigs map[string]*Signature
}

// LoadSignatureDB will attempt to load our local collection of signatures,
// given the specified home folder for Themis Contract.
func LoadSignatureDB(home string) (*SignatureDB, error) {
	sigsPath := themisContractSignaturesPath(home)
	files, err := ioutil.ReadDir(sigsPath)
	if err != nil {
		return nil, err
	}
	db := &SignatureDB{
		sigs: make(map[string]*Signature),
	}
	for _, fi := range files {
		if fi.IsDir() && !strings.HasPrefix(fi.Name(), ".") {
			sigPath := path.Join(sigsPath, fi.Name())
			sig, err := LoadSignature(sigPath)
			if err != nil {
				return nil, fmt.Errorf("failed to load signature \"%s\": %s", sigPath, err)
			}
			db.sigs[sig.id] = sig
		}
	}
	return db, nil
}

// LoadSignature will attempt to load information relating to the signature
// located at the given filesystem path.
func LoadSignature(sigPath string) (*Signature, error) {
	sigJson, err := ioutil.ReadFile(path.Join(sigPath, "meta.json"))
	if err != nil {
		return nil, err
	}
	var sig Signature
	if err := json.Unmarshal(sigJson, &sig); err != nil {
		return nil, err
	}
	sig.id = path.Base(sigPath)
	sig.path = sigPath

	if len(sig.ImagePath) == 0 {
		return nil, fmt.Errorf("signature \"%s\" is missing an image", sig.id)
	}
	if !path.IsAbs(sig.ImagePath) {
		sig.ImagePath, err = filepath.Abs(path.Join(sigPath, sig.ImagePath))
		if err != nil {
			return nil, fmt.Errorf("unable to resolve image path for signature \"%s\": %s", sig.id, err)
		}
	}
	if _, err = os.Stat(sig.ImagePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot find image file for signature \"%s\": %s", sig.id, sig.ImagePath)
	}
	log.Debug().Msgf("Loaded signature: %v", &sig)
	return &sig, nil
}

// ApplyTo will attempt to apply this signature to the contract in the specified
// path (assuming it's the full path to the contract file) on behalf of the
// specified signatory ID.
// TODO: Implement Git commit here with current hash of contract.
func (s *Signature) ApplyTo(contractPath string, sigId string) error {
	sigImagePath := path.Join(path.Base(contractPath), sigImageFilename(sigId))
	log.Debug().Msgf("Copying signature file from %s to %s", s.ImagePath, sigImagePath)
	return copyFile(s.ImagePath, sigImagePath)
}

func (s *Signature) String() string {
	return fmt.Sprintf("Signature{Name: \"%s\", Email: \"%s\", ImagePath: \"%s\"}", s.Name, s.Email, s.ImagePath)
}

func sigImageFilename(sigId string) string {
	return fmt.Sprintf("sig--%s.png", sigId)
}

func themisContractSignaturesPath(home string) string {
	return path.Join(home, "signatures")
}

func initSignatures(home string) error {
	return os.MkdirAll(themisContractSignaturesPath(home), 0755)
}
