{-
    A signatory, in contracting terms, is typically a natural person acting
    on behalf of either themselves or an organization.
-}

let Signatory : Type =
    { id : Text     -- An identifier for this signatory unique in the contract (must be camelCase or snake_case).
    , name : Text   -- A human-readable name for this signatory.
    , email : Text  -- An e-mail address for this signatory.
    }

in Signatory
