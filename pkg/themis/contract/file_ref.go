package contract

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"path"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

type FileRefType string

const (
	LocalRef FileRefType = "local"
	HttpRef  FileRefType = "http"
	GitRef   FileRefType = "git"
)

// FileRef is a reference to a local or remote file. It includes an integrity
// check by way of a mandatory SHA256 hash in the `hash` field.
type FileRef struct {
	Location string `json:"location"` // A URL or file system path indicating the location of the file.
	Hash     string `json:"hash"`     // The SHA256 hash of the file.

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
func ResolveFileRef(loc, cachePath string) (*FileRef, error) {
	return nil, nil
}

// ResolveRelFileRef attempts to resolve a file reference relative to another
// one. Specifically, it will attempt to resolve `rel` against `abs`.
func ResolveRelFileRef(abs, rel *FileRef, cachePath string) (*FileRef, error) {
	if !rel.IsRelative() {
		return nil, fmt.Errorf("supplied path is not relative: %s", rel.Location)
	}
	var err error
	resolved := &FileRef{}
	switch abs.Type() {
	case LocalRef:
		resolved, err = resolveRelLocalFileRef(abs.localPath, rel)
	case HttpRef:
		resolved, err = resolveRelHttpFileRef(abs.Location, rel)
	case GitRef:
		resolved, err = resolveRelGitFileRef(abs.Location, rel)
	}
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
	return nil, nil
}

// CopyTo will attempt to copy the locally cached version of this file to the
// given destination path. It is assumed that the destination path includes the
// full file name of the desired destination file.
func (r *FileRef) CopyTo(destPath string) error {
	return nil
}

// Filename returns just the file name portion of the local copy of the file.
func (r *FileRef) Filename() string {
	_, filename := path.Split(r.localPath)
	return filename
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
	if strings.HasPrefix(r.Location, "http://") || strings.HasPrefix(r.Location, "https://") {
		return HttpRef
	}
	if strings.HasPrefix(r.Location, "git://") {
		return GitRef
	}
	return LocalRef
}

func hashOfFile(path string) (string, error) {
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(sha256.New().Sum(content)), nil
}

func resolveRelLocalFileRef(src string, rel *FileRef) (*FileRef, error) {
	return nil, nil
}

func resolveRelHttpFileRef(src string, rel *FileRef) (*FileRef, error) {
	return nil, nil
}

func resolveRelGitFileRef(src string, rel *FileRef) (*FileRef, error) {
	return nil, nil
}
