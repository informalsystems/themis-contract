{-
    A dummy service agreement contract for services to be rendered by the
    supplier to the client.
-}

let Signatory : Type =
    { id : Text
    , name : Text
    , email : Text
    }

let Counterparty : Type =
    { id : Text
    , name : Text
    , address : Text
    , signatories : List Signatory
    }

let client : Counterparty =
    { id = "client"
    , name = "Client Org"
    , address = "(Client address goes here)"
    , signatories = [
            { id = "manderson"
            , name = "Michael Anderson"
            , email = "manderson@somewhere.com"
            }
        ]
    }

let supplier : Counterparty =
    { id = "supplier"
    , name = "Bronwyn Savvy (Freelancer)"
    , address = "(Bronwyn's address goes here)"
    , signatories = [
            { id = "bsavvy"
            , name = "Bronwyn Savvy"
            , email = "bronwyn@savvy.com"
            }
        ]
    }

let List/map = https://prelude.dhall-lang.org/v16.0.0/List/map
let List/concat = https://prelude.dhall-lang.org/v16.0.0/List/concat

let extractSignatories = \(counterparties : List Counterparty) ->
    List/concat Signatory
        ( List/map
            Counterparty
            (List Signatory)
            (\(counterparty : Counterparty) -> counterparty.signatories)
            counterparties
        )

let counterparties = [ client, supplier ]

{-
    All of the parameters we want to expose during template rendering.
-}
in  { client = client
    , supplier = supplier
    , counterparties = counterparties
    , hourlyRate = 50
    , signatories = extractSignatories counterparties
    }
