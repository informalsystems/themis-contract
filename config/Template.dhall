{-
    A contract content template is a text file that contains the actual wording
    of most of the contract, but is parameterized according to the configured
    templating language.
-}

let TemplateFormat = ./TemplateFormat.dhall
let FileRef = ./FileRef.dhall

let Template : Type =
    { format : TemplateFormat
    , file : FileRef
    }

in Template
