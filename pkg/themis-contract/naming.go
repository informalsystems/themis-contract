package themis_contract

import (
	"fmt"
	"regexp"
	"strings"
)

func slugify(s string) (string, error) {
	re, err := regexp.Compile("[^a-z0-9]+")
	if err != nil {
		return "", fmt.Errorf("failed to compile regular expression for slugify: %s", err)
	}
	return strings.Trim(re.ReplaceAllString(strings.ToLower(s), "-"), "-"), nil
}
