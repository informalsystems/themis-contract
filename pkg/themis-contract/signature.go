package themis_contract

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
)

type SignatureParameter string

const (
	SignatureEmail SignatureParameter = "email"
	SignatureImage SignatureParameter = "image"
)

// Signature is what we apply to a contract to sign it.
// TODO: Investigate GPG-based signing.
type Signature struct {
	Name      string `json:"name"`  // A short, descriptive name for the signature.
	Email     string `json:"email"` // The e-mail address associated with a specific signature.
	ImagePath string `json:"image"` // The filesystem path to the image constituting the image-based signature.

	id   string // A unique ID associated with this signature (derived from the filesystem path).
	path string // The filesystem path to the signature's information.
}

// SignatureDB is a local database of signatures which can be applied to
// contracts when signing.
type SignatureDB struct {
	sigs     map[string]*Signature
	sigsPath string
}

type SignatureByName []*Signature

var _ sort.Interface = SignatureByName{}

//------------------------------------------------------------------------------
//
// Signature database-related functionality
//
//------------------------------------------------------------------------------

// loadSignatureDB will attempt to load our local collection of signatures,
// given the specified home folder for Themis Contract.
func loadSignatureDB(home string) (*SignatureDB, error) {
	sigsPath := themisContractSignaturesPath(home)
	files, err := ioutil.ReadDir(sigsPath)
	if err != nil {
		return nil, err
	}
	db := &SignatureDB{
		sigs:     make(map[string]*Signature),
		sigsPath: sigsPath,
	}
	for _, fi := range files {
		if fi.IsDir() && !strings.HasPrefix(fi.Name(), ".") {
			sigPath := path.Join(sigsPath, fi.Name())
			sig, err := loadSignature(sigPath)
			if err != nil {
				return nil, fmt.Errorf("failed to load signature \"%s\": %s", sigPath, err)
			}
			db.sigs[sig.id] = sig
		}
	}
	return db, nil
}

func (db *SignatureDB) newSignature(name, email, sigImage string) (*Signature, error) {
	id, err := slugify(name)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ID from signature name \"%s\": %s", name, err)
	}
	if _, exists := db.sigs[id]; exists {
		return nil, fmt.Errorf("signature with ID \"%s\" (derived from name \"%s\") already exists", id, name)
	}
	sigPath := path.Join(db.sigsPath, id)
	if err := os.MkdirAll(sigPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create folder for new signature \"%s\": %s", sigPath, err)
	}
	log.Debug().Msgf("Created new folder for signature: %s", sigPath)
	newSigImagePath := path.Join(sigPath, path.Base(sigImage))
	// try copying the image
	if err := copyFile(sigImage, newSigImagePath); err != nil {
		return nil, fmt.Errorf("failed to copy supplied signature image \"%s\" for new signature: %s", sigImage, err)
	}
	log.Debug().Msgf("Copied signature image from %s to %s", sigImage, newSigImagePath)
	sig := &Signature{
		Name:      name,
		Email:     email,
		ImagePath: path.Base(sigImage),
		id:        id,
		path:      sigPath,
	}
	if err := sig.Save(); err != nil {
		return nil, fmt.Errorf("failed to save signature: %s", err)
	}
	db.sigs[id] = sig
	return sig, nil
}

// remove will attempt to delete the signature with the specified ID from the
// signature store.
func (db *SignatureDB) remove(id string) error {
	sig, exists := db.sigs[id]
	if !exists {
		return fmt.Errorf("no such signature with ID \"%s\"", id)
	}
	delete(db.sigs, id)
	if err := os.RemoveAll(sig.path); err != nil {
		return fmt.Errorf("failed to delete signature \"%s\" from file system: %s", id, err)
	}
	return nil
}

func (db *SignatureDB) rename(srcID, destName string) (string, error) {
	destID, err := slugify(destName)
	if err != nil {
		return "", fmt.Errorf("failed to derive ID for name \"%s\": %s", destName, err)
	}
	sig, exists := db.sigs[srcID]
	if !exists {
		return "", fmt.Errorf("no such signature with ID \"%s\"", srcID)
	}
	if _, exists := db.sigs[destID]; exists {
		return "", fmt.Errorf("signature with ID \"%s\" (derived from name \"%s\") already exists", destID, destName)
	}
	destPath := path.Join(db.sigsPath, destID)
	if err := os.Rename(sig.path, destPath); err != nil {
		return "", fmt.Errorf("failed to rename signature folder from %s to %s: %s", sig.path, destPath, err)
	}
	sig.id = destID
	sig.Name = destName
	sig.path = destPath
	if err := sig.Save(); err != nil {
		return "", err
	}
	return destID, nil
}

//------------------------------------------------------------------------------
//
// Signature-related functionality
//
//------------------------------------------------------------------------------

func ValidSignatureParamNames() []string {
	return []string{
		string(SignatureEmail),
		string(SignatureImage),
	}
}

// loadSignature will attempt to load information relating to the signature
// located at the given filesystem path.
func loadSignature(sigPath string) (*Signature, error) {
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
	sigImagePath := path.Join(sigPath, sig.ImagePath)
	if _, err = os.Stat(sigImagePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot find image file for signature \"%s\": %s", sig.id, sigImagePath)
	}
	log.Debug().Msgf("Loaded signature: %v", &sig)
	return &sig, nil
}

func (s *Signature) Save() error {
	content, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("failed to convert signature \"%s\" to JSON: %s", s.id, err)
	}
	if err := ioutil.WriteFile(path.Join(s.path, "meta.json"), content, 0644); err != nil {
		return fmt.Errorf("failed to save signature \"%s\": %s", s.id, err)
	}
	return nil
}

// applyTo will attempt to apply this signature to the contract in the specified
// path (assuming it's the full path to the contract file) on behalf of the
// specified signatory ID.
// TODO: Implement Git commit here with current hash of contract.
func (s *Signature) applyTo(contractPath string, sigId string) error {
	sigImagePath := path.Join(path.Base(contractPath), sigImageFilename(sigId))
	log.Debug().Msgf("Copying signature file from %s to %s", s.ImagePath, sigImagePath)
	return copyFile(path.Join(s.path, s.ImagePath), sigImagePath)
}

func (s *Signature) String() string {
	return fmt.Sprintf("Signature{Name: \"%s\", Email: \"%s\", ImagePath: \"%s\"}", s.Name, s.Email, s.ImagePath)
}

func (s *Signature) Display() string {
	return fmt.Sprintf("%s (ID: %s, e-mail: %s)", s.Name, s.id, s.Email)
}

//------------------------------------------------------------------------------
//
// Signature sorting
//
//------------------------------------------------------------------------------

func (n SignatureByName) Len() int { return len(n) }

func (n SignatureByName) Swap(i, j int) {
	t := n[i]
	n[i] = n[j]
	n[j] = t
}

func (n SignatureByName) Less(i, j int) bool { return n[i].Name < n[j].Name }

//------------------------------------------------------------------------------
//
// Helper methods
//
//------------------------------------------------------------------------------

func sigImageFilename(sigId string) string {
	return fmt.Sprintf("sig--%s.png", sigId)
}

func themisContractSignaturesPath(home string) string {
	return path.Join(home, "signatures")
}

func initSignatures(home string) error {
	return os.MkdirAll(themisContractSignaturesPath(home), 0755)
}
