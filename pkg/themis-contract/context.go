package themis_contract

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"

	"github.com/rakyll/statik/fs"
	"github.com/rs/zerolog/log"
)

// Context give us all of the necessary configuration/information to facilitate
// all of our contracting functionality.
// TODO: Create a file reference resolver interface member to allow for mocking and better testing.
// TODO: Look at splitting this up as per TODO on InitContext.
type Context struct {
	home    string          // The path to the Themis Contract home folder.
	profile *Profile        // The profile to use when performing operations on a specific contract.
	cache   Cache           // The cache we're currently using for storing files we retrieve from remote sources.
	fs      http.FileSystem // For reading static resources pre-built into our binary.
	sigDB   *SignatureDB    // Our local database of signatures.
}

// InitContext creates a contracting context using the given Themis Contract
// home directory (usually located at `~/.themis/contract`).
// TODO: Perhaps this, or parts of this, should exist as its own standalone CLI command? e.g. "themis-contract init"
func InitContext(home string) (*Context, error) {
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
	if err := initProfiles(home, statikFS); err != nil {
		return nil, err
	}
	if err := initSignatures(home); err != nil {
		return nil, err
	}
	if err := initDhallPackages(home, statikFS); err != nil {
		return nil, err
	}
	// get our currently active profile
	profile, err := GetCurProfile(home)
	if err != nil {
		return nil, err
	}
	// gain access to our filesystem-based cache
	cache, err := OpenFSCache(path.Join(home, "cache"))
	if err != nil {
		return nil, fmt.Errorf("failed to open local cache: %s", err)
	}
	sigDB, err := LoadSignatureDB(home)
	if err != nil {
		return nil, fmt.Errorf("failed to open local signature database: %s", err)
	}
	return &Context{
		home:    home,
		profile: profile,
		cache:   cache,
		fs:      statikFS,
		sigDB:   sigDB,
	}, nil
}

// CurSignature returns the current signatory for the currently selected
// profile.
func (ctx *Context) CurSignature() (*Signature, error) {
	sig, ok := ctx.sigDB.sigs[ctx.profile.SignatureID]
	if !ok {
		return nil, fmt.Errorf("cannot find signatory with ID \"%s\" for profile \"%s\"", ctx.profile.SignatureID, ctx.profile.id)
	}
	return sig, nil
}

// Profiles returns all available profiles in this context.
func (ctx *Context) Profiles() ([]*Profile, error) {
	profilesPath := themisContractProfilesPath(ctx.home)
	files, err := ioutil.ReadDir(profilesPath)
	if err != nil {
		return nil, fmt.Errorf("failed to list profiles in profiles directory \"%s\": %s", profilesPath, err)
	}
	profiles := make([]*Profile, 0)
	for _, fi := range files {
		if !fi.IsDir() {
			continue
		}
		profilePath := path.Join(profilesPath, fi.Name())
		profile, err := LoadProfile(profilePath)
		if err != nil {
			return nil, fmt.Errorf("failed to load profile at path \"%s\": %s", profilePath, err)
		}
		profiles = append(profiles, profile)
	}
	return profiles, nil
}

// AddProfile will add a profile with the given name and signature ID. The ID
// of the profile will be derived from its name (slugified).
func (ctx *Context) AddProfile(name, sigID string) (*Profile, error) {
	id, err := slugify(name)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ID for profile \"%s\": %s", name, err)
	}
	profilePath := path.Join(themisContractProfilesPath(ctx.home), id)
	if _, err := os.Stat(profilePath); !os.IsNotExist(err) {
		return nil, fmt.Errorf("profile with ID \"%s\" already exists at %s", id, profilePath)
	}
	if len(sigID) > 0 {
		if _, exists := ctx.sigDB.sigs[sigID]; !exists {
			return nil, fmt.Errorf("signature with ID \"%s\" does not exist", sigID)
		}
	}
	profile := &Profile{
		Name:        name,
		SignatureID: sigID,
		id:          id,
		path:        profilePath,
	}
	if err := profile.Save(); err != nil {
		return nil, err
	}
	return profile, nil
}

func (ctx *Context) RemoveProfile(id string) error {
	if id == DefaultProfileId {
		return fmt.Errorf("cannot remove default profile")
	}
	profilePath := path.Join(themisContractProfilesPath(ctx.home), id)
	if _, err := os.Stat(profilePath); os.IsNotExist(err) {
		return fmt.Errorf("profile with ID \"%s\" already exists at %s", id, profilePath)
	}
	return os.RemoveAll(profilePath)
}

func (ctx *Context) RenameProfile(srcID, destName string) error {
	destID, err := slugify(destName)
	if err != nil {
		return fmt.Errorf("cannot name profile \"%s\": %s", destName, err)
	}
	profile, err := ctx.GetProfileByID(srcID)
	if err != nil {
		return err
	}
	if _, err := ctx.GetProfileByID(destID); err == nil {
		return fmt.Errorf("desired destination profile with ID \"%s\" already exists", destID)
	}
	oldPath := profile.path
	profile.id = destID
	profile.path = path.Join(themisContractProfilesPath(ctx.home), destID)
	profile.Name = destName

	// rename the folder
	if err := os.Rename(oldPath, profile.path); err != nil {
		return fmt.Errorf("failed to rename folder %s to %s: %s", oldPath, profile.path, err)
	}
	log.Debug().Msgf("Moved folder %s to %s", oldPath, profile.path)
	return profile.Save()
}

// GetProfileByID is a shortcut method to load a profile from our current
// context whose ID matches the given one.
func (ctx *Context) GetProfileByID(id string) (*Profile, error) {
	return LoadProfile(path.Join(themisContractProfilesPath(ctx.home), id))
}

func slugify(s string) (string, error) {
	re, err := regexp.Compile("[^a-z0-9]+")
	if err != nil {
		return "", fmt.Errorf("failed to compile regular expression for slugify: %s", err)
	}
	return strings.Trim(re.ReplaceAllString(strings.ToLower(s), "-"), "-"), nil
}
