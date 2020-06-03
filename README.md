# Themis Contract 🖋

**PROTOTYPE**: Note that `themis-contract` is a prototype right now. All code on
this branch is to be considered highly experimental. No semantic versioning will
be used just yet: at present, a `v0.2.x` series is being released. Breaking
changes can be released at any time.

If you're looking for the TypeScript-based prototype, it's currently on the
`prototype/v1` branch.

## Overview

Themis Contract is a prototype tool to help with legal contracting. It currently
aims to:

1. Make contracting modular (in a decentralized way).
2. Make contracting more programmatic (and eventually executable) than is
   traditionally the case.
3. Make managing contracts more like managing software (so we can leverage
   the value that software development processes offer, like version control,
   continuous integration, etc.).

## Requirements

It's recommended right now that you use the Docker-based version of Themis
Contract. To do so you'll just need Docker installed, of course.

This is currently only being tested on macOS and Linux.

## Installation

We have a shell script that you can use locally to interact with the Docker
image on your local machine. It tries to take care of many of the painful
aspects of using the Docker image, like mounting the right volumes.

```bash
# Fetch the themis-contract shell script
curl -sSL \
    https://raw.githubusercontent.com/informalsystems/themis-contract/master/scripts/themis-contract \
    -o /usr/local/bin/themis-contract

# Make the script executable
chmod +x /usr/local/bin/themis-contract

# Test it's installed correctly
themis-contract --version
```

## Usage

See the following tutorials for details as to how to set up and use Themis
Contract to get the most out of it:

* [Setting up Themis Contract](./docs/setup.md)
* [Basic contracting tutorial](./docs/basic-tutorial.md)
* [Anatomy of a contract](./docs/contract-anatomy.md)

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
[tectonic]: https://tectonic-typesetting.github.io/
