#!/bin/bash
set -e

extract_text() {
  python3 -c 'import sys; data = "".join(sys.stdin.readlines()).split("---")[2]; print(data.strip());'
}

extract_text < ./template.md > /tmp/template_text.md
extract_text < ./contract.md > /tmp/contract_text.md

echo "Comparing template text (LHS) to contract text (RHS)"
echo "----------------------------------------------------"
diff /tmp/template_text.md /tmp/contract_text.md
