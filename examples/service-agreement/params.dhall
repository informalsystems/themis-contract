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
    , currency : Optional Text
    , hourlyRate : Optional Natural
    }

let client : Counterparty =
    { id = "client"
    , name = "Client Org"
    , address = "(Client address goes here)"
    , currency = None Text
    , hourlyRate = None Natural
    }

let supplier : Counterparty =
    { id = "supplier"
    , name = "Bronwyn Savvy (Freelancer)"
    , address = "(Bronwyn Savvy's address goes here)"
    , currency = Some "EUR"
    , hourlyRate = Some 50
    }

{-
    We need to expose a signatory list of this format so that Themis Contract
    can understand who needs to sign the contract.
-}
let signatories : List Signatory =
    [ { id = "manderson"
      , name = "Michael Anderson"
      , email = "manderson@somewhere.com"
      }
    , { id = "bsavvy"
      , name = "Brownyn Savvy"
      , email = "bronwyn@savvy.com"
      }
    ]

{-
    All of the parameters we want to expose during template rendering.
-}
in  { client = client
    , supplier = supplier
    , signatories = signatories
    }
