package themis_contract

import (
	"bytes"
	"fmt"
	"net/url"
	"os/exec"
	"regexp"
	"strings"
	"text/template"

	"github.com/rs/zerolog/log"
)

type GitURLProto string

const (
	ProtoSSH   GitURLProto = "git"
	ProtoHTTPS GitURLProto = "https"
)

// The number of characters at which to wrap Git commit messages.
const gitCommitMessageWrap int = 80

const gitURLRegexp = "(?P<proto>[a-z+]+)://(?P<host>[a-z0-9.-]+)[:/](?P<path>[a-zA-Z0-9 ./-]+)(#(?P<fragment>[a-zA-Z0-9/.-]+))?"

// GitURL allows us to parse out the components of a Git repository URL. The
// format for a Git URL is different to a standard URL, so we unfortunately
// can't use Golang's standard URL parsing.
type GitURL struct {
	Proto GitURLProto // The protocol by which we want to access the Git repository.
	Host  string      // The host URL (e.g. "github.com" or "gitlab.com").
	Port  uint16      // The port (default: 22 for SSH, 80 for HTTPS).
	Repo  string      // The repository path (e.g. for GitHub this is `user_name/repo_name.git`).
	Path  string      // The file/folder path within the repository.
	Ref   string      // The branch, commit reference or tag, if any.
}

// ParseGitURL will parse the specified raw URL into a GitURL object, which
// breaks down the different components of a Git repository URL. At present, it
// just always assumes that HTTPS repositories are cloned on port 443 and SSH
// ones on port 22.
// TODO: Handle port parsing properly.
func ParseGitURL(rawurl string) (*GitURL, error) {
	if strings.HasPrefix(rawurl, "git+https://") {
		u, err := url.Parse(rawurl)
		if err != nil {
			return nil, err
		}
		hostname := u.Hostname()
		repo, path := splitGitPath(hostname, u.Path)
		return &GitURL{
			Proto: ProtoHTTPS,
			Host:  hostname,
			Port:  443,
			Repo:  repo,
			Path:  path,
			Ref:   u.Fragment,
		}, nil
	}
	r, err := regexp.Compile(gitURLRegexp)
	if err != nil {
		return nil, err
	}
	matches := r.FindStringSubmatch(rawurl)
	if len(matches) == 0 {
		return nil, fmt.Errorf("cannot parse Git repo URL: %s", rawurl)
	}
	subExps := r.SubexpNames()
	u := &GitURL{
		Proto: ProtoSSH,
		Port:  22,
	}
	for i, match := range matches {
		switch subExps[i] {
		case "proto":
			if match != "git" && match != "git+ssh" {
				return nil, fmt.Errorf("unrecognized protocol in Git repo URL: %s", match)
			}
		case "host":
			u.Host = match
		case "path":
			u.Repo, u.Path = splitGitPath(u.Host, match)
		case "fragment":
			u.Ref = match
		}
	}
	return u, nil
}

func (u *GitURL) RepoURL() string {
	if u.Proto == ProtoSSH {
		return fmt.Sprintf("git://%s:%s", u.Host, u.Repo)
	}
	// otherwise we assume it's HTTPS
	port := ""
	if u.Port != 443 {
		port = fmt.Sprintf(":%d", u.Port)
	}
	return fmt.Sprintf("https://%s%s/%s", u.Host, port, u.Repo)
}

func (u *GitURL) String() string {
	path, ref := "", ""
	if len(u.Path) > 0 {
		path = "/" + u.Path
	}
	if len(u.Ref) > 0 {
		ref = "#" + u.Ref
	}
	return fmt.Sprintf("%s%s%s", u.RepoURL(), path, ref)
}

// gitClone currently wraps simple calls to the `git` executable on the local
// system that clones a remote repository to a local path in the file system.
func gitClone(repoURL, localPath string) error {
	// TODO: Use user-supplier username in cloning.
	repoURL = strings.Replace(repoURL, "git://", "git@", 1)
	log.Info().Msgf("Attempting to clone %s to %s", repoURL, localPath)
	output, err := exec.Command("git", "clone", repoURL, localPath).CombinedOutput()
	log.Debug().Msgf("git clone output:\n%s\n", string(output))
	if err != nil {
		return fmt.Errorf("failed to clone Git repository %s: %v", repoURL, err)
	}
	return nil
}

// gitFetchAndCheckout will fetch the given ref (commit ID, tag, branch) from
// the origin repository and attempt to check the repo out at that ref.
func gitFetchAndCheckout(repoURL, localPath, ref string) error {
	log.Info().Msgf("Fetching ref \"%s\" from %s to %s", ref, repoURL, localPath)
	cmd := exec.Command("git", "fetch", "origin", ref)
	cmd.Dir = localPath
	output, err := cmd.CombinedOutput()
	log.Debug().Msgf("git fetch origin output:\n%s\n", string(output))
	if err != nil {
		return fmt.Errorf("failed to fetch from origin for Git repository %s: %v", repoURL, err)
	}

	cmd = exec.Command("git", "checkout", ref)
	cmd.Dir = localPath
	output, err = cmd.CombinedOutput()
	log.Debug().Msgf("git checkout output:\n%s\n", string(output))
	if err != nil {
		return fmt.Errorf("failed to checkout \"%s\" for Git repository %s: %v", ref, repoURL, err)
	}
	return nil
}

func isGitRepo(repoPath string) bool {
	cmd := exec.Command("git", "status")
	cmd.Dir = repoPath
	output, err := cmd.CombinedOutput()
	log.Debug().Msgf("git status output:\n%s\n", string(output))
	return err == nil
}

func gitInit(repoPath string) error {
	cmd := exec.Command("git", "init")
	cmd.Dir = repoPath
	output, err := cmd.CombinedOutput()
	log.Debug().Msgf("git init output:\n%s\n", string(output))
	return err
}

func gitAddAndCommit(workDir string, commitSpecs []string, rawTemplate string, templateCtx interface{}) error {
	log.Debug().Msgf("Attempting to add %v in \"%s\" to Git repo with commit message template:\n%s\n", workDir, commitSpecs, rawTemplate)
	tpl, err := template.New("git-commit").Parse(rawTemplate)
	if err != nil {
		return fmt.Errorf("failed to parse Git commit template: %s", err)
	}
	var buf bytes.Buffer
	log.Debug().Msgf("Rendering template with context: %v", templateCtx)
	if err := tpl.Execute(&buf, templateCtx); err != nil {
		return fmt.Errorf("failed to render Git commit template: %s", err)
	}
	cmd := exec.Command("git", append([]string{"add"}, commitSpecs...)...)
	cmd.Dir = workDir
	output, err := cmd.CombinedOutput()
	log.Debug().Msgf("git add output:\n%s\n", string(output))
	// we ignore the status of the "add" command because we allow empty commits here
	cmd = exec.Command("git", "commit", "--allow-empty", "-m", wordWrapString(buf.String(), gitCommitMessageWrap))
	cmd.Dir = workDir
	output, err = cmd.CombinedOutput()
	log.Debug().Msgf("git commit output:\n%s\n", string(output))
	if err != nil {
		return fmt.Errorf("failed to commit changes to Git repo in \"%s\": %s", workDir, err)
	}
	return nil
}

// Splits a Git path into its repository and its path.
func splitGitPath(host, path string) (string, string) {
	var repoParts, pathParts []string
	parsingRepo := true
	for _, part := range strings.Split(strings.TrimLeft(path, "/"), "/") {
		if parsingRepo {
			repoParts = append(repoParts, part)
			// TODO: See if we can make this algorithm more robust.
			if strings.HasSuffix(part, ".git") || (host == "github.com" && len(repoParts) == 2) {
				parsingRepo = false
			}
		} else {
			pathParts = append(pathParts, part)
		}
	}
	return strings.Join(repoParts, "/"), strings.Join(pathParts, "/")
}
