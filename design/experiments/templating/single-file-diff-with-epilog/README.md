# Contracting Approach: Single File with Diff and Epilog

This folder contains an example of an approach to building a contract source
file that has the following properties:

1. It's self-contained within a single file (it contains the template, the
   parameters, and the cryptographic signatures).
2. All of the text content of the contract template is placed first in the
   document, emphasizing the text content.
3. All of the parameter values are contained in an epilog at the end of the
   file.
4. It's assumed that the signatures are to be placed last in the epilog, and
   they're generated from all of the content prior to the first signature (i.e.
   the contract template text plus the parameters).

This approach allows us to easily perform a diff of the original template
against the current contract text.
