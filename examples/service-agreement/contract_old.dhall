{-
    A dummy service agreement contract for services to be rendered by the
    supplier to the client.
-}

-- TODO: Use absolute URLs to GitHub repo here
let ThemisContract = ../../config/package.dhall

let Organization : Type =
    { id : Text
    , name : Text
    , address : Text
    , signatories : List ThemisContract.Signatory
    }

let client : Organization =
    { id = "client"
    , name = "Client Org"
    , address = "(Client address goes here)"
    , signatories = [
            { id = "manderson"
            , name = "Michael Anderson"
            , email = "manderson@fakedomain.com"
            }
        ]
    }

let Signatory : Type =
    { id : Text
    , name : Text
    , email : Text
    , phone : Text   -- Custom field not in ThemisContract.Signatory
    }

let supplier : Signatory =
    { id = "bsavvy"
    , name = "Bronwyn Savvy"
    , email = "bronwyn@savvy.com"
    , phone = "123-1234"
    }

let Counterparty = < Org : Organization | Ind : Signatory >

{- We need this function to strip out the non-Themis Contract fields -}
let toThemisCounterparty =
    \(counterparty : Counterparty) ->
        merge
            { Org = \(org : Organization) ->
                ThemisContract.Counterparty.Organization { id = org.id
                , name = org.name
                , signatories = org.signatories
                }
            , Ind = \(ind : Signatory) ->
                ThemisContract.Counterparty.Individual { id = ind.id
                , name = ind.name
                , email = ind.email
                }
            }
            counterparty

let config : ThemisContract.Contract = ./config.dhall
    [ toThemisCounterparty (Counterparty.Org client)
    , toThemisCounterparty (Counterparty.Ind supplier)
    ]

{-
    Inject any other parameters here that you would like to expose to the
    template. Themis Contract only cares about the `config` variable you expose
    here to help with contract configuration, and it must be of type
    `ThemisContract.Contract`.
-}
in  { client = client
    , supplier = supplier
    , hourlyRate = "50"
    , config = config
    }
