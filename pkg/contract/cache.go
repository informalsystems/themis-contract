package contract

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"path"

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
	idx  *FSCacheIndex
}

type FSCacheIndex struct {
	// A map of Git repositories to paths in the local file system.
	GitRepos map[string]string `json:"git"`
	// A map of files fetched from the web (their URLs) to paths in the local
	// file system.
	WebFiles map[string]string `json:"web"`
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
	idx, err := LoadFSCacheIndex(path.Join(root, "index.json"))
	if err != nil {
		return nil, err
	}
	return &FSCache{
		root: root,
		idx:  idx,
	}, nil
}

func (c *FSCache) FromGit(u *GitURL) (string, error) {
	repoURL := u.RepoURL()
	cachedRepoPath, exists := c.idx.GitRepos[repoURL]
	if exists {
		log.Debug().Msgf("Git repository %s is already cached at %s", repoURL, cachedRepoPath)
	} else {
		log.Debug().Msgf("Git repository %s has not yet been cached", repoURL)
		cachedRepoPath = path.Join(c.root, "git", u.Host, u.Repo)
		if err := GitClone(repoURL, cachedRepoPath); err != nil {
			return "", err
		}
	}
	ref := "master"
	if len(u.Ref) > 0 {
		ref = u.Ref
	}
	if err := GitFetchAndCheckout(repoURL, cachedRepoPath, ref); err != nil {
		return "", err
	}
	return cachedRepoPath, nil
}

func (c *FSCache) FromWeb(u *url.URL) (string, error) {
	return "", nil
}

func LoadFSCacheIndex(path string) (*FSCacheIndex, error) {
	stat, err := os.Stat(path)
	if os.IsNotExist(err) {
		// we'll create one later as anything gets added to the cache
		return emptyFSCacheIndex(), nil
	} else if err != nil {
		return nil, err
	}
	if !stat.Mode().IsRegular() {
		return nil, fmt.Errorf("expected cache index to be a regular file, but it was not: %s", path)
	}
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	idx := &FSCacheIndex{}
	if err = json.Unmarshal(content, idx); err != nil {
		return nil, err
	}
	return idx, nil
}

func emptyFSCacheIndex() *FSCacheIndex {
	return &FSCacheIndex{
		GitRepos: make(map[string]string),
		WebFiles: make(map[string]string),
	}
}
