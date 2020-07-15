package themis_contract

import (
	"os/exec"
	"strings"

	"github.com/rs/zerolog/log"
)

// Diff captures the differences between a contract and its upstream.
type Diff struct {
	ParamsDiff   string
	TemplateDiff string
}

func fileDiff(a, b, diffProg string) (string, error) {
	cmd := exec.Command(diffProg, a, b)
	output, err := cmd.CombinedOutput()
	log.Debug().Msgf("diff output:\n%s", string(output))
	// an exit code of 1 means there was a diff found. if > 1 it was an error.
	if err != nil && cmd.ProcessState.ExitCode() > 1 {
		return "", err
	}
	return strings.Trim(string(output), " \n\r"), nil
}
