package themis_contract_test

import (
	"crypto/sha256"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"testing"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
)

func TestRelativeFileRefResolution(t *testing.T) {
	tempDir, err := ioutil.TempDir("", "")
	if err != nil {
		t.Fatalf("failed to create temporary directory for testing: %v", err)
	}
	defer os.RemoveAll(tempDir)

	contractPath := path.Join(tempDir, "path", "to", "contract.dhall")
	paramsPath := path.Join(tempDir, "path", "to", "params.dhall")

	testCases := []string{
		contractPath,
		"contract-test",
		"https://somewhere.com/path/to/contract.dhall",
		"git://github.com:informalsystems/themis-contract.git/path/to/contract.dhall",
	}

	testFileContent := "TEST"
	testFileHash := fmt.Sprintf("%064x", sha256.Sum256([]byte(testFileContent)))
	if err := writeTestFiles([]string{contractPath, paramsPath}, "TEST"); err != nil {
		t.Errorf("failed to write test files: %v", err)
	}

	cache := &mockCache{
		successes: map[string]string{
			"https://somewhere.com/path/to/contract.dhall":                                contractPath,
			"https://somewhere.com/path/to/params.dhall":                                  paramsPath,
			"git://github.com:informalsystems/themis-contract.git/path/to/contract.dhall": contractPath,
			"git://github.com:informalsystems/themis-contract.git/path/to/params.dhall":   paramsPath,
		},
	}
	activeProfile := contract.NewTestProfile(
		"test",
		"git://github.com/informalsystems/contract-templates.git",
		[]*contract.ProfileContract{
			contract.NewTestProfileContract("contract-test", "git://github.com/informalsystems/contract-templates.git", contractPath),
		},
	)
	ctx := contract.NewTestContext(cache, activeProfile)

	for _, tc := range testCases {
		absRef, err := contract.ResolveFileRef(tc, "", false, ctx)
		if err != nil {
			t.Errorf("expected to be able to resolve ref %s, but got error: %v", tc, err)
		}
		_, err = contract.ResolveRelFileRef(
			absRef,
			&contract.FileRef{Location: "./params.dhall", Hash: testFileHash},
			true,
			ctx,
		)
		if err != nil {
			t.Errorf("expected to be able to resolve relative ref \"./params.dhall\", but got error: %v", err)
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
