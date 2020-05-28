# Contracting Approach: Single File with Diff

This folder showcases what contracting could look like if, instead of deriving
contracts from templates, we rather just make the new contract a full copy of
the original template with a reference in the preamble to the original template.

It also embeds the parameters into the contract text itself, doing away with the
need for a separate parameters file.

This way we don't need complex templating, and diffs are incredibly easy to see.

Run the `./contract-diff.sh` script to see a simple diff of the text (minus the
preamble) of the template compared to the contract.
