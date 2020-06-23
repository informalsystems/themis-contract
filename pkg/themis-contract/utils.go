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

func wordWrapString(s string, lineWidth int) string {
	wrapped := ""
	for i, line := range strings.Split(s, "\n") {
		if i > 0 {
			wrapped = wrapped + "\n"
		}
		if len(line) <= lineWidth {
			wrapped = wrapped + line
			continue
		}
		wrapped = wrapped + wordWrapLine(line, lineWidth)
	}
	return wrapped
}

func wordWrapLine(l string, lineWidth int) string {
	words := strings.Split(l, " ")
	if len(words) == 1 {
		return words[0]
	}
	wrapped := ""
	// the current line we're stringing together
	lineBuf := words[0]
	// the current line terminator (starts off empty)
	lineTerm := ""
	for _, word := range words[1:] {
		if len(lineBuf+" "+word) > lineWidth {
			wrapped = wrapped + lineTerm + lineBuf
			lineBuf = word
			lineTerm = "\n"
			continue
		}
		lineBuf = lineBuf + " " + word
	}
	if len(lineBuf) > 0 {
		wrapped = wrapped + lineTerm + lineBuf
	}
	return wrapped
}
