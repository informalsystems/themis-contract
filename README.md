# Themis Contract 🖋

## Overview

Themis Contract is a command line-based tool to help with legal contracting.
It currently aims to:

1. Make contracting modular (in a decentralized way).
2. Make contracting more programmatic (and eventually executable) than is
   traditionally the case.
3. Make managing contracts more like managing software (so we can leverage
   the value that software development processes offer, like version control,
   continuous integration, etc.).

**Disclaimer**

Themis Contract is considered **alpha quality** at present. No semantic
versioning will be used just yet. Breaking changes can be released at any time.
For the original NodeJS-based prototype of Themis Contract, please see the
`prototype/v1` branch.

## Requirements

In order to install Themis Contract locally, you will need:

- Go 1.14+ (and supporting tooling, like `make`)
- [pandoc]
- [pandoc-crossref][]
- Any LaTeX distribution that includes `pdflatex` (such as [MacTeX] for macOS)
- [dhall-to-json]
- Git

## Installation

Once you have the requirements installed locally, you can simply download the
latest [release] binary for your platform (right now we only build for Linux
and MacOS) and put it somewhere in your path (e.g.
`/usr/local/bin/themis-contract`).

To rather install from source:

```bash
git clone https://github.com/informalsystems/themis-contract.git
cd themis-contract
# once-off
make deps
# Setting THEMIS_INSTALL_DIR to our desired location
# (default is to /usr/local/bin/)
THEMIS_INSTALL_DIR=~/.local/bin make install
```

## Usage

See the following tutorials for details as to how to set up and use Themis
Contract to get the most out of it:

- [Setting up Themis Contract](docs/01-setup.md)
- [Your first contract](docs/02-first-contract.md)
- [Contracting workflows](docs/03-workflows.md)
- [Formatting guide](docs/04-formatting.md)

More tutorials will be coming soon!

## Uninstalling

Since Themis Contract is just a single standalone binary, uninstalling just
involves deleting that binary:

```bash
rm /usr/local/bin/themis-contract

# Optional: to delete all Themis Contract-related data
rm -rf ~/.themis/contract
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Copyright 2020 Informal Systems Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

[dhall]: https://dhall-lang.org/
[pandoc]: https://pandoc.org/
[pandoc-crossref]: https://github.com/lierdakil/pandoc-crossref#installation
[mactex]: https://www.tug.org/mactex/
[dhall-to-json]: https://github.com/dhall-lang/dhall-haskell/tree/master/dhall-json
[release]: https://github.com/informalsystems/themis-contract/releases
