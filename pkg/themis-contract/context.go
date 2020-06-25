package themis_contract

import (
	"fmt"
	"net/http"
	"os"
	"path"
	"sort"

	"github.com/rakyll/statik/fs"
	"github.com/rs/zerolog/log"
)

// Context give us all of the necessary configuration/information to facilitate
// all of our contracting functionality.
// TODO: Create a file reference resolver interface member to allow for mocking and better testing.
// TODO: Look at splitting this up as per TODO on InitContext.
type Context struct {
	home            string          // The path to the Themis Contract home folder.
	cache           Cache           // The cache we're currently using for storing files we retrieve from remote sources.
	fs              http.FileSystem // For reading static resources pre-built into our binary.
	profileDB       *ProfileDB      // Our local database of profiles.
	sigDB           *SignatureDB    // Our local database of signatures.
	autoCommit      bool            // Should we automatically commit changes as we update the contract?
	autoPushChanges bool            // Should we automatically push local commits as we update the contract?
}

// InitContext creates a contracting context using the given Themis Contract
// home directory (usually located at `~/.themis/contract`).
// TODO: Perhaps this, or parts of this, should exist as its own standalone CLI command? e.g. "themis-contract init"
func InitContext(home string, autoCommit, autoPush bool) (*Context, error) {
	if err := os.MkdirAll(home, 0755); err != nil {
		return nil, fmt.Errorf("failed to initialize Themis Contract home directory \"%s\": %s", home, err)
	}
	log.Debug().Msgf("Themis Contract home directory present: %s", home)

	// gain access to our static resource filesystem
	statikFS, err := fs.New()
	if err != nil {
		log.Error().Err(err).Msg("Failed to initialize global static filesystem")
		os.Exit(1)
	}
	if err := initProfiles(home); err != nil {
		return nil, err
	}
	if err := initSignatures(home); err != nil {
		return nil, err
	}
	// gain access to our filesystem-based cache
	cache, err := OpenFSCache(path.Join(home, "cache"))
	if err != nil {
		return nil, fmt.Errorf("failed to open local cache: %s", err)
	}
	profileDB, err := loadProfileDB(home)
	if err != nil {
		return nil, fmt.Errorf("failed to open local profile database: %s", err)
	}
	sigDB, err := loadSignatureDB(home)
	if err != nil {
		return nil, fmt.Errorf("failed to open local signature database: %s", err)
	}
	return &Context{
		home:            home,
		cache:           cache,
		fs:              statikFS,
		profileDB:       profileDB,
		sigDB:           sigDB,
		autoCommit:      autoCommit,
		autoPushChanges: autoPush,
	}, nil
}

func (ctx *Context) WithAutoPush(autoPush bool) *Context {
	dupCtx := *ctx
	dupCtx.autoPushChanges = autoPush
	return &dupCtx
}

func (ctx *Context) ActiveProfile() *Profile {
	return ctx.profileDB.activeProfile
}

func (ctx *Context) UseProfile(id string) (*Profile, error) {
	return ctx.profileDB.setActiveProfile(id)
}

// CurSignature returns the current signature for the currently selected
// profile.
func (ctx *Context) CurSignature() (*Signature, error) {
	activeProfile := ctx.ActiveProfile()
	if len(activeProfile.SignatureID) == 0 {
		return nil, fmt.Errorf("no signature associated with current profile (\"%s\")", activeProfile.id)
	}
	sig, ok := ctx.sigDB.sigs[activeProfile.SignatureID]
	if !ok {
		return nil, fmt.Errorf("cannot find signatory with ID \"%s\" for profile \"%s\"", activeProfile.SignatureID, activeProfile.id)
	}
	return sig, nil
}

// Profiles returns all available profiles in this context.
func (ctx *Context) Profiles() []*Profile {
	return ctx.profileDB.sortedProfiles()
}

// AddProfile will add a profile with the given name and signature ID. The ID
// of the profile will be derived from its name (slugified).
func (ctx *Context) AddProfile(name, sigID string) (*Profile, error) {
	// only if a signature ID is supplied do we care about looking it up
	if len(sigID) > 0 {
		if _, exists := ctx.sigDB.sigs[sigID]; !exists {
			return nil, fmt.Errorf("signature with ID \"%s\" does not exist", sigID)
		}
	}
	profile, err := ctx.profileDB.add(name, sigID)
	if err != nil {
		return nil, err
	}
	// now copy over the default profile configuration files
	profileFiles := []string{
		"/pandoc/pandoc-defaults.yaml",
		"/pandoc/header-includes.tex",
		"/pandoc/include-before.tex",
	}
	if err := copyStaticResources(profileFiles, profile.path, false, ctx.fs); err != nil {
		return nil, fmt.Errorf("failed to copy default profile configuration files: %s", err)
	}
	return profile, nil
}

// SetProfileParam will attempt to set the given property of the specified
// profile to the supplied value. It does not automatically save the profile
// after setting the value.
func (ctx *Context) SetProfileParam(profile *Profile, param, val string) error {
	switch param {
	case string(ProfileSignatureID):
		return ctx.setProfileSignatureID(profile, val)
	}
	return fmt.Errorf("unrecognized parameter \"%s\"", param)
}

func (ctx *Context) setProfileSignatureID(profile *Profile, sigID string) error {
	// if we're not unsetting the signature ID
	if len(sigID) > 0 {
		if _, exists := ctx.sigDB.sigs[sigID]; !exists {
			return fmt.Errorf("signature with ID \"%s\" does not exist", sigID)
		}
	}
	profile.SignatureID = sigID
	return nil
}

func (ctx *Context) RemoveProfile(id string) error {
	return ctx.profileDB.remove(id)
}

func (ctx *Context) RenameProfile(srcID, destName string) error {
	return ctx.profileDB.rename(srcID, destName)
}

// GetProfileByID is a shortcut method to load a profile from our current
// context whose ID matches the given one.
func (ctx *Context) GetProfileByID(id string) (*Profile, error) {
	profile, exists := ctx.profileDB.profiles[id]
	if !exists {
		return nil, fmt.Errorf("profile with ID \"%s\" does not exist", id)
	}
	return profile, nil
}

// Signatures returns a list of signatures sorted by signature name.
func (ctx *Context) Signatures() ([]*Signature, error) {
	result := make([]*Signature, 0)
	for _, sig := range ctx.sigDB.sigs {
		result = append(result, sig)
	}
	sort.Sort(SignatureByName(result))
	return result, nil
}

func (ctx *Context) GetSignatureByID(id string) (*Signature, error) {
	sig, exists := ctx.sigDB.sigs[id]
	if !exists {
		return nil, fmt.Errorf("signature with ID \"%s\" does not exist", id)
	}
	return sig, nil
}

func (ctx *Context) AddSignature(name, email, sigImage string) (*Signature, error) {
	return ctx.sigDB.newSignature(name, email, sigImage)
}

// RemoveSignature will attempt to delete the signature with the given ID. If
// any profiles are still using this signature, the signature will be detached
// from them and a warning will be generated notifying the user of this.
func (ctx *Context) RemoveSignature(id string) error {
	// detach the signature with the given ID from any profiles attached to it
	for _, profile := range ctx.profileDB.profilesWithSignatureID(id) {
		profile.SignatureID = ""
		if err := profile.Save(); err != nil {
			return fmt.Errorf("failed to update profile \"%s\": %s", profile.id, err)
		}
		log.Warn().Msgf("Signature \"%s\" has been detached from profile \"%s\"", id, profile.id)
	}
	return ctx.sigDB.remove(id)
}

func (ctx *Context) RenameSignature(srcID, destName string) error {
	destID, err := ctx.sigDB.rename(srcID, destName)
	if err != nil {
		return err
	}
	for _, profile := range ctx.profileDB.profilesWithSignatureID(srcID) {
		log.Warn().Msgf("Profile with ID \"%s\" will now use renamed signature \"%s\"", profile.id, destID)
		profile.SignatureID = destID
		if err := profile.Save(); err != nil {
			return fmt.Errorf("failed to update profile \"%s\": %s", profile.id, err)
		}
	}
	return nil
}

func (ctx *Context) SetSignatureParam(sig *Signature, param, val string) error {
	switch param {
	case string(SignatureEmail):
		sig.Email = val
		return nil
	case string(SignatureImage):
		return ctx.setSignatureImage(sig, val)
	}
	return fmt.Errorf("unrecognized parameter \"%s\"", param)
}

func (ctx *Context) setSignatureImage(sig *Signature, newImagePath string) error {
	if _, err := os.Stat(newImagePath); os.IsNotExist(err) {
		return fmt.Errorf("no such file: %s", newImagePath)
	}
	imageBaseName := path.Base(newImagePath)
	destImagePath := path.Join(path.Dir(sig.path), imageBaseName)
	if err := copyFile(newImagePath, destImagePath); err != nil {
		return fmt.Errorf("failed to copy new image to signature folder: %s", err)
	}
	sig.ImagePath = imageBaseName
	return nil
}
