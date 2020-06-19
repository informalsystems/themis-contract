package themis_contract

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"

	"github.com/rs/zerolog/log"
)

const DefaultProfileId string = "default"

type ProfileParameter string

const (
	ProfileSignatureID ProfileParameter = "signature-id"
)

// Profile is a way of naming and differentiating between rendering
// configurations used when rendering contracts.
type Profile struct {
	Name        string `json:"name"`                   // A short, descriptive name for the profile.
	SignatureID string `json:"signature_id,omitempty"` // The ID of the signature to use when signing using this profile.

	id   string // A unique ID for this profile.
	path string // The local filesystem path to this profile's folder.
}

// ProfileConfig provides overall configuration relating to profile management.
type ProfileConfig struct {
	ActiveProfile string `json:"active_profile"` // The ID of the profile currently active.
}

// GetCurProfile loads the currently selected profile from the given home
// directory for Themis Contract (usually `~/.themis/contract`).
func GetCurProfile(home string) (*Profile, error) {
	profilesHome := themisContractProfilesPath(home)
	cfgRaw, err := ioutil.ReadFile(path.Join(profilesHome, "config.json"))
	if err != nil {
		return nil, err
	}
	cfg := &ProfileConfig{}
	if err := json.Unmarshal(cfgRaw, cfg); err != nil {
		return nil, err
	}
	return LoadProfile(path.Join(profilesHome, cfg.ActiveProfile))
}

// LoadProfile will load the profile from the given profile path.
func LoadProfile(profilePath string) (*Profile, error) {
	if _, err := os.Stat(profilePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("profile does not exist at %s", profilePath)
	}
	// we use the last segment of the folder name as the profile ID
	id := path.Base(profilePath)
	profileMetaFile := path.Join(profilePath, "meta.json")
	profileJSON, err := ioutil.ReadFile(profileMetaFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read profile metadata file %s: %s", profileMetaFile, err)
	}
	var profile Profile
	if err = json.Unmarshal(profileJSON, &profile); err != nil {
		return nil, fmt.Errorf("failed to interpret profile metadata file for profile \"%s\": %s", id, err)
	}
	profile.id = id
	profile.path = profilePath
	return &profile, nil
}

func ValidProfileParamNames() []string {
	return []string{
		string(ProfileSignatureID),
	}
}

func (p *Profile) Save() error {
	if err := os.MkdirAll(p.path, 0755); err != nil {
		return fmt.Errorf("failed to create path for profile at \"%s\": %s", p.path, err)
	}
	content, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("failed to marshal profile \"%s\" to JSON: %s", p.id, err)
	}
	outputFile := path.Join(p.path, "meta.json")
	log.Debug().Msgf("Writing profile \"%s\" to %s", p.id, outputFile)
	return ioutil.WriteFile(outputFile, content, 0644)
}

func (p *Profile) SetParam(param string, val string, ctx *Context) error {
	switch param {
	case string(ProfileSignatureID):
		return p.setSignatureID(val, ctx)
	}
	return fmt.Errorf("unrecognized parameter \"%s\"", param)
}

func (p *Profile) String() string {
	return fmt.Sprintf("Profile{id: \"%s\", path: \"%s\"}", p.id, p.path)
}

// Display shows a more human-readable description of the profile than String()
// does.
func (p *Profile) Display() string {
	sigDisplay := ""
	if len(p.SignatureID) > 0 {
		sigDisplay = fmt.Sprintf(", signature ID: %s", p.SignatureID)
	}
	return fmt.Sprintf("%s (ID: %s%s)", p.Name, p.id, sigDisplay)
}

func (p *Profile) Id() string {
	return p.id
}

func (p *Profile) Path() string {
	return p.path
}

func (p *Profile) setSignatureID(sigID string, ctx *Context) error {
	if _, exists := ctx.sigDB.sigs[sigID]; !exists {
		return fmt.Errorf("signature with ID \"%s\" does not exist", sigID)
	}
	p.SignatureID = sigID
	return nil
}

func LoadProfileConfig(filename string) (*ProfileConfig, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var config ProfileConfig
	if err := json.Unmarshal(content, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func (c *ProfileConfig) Save(output string) error {
	content, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return ioutil.WriteFile(output, content, 0644)
}

func initProfiles(home string, fs http.FileSystem) error {
	log.Debug().Msgf("Initializing profiles in %s", home)
	// create all the directories we need
	profilesHome := themisContractProfilesPath(home)
	defaultProfilePath := path.Join(profilesHome, DefaultProfileId)
	for _, dir := range []string{profilesHome, defaultProfilePath} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to initialize Themis Contract profile directory \"%s\": %s", dir, err)
		}
		log.Debug().Msgf("Themis Contract profile directory exists: %s", dir)
	}
	if err := ensureDefaultProfile(home); err != nil {
		return err
	}
	if err := ensureProfileConfig(home); err != nil {
		return err
	}
	profileConfigPath := path.Join(profilesHome, "config.json")
	profileConfig, err := LoadProfileConfig(profileConfigPath)
	if err != nil {
		return fmt.Errorf("failed to load profile configuration: %s", err)
	}
	profilePath := path.Join(profilesHome, profileConfig.ActiveProfile)
	if _, err := os.Stat(profilePath); os.IsNotExist(err) {
		return fmt.Errorf("currently active profile \"%s\" (configured in %s) does not exist", profileConfig.ActiveProfile, profileConfigPath)
	}

	// initialize the Pandoc configuration for the currently active profile
	pandocFiles := []string{
		"/pandoc/pandoc-defaults.yaml",
		"/pandoc/header-includes.tex",
		"/pandoc/include-before.tex",
	}
	if err := copyStaticResources(pandocFiles, profilePath, false, fs); err != nil {
		return err
	}
	return nil
}

func ensureProfileConfig(home string) error {
	profileConfigPath := path.Join(themisContractProfilesPath(home), "config.json")
	if _, err := os.Stat(profileConfigPath); !os.IsNotExist(err) {
		return nil
	}
	defProfileConfig := &ProfileConfig{ActiveProfile: DefaultProfileId}
	return defProfileConfig.Save(profileConfigPath)
}

func ensureDefaultProfile(home string) error {
	defProfilePath := path.Join(themisContractProfilesPath(home), DefaultProfileId)
	if err := os.MkdirAll(defProfilePath, 0755); err != nil {
		return fmt.Errorf("failed to create default profile at %s: %s", defProfilePath, err)
	}
	defProfileMetaPath := path.Join(defProfilePath, "meta.json")
	if _, err := os.Stat(defProfileMetaPath); !os.IsNotExist(err) {
		log.Debug().Msgf("Default profile metadata file already exists at %s", defProfileMetaPath)
		return nil
	}
	defProfile := &Profile{
		Name: "Default",
		id:   DefaultProfileId,
		path: defProfilePath,
	}
	return defProfile.Save()
}

func themisContractProfilesPath(home string) string {
	return path.Join(home, "profiles")
}
