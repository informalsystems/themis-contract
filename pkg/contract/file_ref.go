package contract

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

type FileRefType string

const (
	LocalRef FileRefType = "local"
	WebRef   FileRefType = "web"
	GitRef   FileRefType = "git"
)

// FileRef is a reference to a local or remote file. It includes an integrity
// check by way of a mandatory SHA256 hash in the `hash` field.
type FileRef struct {
	Location string `json:"location" yaml:"location" toml:"location"` // A URL or file system path indicating the location of the file.
	Hash     string `json:"hash" yaml:"hash" toml:"hash"`             // The SHA256 hash of the file.

	localPath string
}

// LocalFileRef creates a FileRef assuming that the file is in the local file
// system and is accessible.
func LocalFileRef(path string) (*FileRef, error) {
	hash, err := hashOfFile(path)
	if err != nil {
		return nil, err
	}
	localPath, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	return &FileRef{
		Location:  path,
		Hash:      hash,
		localPath: localPath,
	}, nil
}

// ResolveFileRef will attempt to resolve the file at the given location. If it
// is a remote file, it will be fetched from its location and cached locally in
// the given cache path.
func ResolveFileRef(loc string, cache Cache) (resolved *FileRef, err error) {
	switch fileRefType(loc) {
	case LocalRef:
		resolved, err = LocalFileRef(loc)
		log.Debug().Msgf("Resolved location \"%s\" as a local file", loc)
	case WebRef:
		var u *url.URL
		u, err = url.Parse(loc)
		if err != nil {
			return
		}
		resolved, err = resolveWebFileRef(u, cache)
		log.Debug().Msgf("Resolved location \"%s\" as a file on the web", loc)
	case GitRef:
		var u *GitURL
		u, err = ParseGitURL(loc)
		if err != nil {
			return
		}
		resolved, err = resolveGitFileRef(u, cache)
		log.Debug().Msgf("Resolved location \"%s\" as file in a Git repository", loc)
	}
	return
}

// ResolveRelFileRef attempts to resolve a file reference relative to another
// one. Specifically, it will attempt to resolve `rel` against `abs`.
// TODO: Implement security check here to prevent user escaping to host file system.
func ResolveRelFileRef(abs, rel *FileRef, cache Cache) (resolved *FileRef, err error) {
	if !rel.IsRelative() {
		return nil, fmt.Errorf("supplied path is not relative: %s", rel.Location)
	}
	switch abs.Type() {
	case LocalRef:
		var absPath string
		absPath, err = filepath.Abs(abs.localPath)
		if err != nil {
			return nil, err
		}
		absPath = path.Dir(absPath)
		resolved, err = resolveRelLocalFileRef(absPath, rel.Location)
	case WebRef:
		resolved, err = resolveRelWebFileRef(abs.Location, rel.Location, cache)
	case GitRef:
		resolved, err = resolveRelGitFileRef(abs.Location, rel.Location, cache)
	}
	log.Debug().Msgf("Resolved relative file reference: %v", resolved)
	if err != nil {
		return nil, err
	}
	if resolved.Hash != rel.Hash {
		log.Error().
			Str("source", rel.Hash).
			Str("resolved", resolved.Hash).
			Msg("Hash mismatch")
		return nil, fmt.Errorf("hash mismatch")
	}
	return
}

// CopyTo will attempt to copy the locally cached version of this file to the
// given destination path. It is assumed that the destination path includes the
// full file name of the desired destination file.
func (r *FileRef) CopyTo(destPath string) error {
	content, err := ioutil.ReadFile(r.localPath)
	if err != nil {
		return err
	}
	return ioutil.WriteFile(destPath, content, 0644)
}

// Filename returns just the file name portion of the local copy of the file.
func (r *FileRef) Filename() string {
	_, filename := path.Split(r.localPath)
	return filename
}

// Dir returns just the directory name portion of the local copy of the file.
func (r *FileRef) Dir() string {
	dir, _ := path.Split(r.localPath)
	return dir
}

// Ext returns the extension of the file.
func (r *FileRef) Ext() string {
	return path.Ext(r.localPath)
}

// ReadAll attempts to read the contents of the local copy of the file into
// memory as a string.
func (r *FileRef) ReadAll() (string, error) {
	content, err := ioutil.ReadFile(r.localPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// IsRelative provides a simple check to see whether this file reference is
// relative to another file reference.
func (r *FileRef) IsRelative() bool {
	return strings.HasPrefix(r.Location, ".")
}

func (r *FileRef) Type() FileRefType {
	return fileRefType(r.Location)
}

// LocalRelPath returns the path of the local copy of this file relative to
// the specified base file's path.
func (r *FileRef) LocalRelPath(base string) (string, error) {
	baseAbs, err := filepath.Abs(base)
	if err != nil {
		return "", err
	}
	localAbs, err := filepath.Abs(r.localPath)
	if err != nil {
		return "", err
	}
	return filepath.Rel(baseAbs, localAbs)
}

func hashOfFile(path string) (string, error) {
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return "", err
	}
	hashBytes := sha256.Sum256(content)
	hashSlice := make([]byte, len(hashBytes))
	copy(hashSlice[:], hashBytes[:])
	hash := hex.EncodeToString(hashSlice)
	log.Debug().Msgf("Computed hash of %s as %s", path, hash)
	return hash, nil
}

func resolveRelLocalFileRef(src, rel string) (*FileRef, error) {
	absPath, err := filepath.Abs(path.Join(src, rel))
	if err != nil {
		return nil, err
	}
	log.Debug().Str("src", src).Str("rel", rel).Msgf("Resolved absolute path: %s", absPath)
	return LocalFileRef(absPath)
}

func resolveRelWebFileRef(src, rel string, cache Cache) (*FileRef, error) {
	srcUrl, err := url.Parse(src)
	if err != nil {
		return nil, err
	}
	relUrl, err := url.Parse(rel)
	if err != nil {
		return nil, err
	}
	resolvedUrl := srcUrl.ResolveReference(relUrl)
	return resolveWebFileRef(resolvedUrl, cache)
}

func resolveRelGitFileRef(src, rel string, cache Cache) (*FileRef, error) {
	srcUrl, err := ParseGitURL(src)
	if err != nil {
		return nil, err
	}
	cachedPath, err := cache.FromGit(srcUrl)
	if err != nil {
		return nil, err
	}
	srcPath := path.Join(cachedPath, path.Join(strings.Split(srcUrl.Path, "/")...))
	relPath, err := filepath.Abs(path.Join(srcPath, rel))
	if err != nil {
		return nil, err
	}
	relUrl := &GitURL{
		Proto: srcUrl.Proto,
		Host:  srcUrl.Host,
		Port:  srcUrl.Port,
		Repo:  srcUrl.Repo,
		Path:  strings.Join(filepath.SplitList(relPath), "/"),
		Ref:   srcUrl.Ref,
	}
	return resolveGitFileRef(relUrl, cache)
}

func resolveWebFileRef(u *url.URL, cache Cache) (*FileRef, error) {
	cachedPath, err := cache.FromWeb(u)
	if err != nil {
		return nil, err
	}
	return cachedFileRef(u.String(), cachedPath)
}

func resolveGitFileRef(u *GitURL, cache Cache) (*FileRef, error) {
	cachedPath, err := cache.FromGit(u)
	if err != nil {
		return nil, err
	}
	return cachedFileRef(u.String(), cachedPath)
}

func cachedFileRef(loc, cachedPath string) (*FileRef, error) {
	hash, err := hashOfFile(cachedPath)
	if err != nil {
		return nil, err
	}
	return &FileRef{
		Location:  loc,
		Hash:      hash,
		localPath: cachedPath,
	}, nil
}

func fileRefType(loc string) FileRefType {
	if strings.HasPrefix(loc, "http://") || strings.HasPrefix(loc, "https://") {
		return WebRef
	}
	if strings.HasPrefix(loc, "git") {
		return GitRef
	}
	return LocalRef
}
