# Neat Contracts 🖋

![Node.js CI](https://github.com/informalsystems/neat-contract/workflows/Node.js%20CI/badge.svg?branch=master)

**PROTOTYPE**: Note that `neat-contract` is a prototype right now. All code on
this branch is to be considered highly experimental. No semantic versioning will
be used just yet: at present, a `v0.1.x` series is being released. Major version
releases can come out at any time.

## Overview
`neat-contract` is a prototype tool to allow for parameterized contracting. It's
currently built using TypeScript on top of [oclif](https://oclif.io/) to speed
up development of the CLI tool.

## Requirements
To run this application, you will need:

* One of the latest [NodeJS](https://nodejs.org/en/) LTS editions (ideally
  v12.15+)
* [pandoc](https://pandoc.org/) (for transforming Markdown and HTML files to
  LaTeX)
* [tectonic](https://tectonic-typesetting.github.io/en-US/) (for compiling LaTeX
  files to PDF)
* [Keybase CLI](https://keybase.io/) (for cryptographically signing contracts)
* [GraphicsMagick](http://www.graphicsmagick.org/) (for manipulating signature
  images)
* [Ghostscript](https://www.ghostscript.com/) (for image manipulation)
* [Sacramento Font](https://fonts.google.com/specimen/Sacramento) (for
  handwriting-style signatures)

Installing most of the above (except for Keybase, which must be downloaded from
their web site) on macOS:

```bash
brew install node@12 pandoc tectonic graphicsmagick ghostscript
```

## Installation
Once you have the requirements installed, simply:

```bash
# Clone this repository
> git clone git@github.com:informalsystems/neat-contract.git
> cd neat-contract

# Install the application
> npm i -g

# Run it!
> neat-contract help
```

## Usage

### Identities
In order to sign anything, you need to set up one or more **identities** for
yourself. This is a way of organizing your written (image-based) signatures and
(in future) your cryptographic identities.

```bash
# Will ask you interactively for all the relevant fields
> neat-contract save-identity
# ...

# List identities you've saved
> neat-contract list-identities
id            initials     signature     keybase_id       can_sign
manderson     yes          yes           manderson        yes
```

Now you can sign contracts using the identity.

### Contracts

In order to generate a contract, we first need a template. Take a look at the
following contrived HTML-based template. We know up-front that our contract will
take place between the Interchain Foundation (`icf`) and an external contractor
(`contractor`).

```hbs
<h1>New Contract</h1>
<p>Created on {{date}}. Start adding your contract content here.</p>

<p>&nbsp;</p>

<p>Signed by {{icf.full_name}}:</p>

<!-- Here we loop through all the signatories in the "icf" counterparty -->
{{#each icf.signatories}}
  <p>
    {{#if this.has_signed}}
      <img src="{{this.signature_image}}">
    {{else}}
      <i>Still to be signed</i>
    {{/if}}
  </p>
  <p>{{this.full_names}}</p>
{{/each}}

<p>&nbsp;</p>

<p>Signed by {{contractor.full_name}}:</p>

<!-- Here we loop through all the signatories in the "contractor" counterparty -->
{{#each contractor.signatories}}
  <p>
    {{#if this.has_signed}}
      <img src="{{this.signature_image}}">
    {{else}}
      <i>Still to be signed</i>
    {{/if}}
  </p>
  <p>{{this.full_names}}</p>
{{/each}}
```

Now you can use this template to generate a contract with empty variables.
`neat-contract` will do its best to extract what it thinks are the variables
from the specified template.

```bash
# Extract all variables from a Handlebars template and use these to generate a
# base contract. Reads `template.html` and writes to `./contract.toml`.
> neat-contract new --template template.html ./contract.toml

# `neat-contract` tries to open up your favourite editor to change
# `contract.toml`'s parameters accordingly.

# Then, when you want to compile your contract. Reads `contract.toml` and
# generates `contract.pdf` using pandoc and tectonic.
> neat-contract compile -o contract.pdf ./contract.toml
```

You'll notice at this point there are no signatures in the contract. You need to
sign it!

### Using Keybase to Sign and Verify
For an additional level of security, `neat-contract` can use Keybase under the
hood to cryptographically sign a contract.

```bash
> neat-contract sign contract.toml
# ...
```

To verify a cryptographically signed contract:

```bash
> neat-contract verify contract.toml
# ...
```

To verify a cryptographically signed contract prior to compiling:

```bash
> neat-contract compile --verify -o contract.pdf contract.toml
# ...
```

### Signing Contracts Without Installing `neat-contract`
For people who want to sign contracts without installing `neat-contract`, as of
`v0.1.2` you can simply use the Keybase CLI to create a **detached signature**.
Be sure to follow the naming convention though:

```bash
> keybase pgp sign -d -i contract.toml -o counterpartyid__signatoryid.sig
```

Whoever generates the final PDF, however, will need to install `neat-contract`
in order to generate the signature images for the compiling process:

```bash
# Will automagically find any signatures associated with the contract where
# images should be generated. Does not overwrite existing signature images.
> neat-contract gen-sigimages contract.toml

# Alternatively, overwrite existing signature images.
> neat-contract gen-sigimages --overwrite contract.toml

# Specify a custom font for generating signatures.
> neat-contract gen-sigimages --font "Cedarville Cursive" contract.toml
```

### Counterparties
To speed things up when creating contracts, you can define counterparties in
your local profile.

```bash
# List current stored counterparties
> neat-contract list-counterparties

# Save a counterparty
> neat-contract save-counterparty --id icf --fullname "Interchain Foundation"
```

## Contracts
Contracts, from `neat-contract`'s perspective, are TOML files that specify all
of the necessary components to be able to compile a real-world contract. It's
highly recommended that you keep all aspects of your contract under version
control.

```toml
# Counterparties are the various entities involved in a particular contract,
# where each will have signatories that must sign the contract.
counterparties = [
  "icf",
  "contractor"
]

[template]
# Where to find the contract template
source = "template.html"
# You could also specify an HTTP or Git URL for the template
# source = "https://informal.systems/contracts/service-agreement.html"
# (Git support coming soon)
# source = "git+ssh://git@github.com:informalsystems/neat-contracts/service-agreement.html#v0.1.0"

# Optionally specify the format of the template.
# Right now we support both "handlebars" and "mustache" (default is "handlebars")
# format = "mustache"

# For "mustache" templates only, override the default "{{" and "}}" delimiters.
# This is useful in the context of LaTeX templates.
# delimiters = ["<<", ">>"]

# "icf" is one of the counterparties to which we referred earlier in the
# "counterparties" array.
[icf]
full_name = "Interchain Foundation"
# These people must all sign on behalf of the Interchain Foundation.
signatories = [
  "aflemming",
  "ebuchman"
]

# "aflemming" is a signatory, defined in the "icf" counterparties list
[aflemming]
full_names = "Arianne Flemming"
keybase_id = "aflemming"

# "ebuchman" is a signatory, defined in the "icf" counterparties list
[ebuchman]
full_names = "Ethan Buchman"
keybase_id = "ebuchman"

# "contractor" is the other counterparty, defined in the "counterparties"
# array above
[contractor]
full_name = "Company A Consulting"
signatories = [
  "manderson",
]

# "manderson" is the only signatory for the "contractor" counterparty
[manderson]
full_names = "Michael Anderson"
keybase_id = "manderson"
```

## Features Coming Soon

* [DocuSign API](https://developers.docusign.com/esign-rest-api/guides/concepts/overview) integration
