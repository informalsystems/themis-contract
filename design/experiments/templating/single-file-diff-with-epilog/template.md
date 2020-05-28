# Service Agreement

This agreement takes place between {{client.name}} and {{supplier.name}}.

## General Terms

1. General
2. Terms
3. Go
4. Here

## Optional Terms

These are optional terms which may or may not make their way into the final
contract.

---dhall

let Template : Type =
  {
    source : Text,
    sha256 : Text
  }

let Signatory : Type =
  {
    id : Text,
    name : Text
  }

let Company : Type =
  {
    name : Text,
    signatories : List Signatory
  }

let client : Company =
  {
    name = "Company A",
    signatories = []: List Signatory
  }

let supplier : Company =
  {
    name = "Company B",
    signatories = []: List Signatory
  }

in {
  client,
  supplier
}
