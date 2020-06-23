package themis_contract_test

import (
	"testing"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
)

func TestWordWrap(t *testing.T) {
	testCases := []struct {
		input     string
		lineWidth int
		expected  string
	}{
		{
			input:     "This is a short line of text",
			lineWidth: 80,
			expected:  "This is a short line of text",
		},
		{
			input:     `This is a longer single line of text, which we expect to be wrapped at 40 characters and no more.`,
			lineWidth: 40,
			expected: `This is a longer single line of text,
which we expect to be wrapped at 40
characters and no more.`,
		},
		{
			input: `This is a longer multi-line string, which we expect to be wrapped at 40 characters and no more.
It carries on on the next line.

We also expect to be able to preserve multiple sequential line breaks (i.e. paragraph breaks).`,
			lineWidth: 40,
			expected: `This is a longer multi-line string,
which we expect to be wrapped at 40
characters and no more.
It carries on on the next line.

We also expect to be able to preserve
multiple sequential line breaks (i.e.
paragraph breaks).`,
		},
		{
			input:     `Long words, like Lopado­temacho­selacho­galeo­kranio­leipsano­drim­hypo­trimmato­silphio­parao­melito­katakechy­meno­kichl­epi­kossypho­phatto­perister­alektryon­opte­kephallio­kigklo­peleio­lagoio­siraio­baphe­tragano­pterygon, should still be parsed and placed on their own line.`,
			lineWidth: 40,
			expected: `Long words, like
Lopado­temacho­selacho­galeo­kranio­leipsano­drim­hypo­trimmato­silphio­parao­melito­katakechy­meno­kichl­epi­kossypho­phatto­perister­alektryon­opte­kephallio­kigklo­peleio­lagoio­siraio­baphe­tragano­pterygon,
should still be parsed and placed on
their own line.`,
		},
	}

	for i, tc := range testCases {
		actual := contract.WordWrapString(tc.input, tc.lineWidth)
		if tc.expected != actual {
			t.Errorf("for test case %d, expected: `%s`, got `%s`", i, tc.expected, actual)
		}
	}
}
