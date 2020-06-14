{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = "../../config/package.dhall"

let contract : ThemisContract.Contract =
    { params =
        { location = "params.dhall"
        , hash = "638fc90ca4b62636fbdf94f310b2d0b572e6eb82898e2f5aaac13e404ecaca40"
        }
    , upstream =
		{ location = "examples/service-agreement/contract.dhall"
		, hash = "7726f53bc6c1928ceeac08e2c36db3c9b18068a3fb4f6cab13543fba578a5776"
		}
    , template =
        { format = ThemisContract.TemplateFormat.Mustache
        , file =
            { location = "contract.md"
            , hash = "1605f2b3cc3e8ebf1751ea47bbe05fb0f3fc7de743182ad8ef5dc2d570e721b5"
            }
        }
    }

in contract