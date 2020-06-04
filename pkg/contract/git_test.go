package contract_test

import (
	"testing"

	"github.com/informalsystems/themis-contract/pkg/contract"
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
	}

	for _, tc := range testCases {
		actual, err := contract.ParseGitURL(tc.url)
		if err != nil {
			t.Errorf("expected to successfully parse URL \"%s\", but got error: %v", tc.url, err)
		}
		if *tc.expected != *actual {
			t.Errorf("expected %v, but got %v", tc.expected, actual)
		}
	}
}
