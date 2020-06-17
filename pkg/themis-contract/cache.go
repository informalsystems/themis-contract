package themis_contract

import (
	"fmt"
	"net/url"
	"os"
	"path"
	"strings"

	"github.com/rs/zerolog/log"
)

// Cache allows us to store and access local copies of remote files/folders.
type Cache interface {
	// FromGit will ensure that the file/folder referenced by the given Git URL
	// is in the cache. On success, returns the file system path to the
	// file/folder requested in the URL.
	FromGit(u *GitURL) (string, error)

	// FromWeb will ensure that the file referenced by the given URL is in the
	// cache. On success, returns the file system path to the file requested in
	// the URL.
	FromWeb(u *url.URL) (string, error)
}

// FSCache allows us to cache files and folders we've fetched from remote
// sources. It caches them locally in the file system.
type FSCache struct {
	root string
}

var _ Cache = &FSCache{}

// OpenFSCache will open an existing file cache at the given path in the file
// system, or will create the relevant paths/files to facilitate the cache.
func OpenFSCache(root string) (*FSCache, error) {
	// ensure that the root of the cache folder exists
	err := os.MkdirAll(root, 0755)
	if err != nil {
		return nil, err
	}
	return &FSCache{
		root: root,
	}, nil
}

func (c *FSCache) FromGit(u *GitURL) (string, error) {
	log.Debug().Msgf("Looking up cached entries for Git URL: %s", u)
	repoURL := u.RepoURL()
	cachedRepoPath := path.Join(c.root, "git", u.Host, u.Repo)
	exists, err := dirExists(cachedRepoPath)
	if err != nil {
		return "", err
	}
	if exists {
		log.Debug().Msgf("Git repository %s is already cached at %s", repoURL, cachedRepoPath)
	} else {
		log.Debug().Msgf("Git repository %s has not yet been cached", repoURL)
		if err := gitClone(repoURL, cachedRepoPath); err != nil {
			return "", err
		}
	}
	ref := "master"
	if len(u.Ref) > 0 {
		ref = u.Ref
	}
	if err := gitFetchAndCheckout(repoURL, cachedRepoPath, ref); err != nil {
		return "", err
	}
	return path.Join(cachedRepoPath, path.Join(strings.Split(u.Path, "/")...)), nil
}

// FromWeb attempts to fetch the file at the given URL, caching it locally in
// the file system.
// TODO: Implement caching (right now we always just fetch the file).
func (c *FSCache) FromWeb(u *url.URL) (string, error) {
	destFile := path.Join(c.root, "web", u.Host, path.Join(strings.Split(u.Path, "/")...))
	if err := downloadFile(u, destFile); err != nil {
		return "", err
	}
	return destFile, nil
}

func dirExists(d string) (bool, error) {
	stat, err := os.Stat(d)
	if os.IsNotExist(err) {
		return false, nil
	}
	if !stat.IsDir() {
		return false, fmt.Errorf("expected %s to be a directory, but it was not", d)
	}
	return true, nil
}
