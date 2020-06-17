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

// Profile is a way of naming and differentiating between rendering
// configurations used when rendering contracts.
type Profile struct {
	id   string
	path string
}

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
	stat, err := os.Stat(profilePath)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot find profile at: %s", profilePath)
	}
	if !stat.IsDir() {
		return nil, fmt.Errorf("expected profile to be a directory: %s", profilePath)
	}
	// we use the last segment of the folder name as the profile ID
	id := path.Base(profilePath)
	return &Profile{
		id:   id,
		path: profilePath,
	}, nil
}

func (p *Profile) String() string {
	return fmt.Sprintf("Profile{id: \"%s\", path: \"%s\"}", p.id, p.path)
}

func (p *Profile) Id() string {
	return p.id
}

func (p *Profile) Path() string {
	return p.path
}

func LoadProfileConfig(filename string) (*ProfileConfig, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	config := &ProfileConfig{}
	if err := json.Unmarshal(content, config); err != nil {
		return nil, err
	}
	return config, nil
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
	// check that our profile config is present and valid
	profileConfig := &ProfileConfig{
		ActiveProfile: DefaultProfileId,
	}
	profileConfigPath := path.Join(profilesHome, "config.json")
	profilePath := path.Join(profilesHome, profileConfig.ActiveProfile)
	_, err := os.Stat(profileConfigPath)
	if os.IsNotExist(err) {
		log.Debug().Msgf("Profile configuration does not exist yet. Creating at: %s", profileConfigPath)
		if err := profileConfig.Save(profileConfigPath); err != nil {
			return err
		}
	} else {
		log.Debug().Msgf("Loading profile configuration from: %s", profileConfigPath)
		profileConfig, err = LoadProfileConfig(profileConfigPath)
		if err != nil {
			return err
		}
		log.Debug().Msgf("Loaded profile configuration: %v", profileConfig)
		profilePath = path.Join(profilesHome, profileConfig.ActiveProfile)
	}

	log.Debug().Msgf("Ensuring profile \"%s\" has a path: %s", profileConfig.ActiveProfile, profilePath)
	if err = os.MkdirAll(profilePath, 0755); err != nil {
		return fmt.Errorf("failed to create path for profile \"%s\": %s", profileConfig.ActiveProfile, profilePath)
	}
	log.Debug().Msgf("Created profile path: %s", profilePath)

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

func themisContractProfilesPath(home string) string {
	return path.Join(home, "profiles")
}
