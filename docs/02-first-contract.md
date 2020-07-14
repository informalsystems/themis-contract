# Your First Contract

Once you've completed the [setup](01-setup.md) tutorial and have a signature
and profile ready to use, you can now get started on crafting your first
contract.

You probably already have your contract text available in some format. For
simplicity's sake, we'll assume for now that your contract text is written in
Markdown (or that you've used [pandoc] to convert your contract text to
Markdown).

[Example files](../examples/service-agreement/) are included in the repository
for this basic tutorial.

## Step 1: Create a local Git repo for your contract

Themis Contract assumes that all the files relating to a contract are stored
within the same folder. Themis Contract also wraps interaction with Git to
automatically push/pull changes to your contract.

```bash
cd /path/to/working/dir
mkdir my-first-contract
cd my-first-contract

# We ensure the contract's repository's initialized as a Git repository
git init
git remote add origin git@github.com/you/my-first-contract.git
```

## Step 2: Get your template ready

```bash
# Copy your template text to the repo folder
cp /path/to/contract/template.md .
```

Now you need to parameterize your template. Themis Contract uses 
[Mustache][mustache] as its template language due to its simplicity (and if
you need any complexity in terms of calculations or inclusion of external
data, you can rather define this in your contract parameters - we'll get to this
later in this tutorial).

Let's use the following as an example `template.md` file, which has already
been parameterized:

```markdown
# Service Agreement

This service agreement is agreed upon by the following parties:

* {{client.name}}, located at {{client.address}}
* {{supplier.name}}, located at {{supplier.address}}

## Terms of Service

1. Some
2. Terms
3. Will
4. Go
5. Here

## Hourly Rate

The hourly rate will be {{supplier.currency}} {{supplier.hourlyRate}}.

## Signatures

Signed,

{{#signatories}}
![Signature]({{signature}}) \
{{name}}

Signed on: {{signed_date}}

{{/signatories}}
```

You'll see here that a number of Mustache variables (in `{{curlybraces}}`) have
been set up in this template. When compiling your contract to a PDF, Themis
Contract will attempt to inject values for these variables into your template
prior to rendering the PDF.

Where do these values come from? They come from your *parameters file(s)*.

## Step 3: Set up your parameters

We generally recommend that you set up your contract's parameters using
[Dhall][dhall], but Themis Contract also supports JSON, YAML and TOML-based
parameters files.

Here's an example parameters file, in Dhall, for the contract template used in
step 2:

```dhall
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
      , name = "Bronwyn Savvy"
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
```

There's only one mandatory field that you need to expose for Themis Contract
to be able to compile your contract, and that's the `signatories` field. This
field needs to be an **array**, where each item, at minimum, needs the following
fields:

* `id` - A unique identifier to associate with this signatory. This should be
  lowercase, ideally using `snake_case`.
* `email` - An e-mail address to associate with this signatory.
* `name` - A human-readable name for this signatory. Usually the signatory's
  full names.

You can define additional fields here, and they will be passed through to your
template when rendering the template.

## Step 4: Configure your contract

In Themis Contract terminology, a "contract", technically, is a single
Dhall file that exposes 3 parameters:

* `params` - Details of your parameters file. This field must additionally
  contain sub-fields:
  * `location` - Where to find your parameters file.
  * `hash` - The SHA256 hash of the parameters file (an integrity check).
* `template` - Details of your template file. This field must additionally
  contain sub-fields:
  * `format` - By default we use Mustache as our templating language.
  * `file` - Details of the template file itself:
    * `location` - Where to find the template file.
    * `hash` - The SHA256 hash of your template file (another integrity check).
* `upstream` - If your contract was derived from another contract, this field
  should contains details of the upstream contract. This will allow you to see
  the differences between your contract template/parameters and those of the
  upstream contract. In our case here we won't have an upstream contract.
  
Here is an example contract that ties together our template from step 2 and our
parameters file from step 3, which you can save as `contract.dhall`:

```dhall
{-
    Do not modify this file - it is automatically generated and managed by
    Themis Contract. Any changes may be automatically overwritten.
-}

let ThemisContract = https://raw.githubusercontent.com/informalsystems/themis-contract/prototype/v2/config/package.dhall
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
```

## Step 5: Modify and update your contract

You should be able to tweak your parameters and template to your needs now.
Once you're done, you won't be able to compile your contract yet because the
SHA256 hashes in your `contract.dhall` file probably won't match up with the
hashes of your parameters/template file(s).

To update your `contract.dhall` file, Themis Contract provides a simple command:

```bash
# Assumes your contract is located in a `contract.dhall` file in the current
# working directory. This will also add and commit all your files to your Git
# repository and automatically push the changes.
themis-contract update

# To avoid committing/pushing the changes:
themis-contract update --no-auto-commit

# To commit the changes without pushing yet:
themis-contract update --no-auto-push
```

## Step 6: Compile your contract

Compiling a PDF from your contract should be pretty easy now:

```bash
# Automatically looks for a `contract.dhall` file in the current working
# directory, and produces a PDF file called `contract.pdf`.
themis-contract compile
```

Note that this command doesn't automatically commit and update your Git
repository.

## Step 7: Sign your contract

Finally, one of the most important things you can do with a contract is sign
it. You already set up your signature and profile in the
[setup tutorial](01-setup.md), so now you just need to sign your contract on
behalf of a specific signatory.

By default, Themis Contract tries to guess which signatory you're signing as
based on the e-mail address of your currently active profile. If you want to
specify the signatory on behalf of whom you're signing, you can do so using the
`--as` flag (see `themis-contract sign -h` for details).

First, let's just list the existing signatories on the contract:

```bash
# Lists all signatories in the `contract.dhall` file in the current working
# directory
themis-contract list-signatories
```

If you haven't modified the `params.dhall` file from step 3 above, you should
see a listing of our two predefined signatories "Michael Anderson"
(id `manderson`) and "Bronwyn Savvy" (id `bsavvy`).

```bash
# Try to autodetect which signatory to sign as based on your currently active
# profile's e-mail address 
themis-contract sign

# Or you can manually specify the signatory ID
themis-contract sign --as bsavvy
```

This will automatically sign the contract, commit the signature and act of
signing to your Git repository, and push the changes to your remote Git repo.

## Next Steps

In the [next tutorial](03-workflows.md), we'll see how to supercharge your
contracting workflows by reducing the number of steps you need to execute
contracts. We'll also cover some of the benefits of why using Git repositories
is a great solution to contract negotiation.

[pandoc]: https://pandoc.org/
[mustache]: https://mustache.github.io/
[dhall]: https://dhall-lang.org/
