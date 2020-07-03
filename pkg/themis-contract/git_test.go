package themis_contract_test

import (
	"encoding/json"
	"testing"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
)

func TestGitURLParsing(t *testing.T) {
	testCases := []struct {
		url      string
		expected *contract.GitURL
	}{
		{
			url: "git://github.com:company/repo.git",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
			},
		},
		{
			url: "git://github.com:company/repo.git#v0.1",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
				Ref:   "v0.1",
			},
		},
		{
			url: "git://github.com:company/repo.git/some/path/file.txt",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
				Path:  "some/path/file.txt",
			},
		},
		{
			url: "git+ssh://github.com:company/repo.git/some/path/file.txt#6699a89a232f3db797f2e280639854bbc4b89725",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
				Path:  "some/path/file.txt",
				Ref:   "6699a89a232f3db797f2e280639854bbc4b89725",
			},
		},
		{
			url: "git+ssh://github.com/company/repo.git/some/path/file.txt#6699a89a232f3db797f2e280639854bbc4b89725",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
				Path:  "some/path/file.txt",
				Ref:   "6699a89a232f3db797f2e280639854bbc4b89725",
			},
		},
		{
			url: "git+ssh://github.com/company/repo.git/some/path/file.txt#branch-with/slash",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
				Path:  "some/path/file.txt",
				Ref:   "branch-with/slash",
			},
		},
		{
			url: "git://git@github.com:company/repo.git/some/path/file.txt#branch-with/slash",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				User:  "git",
				Host:  "github.com",
				Port:  22,
				Repo:  "company/repo.git",
				Path:  "some/path/file.txt",
				Ref:   "branch-with/slash",
			},
		},
		{
			url: "git+https://github.com/company/repo.git/some/path/file.txt#6699a89a232f3db797f2e280639854bbc4b89725",
			expected: &contract.GitURL{
				Proto: contract.ProtoHTTPS,
				Host:  "github.com",
				Port:  443,
				Repo:  "company/repo.git",
				Path:  "some/path/file.txt",
				Ref:   "6699a89a232f3db797f2e280639854bbc4b89725",
			},
		},
		{
			url: "git://gitlab.com:company/group1/group2/repo.git/some/path/file.txt#6699a89a232f3db797f2e280639854bbc4b89725",
			expected: &contract.GitURL{
				Proto: contract.ProtoSSH,
				Host:  "gitlab.com",
				Port:  22,
				Repo:  "company/group1/group2/repo.git",
				Path:  "some/path/file.txt",
				Ref:   "6699a89a232f3db797f2e280639854bbc4b89725",
			},
		},
	}

	for i, tc := range testCases {
		actual, err := contract.ParseGitURL(tc.url)
		if err != nil {
			t.Errorf("expected to successfully parse URL \"%s\", but got error: %v", tc.url, err)
		}
		if *tc.expected != *actual {
			expectedJSON, err := json.MarshalIndent(tc.expected, "", "  ")
			if err != nil {
				t.Fatalf("case %d: failed to serialize expected Git URL: %s", i, err)
			}
			actualJSON, err := json.MarshalIndent(actual, "", "  ")
			if err != nil {
				t.Fatalf("case %d: failed to serialize actual Git URL: %s", i, err)
			}
			t.Errorf("case %d: expected %v, but got %v", i, string(expectedJSON), string(actualJSON))
		}
	}
}
