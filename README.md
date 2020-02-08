# Neat Contracts 🖋

## Overview
`neat-contract` is a prototype tool to allow for parameterized contracting. It's
currently built using TypeScript on top of [oclif](https://oclif.io/) to speed
up development of the CLI tool.

## Requirements
To run this application, you will need:

* One of the latest [NodeJS](https://nodejs.org/en/) LTS editions
* [Yarn](https://classic.yarnpkg.com/lang/en/) (`npm i -g yarn`)
* [pandoc](https://pandoc.org/)
* [tectonic](https://tectonic-typesetting.github.io/en-US/)

## Installation
Once you have the requirements installed, simply:

```bash
# Clone this repository
> git clone git@github.com:informalsystems/neat-contract.git
> cd neat-contract
> git checkout prototype

# Install the application
> npm i -g

# Run it!
> neat-contract help
```

## Usage

### Contracts

```bash
# Extract all variables from a Handlebars template and use these to generate a
# base contract. Reads `template.html` and writes to `./contract.toml`.
> neat-contract new --template template.html ./contract.toml

# Open up your favourite editor to change `contract.toml`'s parameters
# accordingly.

# Then, when you want to compile your contract. Reads `contract.toml` and
# generates `contract.pdf` using pandoc and tectonic.
> neat-contract compile -o contract.pdf ./contract.toml
```

### Counterparties
To speed things up, you can define counterparties in your local profile that
will eventually 

```bash
# List current stored counterparties
> neat-contract list-counterparties

# Add a counterparty
> neat-contract add-counterparty --id icf --fullname "Interchain Foundation"
```

## Contracts
Contracts, from `neat-contract`'s perspective, are TOML files that specify all
of the necessary components to be able to compile a real-world contract. It's
highly recommended that you keep all aspects of your contract under version
control.

```toml
# Where to find the contract template
template = "template.html"
# You could also specify an HTTP or Git URL for the template
# template = "https://informal.systems/contracts/service-agreement.html"
# (Git support coming soon)
# template = "git+ssh://git@github.com:informalsystems/neat-contracts/service-agreement.html#v0.1.0"

# Counterparties are the various entities involved in a particular contract,
# where each will have signatories that must sign the contract.
counterparties = [
  "icf",
  "company_a"
]

[icf]
full_name = "Interchain Foundation"
# These people must all sign on behalf of the Interchain Foundation.
signatories = [
  "aflemming",
  "ebuchman"
]

[aflemming]
full_names = "Arianne Flemming"
keybase_id = "aflemming"

[ebuchman]
full_names = "Ethan Buchman"
keybase_id = "ebuchman"

[company_a]
# ... similar to icf above
```

## Features Coming Soon

* Fetching of contract templates from Git repositories
* Signing of contracts using local identity (simple image-based signature)
* Cryptographic signing of contracts based on local identity
* Automatic addition of selected counterparties/signatories to new contracts
  upon creation
* Signatory management for stored counterparties
