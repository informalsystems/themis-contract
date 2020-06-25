{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = https://raw.githubusercontent.com/informalsystems/themis-contract/prototype/v2/config/package.dhall
    sha256:016b3829eaee279f2ce7a740a974f1ac75758893c42d220865a487c35ff9a890

let contract : ThemisContract.Contract =
    { params =
        { location = "params.dhall"
        , hash = "aa7a53a2bf16c44b0df8839e1bbc2529b30194e6467dd5300da4dcb56f01a9f0"
        }
    , upstream = None ThemisContract.FileRef
    , template =
        { format = ThemisContract.TemplateFormat.Mustache
        , file =
            { location = "contract.md"
            , hash = "2625bcb1d6d32377fded81c4d49472bfe894bf5c65377734ce38534598c390ea"
            }
        }
    }

in contract