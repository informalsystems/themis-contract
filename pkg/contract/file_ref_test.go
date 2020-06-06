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

	testCases := []struct {
		abs      string
		absLocal string
		rel      string
		relLocal string
		expected string
	}{
		{
			abs:      path.Join(tempDir, "contract.dhall"),
			absLocal: path.Join(tempDir, "contract.dhall"),
			rel:      "./params.dhall",
			relLocal: path.Join(tempDir, "params.dhall"),
			expected: path.Join(tempDir, "params.dhall"),
		},
		{
			abs:      "https://somewhere.com/path/to/contract.dhall",
			absLocal: path.Join(tempDir, "contract.dhall"),
			rel:      "./params.dhall",
			relLocal: path.Join(tempDir, "params.dhall"),
			expected: "https://somewhere.com/path/to/params.dhall",
		},
	}

	testFileContent := "TEST"
	testFileHash := fmt.Sprintf("%064x", sha256.Sum256([]byte(testFileContent)))

	cache := mockCache{
		successes: map[string]string{
			"https://somewhere.com/path/to/contract.dhall": path.Join(tempDir, "contract.dhall"),
			"https://somewhere.com/path/to/params.dhall":   path.Join(tempDir, "params.dhall"),
		},
		failures: map[string]error{},
	}

	for _, tc := range testCases {
		if err := writeTestFiles([]string{tc.absLocal, tc.relLocal}, "TEST"); err != nil {
			t.Errorf("failed to write test files: %v", err)
		}
		absRef, err := contract.ResolveFileRef(tc.abs, &cache)
		if err != nil {
			t.Errorf("expected to be able to resolve ref %s, but got error %v", tc.abs, err)
		}
		relRef, err := contract.ResolveRelFileRef(
			absRef,
			&contract.FileRef{Location: tc.rel, Hash: testFileHash},
			&cache,
		)
		if err != nil {
			t.Errorf("expected to be able to resolve relative ref %s, but got error %v", tc.rel, err)
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
