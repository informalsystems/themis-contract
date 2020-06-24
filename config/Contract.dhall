{-
    A contract, conceptually, has an optional reference to the upstream contract
    from which it was derived, as well as the template for its content.
-}

let Template = ./Template.dhall
let FileRef = ./FileRef.dhall

let Contract : Type =
    { params : FileRef
    , template : Template
    , upstream : Optional FileRef
    }

in Contract
