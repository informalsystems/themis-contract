package themis_contract

import (
	"fmt"
	"net/http"
	"os"
	"path"

	"github.com/rakyll/statik/fs"
	"github.com/rs/zerolog/log"
)

// Context allows us to keep track of some environmental parameters we need when
// operating on a particular contract.
// TODO: Create a file reference resolver interface member to allow for mocking and better testing.
type Context struct {
	home    string          // The path to the Themis Contract home folder.
	profile *Profile        // The profile to use when performing operations on a specific contract.
	cache   Cache           // The cache we're currently using for storing files we retrieve from remote sources.
	fs      http.FileSystem // For reading static resources pre-built into our binary.
}

// InitContext creates a contracting context using the given Themis Contract
// home directory (usually located at `~/.themis/contract`).
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
	return &Context{
		home:    home,
		profile: profile,
		cache:   cache,
		fs:      statikFS,
	}, nil
}
