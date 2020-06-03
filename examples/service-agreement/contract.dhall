{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = ../../config/package.dhall

let contract : ThemisContract.Contract =
    { params =
        { location = "./params.dhall"
        , hash = "1605f2b3cc3e8ebf1751ea47bbe05fb0f3fc7de743182ad8ef5dc2d570e721b5"
        }
    , upstream = None ThemisContract.FileRef
    , template =
        { format = ThemisContract.TemplateFormat.Mustache
        , file =
            { location = "./contract.md"
            , hash = "1605f2b3cc3e8ebf1751ea47bbe05fb0f3fc7de743182ad8ef5dc2d570e721b5"
            }
        }
    }

in contract
