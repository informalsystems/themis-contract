package themis_contract

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"sort"

	"github.com/rs/zerolog/log"
)

type ProfileParameter string

const (
	ProfileSignatureID ProfileParameter = "signature-id"
)

// ProfileDB allows us to manage our local database of profiles.
type ProfileDB struct {
	ActiveProfileID string `json:"active_profile_id"` // The ID of the profile currently active. Can be empty if none active.

	activeProfile *Profile            // The profile represented by ActiveProfileID.
	profiles      map[string]*Profile // The profiles we've loaded from the file system.
	configPath    string              // The path to the database's configuration file.
	profilesPath  string              // The path to the root of where to find all of the profiles.
}

// ActiveProfile is a way of naming and differentiating between rendering
// configurations used when rendering contracts.
type Profile struct {
	Name        string `json:"name"`                   // A short, descriptive name for the profile.
	SignatureID string `json:"signature_id,omitempty"` // The ID of the signature to use when signing using this profile.

	id     string // A unique ID for this profile.
	path   string // The local filesystem path to this profile's folder.
	active bool   // Is this our currently active profile?
}

type ProfileByName []*Profile

var _ sort.Interface = ProfileByName{}

//------------------------------------------------------------------------------
//
// Profile database-related functionality
//
//------------------------------------------------------------------------------

// loadProfileDB will load all profiles located within the given Themis Contract
// home directory (usually `~/.themis/contract`). It also detects which of the
// profiles is currently our active profile.
func loadProfileDB(home string) (*ProfileDB, error) {
	profilesHome := themisContractProfilesPath(home)
	if err := os.MkdirAll(profilesHome, 0755); err != nil {
		return nil, fmt.Errorf("failed to create profiles home directory \"%s\": %s", profilesHome, err)
	}
	profileDBConfigPath := path.Join(profilesHome, "config.json")
	log.Debug().Msgf("Loading profiles database configuration from: %s", profileDBConfigPath)
	if _, err := os.Stat(profileDBConfigPath); os.IsNotExist(err) {
		log.Debug().Msgf("No profile configuration file present at %s - creating", profileDBConfigPath)
		if err := ensureProfileConfig(profilesHome); err != nil {
			return nil, err
		}
	}
	configJSON, err := ioutil.ReadFile(profileDBConfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load profile database configuration file at %s: %s", profileDBConfigPath, err)
	}
	db := &ProfileDB{}
	if err := json.Unmarshal(configJSON, db); err != nil {
		return nil, fmt.Errorf("failed to interpret profile database configuration file %s: %s", profileDBConfigPath, err)
	}
	log.Debug().Msgf("Successfully loaded profile database configuration: %v", db)
	// load all of the profiles
	db.profiles, err = loadAllProfiles(profilesHome)
	if err != nil {
		return nil, fmt.Errorf("failed to load profiles: %s", err)
	}
	if len(db.ActiveProfileID) > 0 {
		var exists bool
		db.activeProfile, exists = db.profiles[db.ActiveProfileID]
		if !exists {
			return nil, fmt.Errorf("cannot find active profile with ID \"%s\"", db.ActiveProfileID)
		}
		db.activeProfile.active = true
	}
	db.configPath = profileDBConfigPath
	db.profilesPath = profilesHome
	return db, nil
}

func (db *ProfileDB) add(name, sigID string) (*Profile, error) {
	id, err := slugify(name)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ID for profile \"%s\": %s", name, err)
	}
	profilePath := path.Join(db.profilesPath, id)
	if _, err := os.Stat(profilePath); !os.IsNotExist(err) {
		return nil, fmt.Errorf("profile with ID \"%s\" already exists at %s", id, profilePath)
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
	db.profiles[id] = profile
	return profile, nil
}

func (db *ProfileDB) setActiveProfile(id string) (*Profile, error) {
	profile, exists := db.profiles[id]
	if !exists {
		return nil, fmt.Errorf("no such profile with ID \"%s\"", id)
	}
	if len(db.ActiveProfileID) > 0 {
		db.profiles[db.ActiveProfileID].active = false
	}
	profile.active = true
	db.ActiveProfileID = id
	db.activeProfile = profile
	if err := db.save(); err != nil {
		return nil, fmt.Errorf("failed to update active profile selection: %s", err)
	}
	return profile, nil
}

// sortedProfiles returns a list of all of our current profiles sorted by name.
func (db *ProfileDB) sortedProfiles() []*Profile {
	result := make([]*Profile, 0)
	for _, profile := range db.profiles {
		result = append(result, profile)
	}
	sort.Sort(ProfileByName(result))
	return result
}

func (db *ProfileDB) profilesWithSignatureID(id string) []*Profile {
	profiles := make([]*Profile, 0)
	for _, profile := range db.profiles {
		if profile.SignatureID == id {
			profiles = append(profiles, profile)
		}
	}
	return profiles
}

// remove will attempt to remove the profile with the given ID.
func (db *ProfileDB) remove(id string) error {
	profile, exists := db.profiles[id]
	if !exists {
		return fmt.Errorf("profile with ID \"%s\" does not exist", id)
	}
	delete(db.profiles, id)
	if db.ActiveProfileID == id {
		log.Warn().Msgf("Deleting currently active profile \"%s\"", id)
		db.ActiveProfileID = ""
		if err := db.save(); err != nil {
			return fmt.Errorf("failed to update local profile database configuration: %s", err)
		}
	}
	if err := os.RemoveAll(profile.path); err != nil {
		return fmt.Errorf("failed to remove profile directory at %s: %s", profile.path, err)
	}
	log.Debug().Msgf("Deleted profile in path: %s", profile.path)
	return nil
}

func (db *ProfileDB) rename(srcID, destName string) error {
	destID, err := slugify(destName)
	if err != nil {
		return fmt.Errorf("cannot name profile \"%s\": %s", destName, err)
	}
	profile, exists := db.profiles[srcID]
	if !exists {
		return fmt.Errorf("cannot find profile with ID \"%s\"", srcID)
	}
	if _, exists := db.profiles[destID]; exists {
		return fmt.Errorf("desired destination profile with ID \"%s\" already exists", destID)
	}
	oldPath := profile.path
	profile.id = destID
	profile.path = path.Join(db.profilesPath, destID)
	profile.Name = destName

	// rename the folder
	if err := os.Rename(oldPath, profile.path); err != nil {
		return fmt.Errorf("failed to rename folder %s to %s: %s", oldPath, profile.path, err)
	}
	log.Debug().Msgf("Moved folder %s to %s", oldPath, profile.path)
	return profile.Save()
}

func (db *ProfileDB) save() error {
	content, err := json.Marshal(db)
	if err != nil {
		return err
	}
	return ioutil.WriteFile(db.configPath, content, 0644)
}

//------------------------------------------------------------------------------
//
// Profile-related functionality
//
//------------------------------------------------------------------------------

// loadProfile will load the profile from the given profile path.
func loadProfile(profilePath string) (*Profile, error) {
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

//------------------------------------------------------------------------------
//
// ActiveProfile sorting
//
//------------------------------------------------------------------------------

func (p ProfileByName) Len() int { return len(p) }

func (p ProfileByName) Swap(i, j int) {
	t := p[i]
	p[i] = p[j]
	p[j] = t
}

func (p ProfileByName) Less(i, j int) bool { return p[i].Name < p[j].Name }

//------------------------------------------------------------------------------
//
// Helper methods
//
//------------------------------------------------------------------------------

func loadAllProfiles(profilesPath string) (map[string]*Profile, error) {
	files, err := ioutil.ReadDir(profilesPath)
	if err != nil {
		return nil, fmt.Errorf("failed to list profiles in profiles directory \"%s\": %s", profilesPath, err)
	}
	profiles := make(map[string]*Profile)
	for _, fi := range files {
		if !fi.IsDir() {
			continue
		}
		profilePath := path.Join(profilesPath, fi.Name())
		profile, err := loadProfile(profilePath)
		if err != nil {
			return nil, fmt.Errorf("failed to load profile at path \"%s\": %s", profilePath, err)
		}
		profiles[profile.id] = profile
		log.Debug().Msgf("Loaded profile: %v", profile)
	}
	return profiles, nil
}

func initProfiles(home string) error {
	log.Debug().Msgf("Initializing profiles in %s", home)
	// create all the directories we need
	profilesHome := themisContractProfilesPath(home)
	return os.MkdirAll(profilesHome, 0755)
}

func ensureProfileConfig(profileHome string) error {
	profileConfigPath := path.Join(profileHome, "config.json")
	if _, err := os.Stat(profileConfigPath); !os.IsNotExist(err) {
		return nil
	}
	log.Debug().Msgf("No profile configuration exists at %s - creating now", profileConfigPath)
	defProfileConfig := &ProfileDB{
		configPath: profileConfigPath,
	}
	return defProfileConfig.save()
}

func themisContractProfilesPath(home string) string {
	return path.Join(home, "profiles")
}
