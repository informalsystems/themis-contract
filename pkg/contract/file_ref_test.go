package contract_test

import (
	"crypto/sha256"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"testing"

	"github.com/informalsystems/themis-contract/pkg/contract"
)

func TestRelativeFileRefResolution(t *testing.T) {
	tempDir, err := ioutil.TempDir("", "")
	if err != nil {
		t.Fatalf("failed to create temporary directory for testing: %v", err)
	}
	defer os.RemoveAll(tempDir)

	contractPath := path.Join(tempDir, "path", "to", "contract.dhall")
	paramsPath := path.Join(tempDir, "path", "to", "params.dhall")

	testCases := []struct {
		contractLoc string
		relLoc      string
		expected    string
	}{
		{
			contractLoc: contractPath,
			relLoc:      "./params.dhall",
			expected:    paramsPath,
		},
		{
			contractLoc: "https://somewhere.com/path/to/contract.dhall",
			relLoc:      "./params.dhall",
			expected:    "https://somewhere.com/path/to/params.dhall",
		},
		{
			contractLoc: "git://github.com:informalsystems/themis-contract.git/path/to/contract.dhall",
			relLoc:      "./params.dhall",
			expected:    "git://github.com:informalsystems/themis-contract.git/path/to/params.dhall",
		},
	}

	testFileContent := "TEST"
	testFileHash := fmt.Sprintf("%064x", sha256.Sum256([]byte(testFileContent)))
	if err := writeTestFiles([]string{contractPath, paramsPath}, "TEST"); err != nil {
		t.Errorf("failed to write test files: %v", err)
	}

	cache := mockCache{
		successes: map[string]string{
			"https://somewhere.com/path/to/contract.dhall":                                contractPath,
			"https://somewhere.com/path/to/params.dhall":                                  paramsPath,
			"git://github.com:informalsystems/themis-contract.git/path/to/contract.dhall": contractPath,
			"git://github.com:informalsystems/themis-contract.git/path/to/params.dhall":   paramsPath,
		},
	}

	for _, tc := range testCases {
		absRef, err := contract.ResolveFileRef(tc.contractLoc, &cache)
		if err != nil {
			t.Errorf("expected to be able to resolve ref %s, but got error: %v", tc.contractLoc, err)
		}
		relRef, err := contract.ResolveRelFileRef(
			absRef,
			&contract.FileRef{Location: tc.relLoc, Hash: testFileHash},
			&cache,
		)
		if err != nil {
			t.Errorf("expected to be able to resolve relative ref %s, but got error: %v", tc.relLoc, err)
		}
		if tc.expected != relRef.Location {
			t.Errorf("expected relative resolved location of %s, but got %s", tc.expected, relRef.Location)
		}
	}
}

func writeTestFiles(files []string, content string) error {
	for _, f := range files {
		if err := os.MkdirAll(path.Dir(f), 0755); err != nil {
			return err
		}
		if err := ioutil.WriteFile(f, []byte(content), 0644); err != nil {
			return err
		}
	}
	return nil
}
