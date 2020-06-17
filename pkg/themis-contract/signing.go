package themis_contract

import "fmt"

func sigImageFilename(sigId string) string {
	return fmt.Sprintf("sig--%s.png", sigId)
}
