# Changelog

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
