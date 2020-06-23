package themis_contract

func Slugify(s string) (string, error) {
	return slugify(s)
}

func WordWrapString(s string, lineWidth int) string {
	return wordWrapString(s, lineWidth)
}
