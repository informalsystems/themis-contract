{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = https://raw.githubusercontent.com/informalsystems/themis-contract/master/config/package.dhall
    sha256:016b3829eaee279f2ce7a740a974f1ac75758893c42d220865a487c35ff9a890

let contract : ThemisContract.Contract =
    { params =
        { location = "params.dhall"
        , hash = "4cbd373af2669e5c5fc5ffc7ecd02abc16aa8fc0855f1de712a7940bb2245aee"
        }
    , upstream = None ThemisContract.FileRef
    , template =
        { format = ThemisContract.TemplateFormat.Mustache
        , file =
            { location = "contract.md"
            , hash = "6212e73deb62a698f2cf6178ab48cdd5a5615504253d5c0d06fa058ca369d1d0"
            }
        }
    }

in contract