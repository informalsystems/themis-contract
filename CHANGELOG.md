# Changelog

## Unreleased

* Update Dhall contract template to use the package configuration on `master`
  ([\#72](https://github.com/informalsystems/themis-contract/pull/72))

## v0.2.3

* Fix some minor spelling mistakes in the CLI help
  ([\#71](https://github.com/informalsystems/themis-contract/pull/71)).

## v0.2.2

* Fix a critical bug that prevents signing of a contract
  ([\#70](https://github.com/informalsystems/themis-contract/pull/70)).

## v0.2.1

* Fix a critical compilation bug that prevented signature image details from
  being provided during compilation
  ([\#69](https://github.com/informalsystems/themis-contract/pull/69))

## v0.2

* Completely rebuilt in Go.
* Totally different CLI (see [README](README.md) for details).

## Unreleased (`prototype/v1` branch)

* Remove `--style` flag from `compile` subcommand
  ([#21](https://github.com/informalsystems/themis-contract/pull/21))
* Add `--defaults` flag to `compile` command, allowing pass through of a pandoc
  defaults file. ([#21](https://github.com/informalsystems/themis-contract/pull/21))
* Add `init` subcommand for initializing user environment 
  ([#21](https://github.com/informalsystems/themis-contract/pull/21))
* Add `Dockerfile`
  ([\#51](https://github.com/informalsystems/themis-contract/pull/51)).

## v0.1.6

* Rename `neat-contract` to `themis-contract`

## v0.1.5

* [\#13](https://github.com/informalsystems/themis-contract/pull/13) - Report
  reason for TOML parsing errors.

## v0.1.4

* Switch default PDF engine to **tectonic**

## v0.1.3

* Make cryptographic signing with Keybase the default option for the `sign`
  command

## v0.1.2

* Add prerequisite fonts to `fonts` folder
* Add installation script to `scripts/install.sh`
* Add `gen-sigimages` command to allow for generation of signature images from
  detached cryptographic signature files

## v0.1.1

* Allow users to specify font spec for signature when signing using Keybase
* Add support for Keybase-based signing and verification

## v0.1.0
First prototype release with basic functionality:

* Contract creation from templates
* Parameter substitution
  * Right now only TOML-based contracts are supported
* PDF generation
  * Uses `pandoc` and `tectonic`
* Templating support:
  * Support for Mustache templates
  * Support for Handlebars templates
  * Templates can be in pretty much any format that `pandoc` supports
  * LaTeX templates are not passed through `pandoc`, they are compiled directly
    with `tectonic`
  * Support for using templates located locally on the file system (absolute or
    relative paths)
  * Support for fetching remote templates
    * Via HTTPS
    * Via Git
* Signing of contracts
  * Can sign with a simple image-based signature
  * Can sign cryptographically using Keybase signatures
* Saving counterparties and signatories for easy insertion into contracts
* Saving identities for quick use when signing
