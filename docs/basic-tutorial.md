# Basic Contracting Tutorial

Themis Contract allows you to use existing contracts as templates for your new
contracts. For this basic tutorial, we'll be making use of the [service
agreement contract in the `examples` folder](../examples/service-agreement/) of
the repository.

## Step 1: Creating your contract

From the command line, run:

```bash
# You need to be working within a Git repository locally.
git init

# Clones from the `master` branch by default
themis-contract new \
    --template git://github.com:informalsystems/themis-contract/examples/service-agreement/
```

This will clone the given repository into your local repository cache, copy out
the contents of the `service-agreement` folder, and tweak its configuration file
(to link your local contract to the upstream one).

Looking in your current working directory, you should see the following files:

* `contract.dhall` - The contract configuration file.
* `contract.md` - The contract text template.

## Step 2: Compile the contract as-is

To get a feel for compiling a contract, let's compile the current local version
(which should be pretty much identical to the upstream version):

```bash
themis-contract compile
```

This will produce a `contract.pdf` file on the output. Go ahead and open it up
and take a look at all the default values that have been injected into the
contract text.

## Step 3: Edit the contract configuration

Open up `contract.dhall` in your favourite editor and change the relevant values
that you want injected into the contract text template.

## Step 4: Compile the contract again

Compile the contract again and check your `contract.pdf` output artifact to see
if it contains what you want now:

```bash
themis-contract compile
```

Repeat steps 3 and 4 until you're happy with the output.

## Step 5: Sign the contract

When signing a contract, you need to sign *as a particular signatory*. To list
the available signatories' IDs for your current contract:

```bash
themis-contract list-signatories
```

There are currently two ways to sign contracts:

1. Image- and Git-based, where a simple image is generated (using a font of
   your choosing) that contains the signatory's full names. This is committed
   to your local Git repository (and thus assumes you're working in a Git repo).
2. Cryptographically, using [Keybase][keybase].

The contract is already configured to use the image-/Git-based signing, so all
we need to do is:

```bash
themis-contract sign-as userid
```

Now, if you look in the current folder, you should see an image called
`client__userid.png`, where `userid` is your signatory's user ID.

What happens behind the scenes is the following:

1. Themis Contract generates an image containing your signature.
2. The hash of the `contract.dhall` file is computed.
3. The signature image from (1) is committed to your local Git repository, where
   the commit message contains the hash computed in (2).

## Step 6: Compile the contract again

Compile the contract again to build your `contract.pdf` output artifact:

```bash
themis-contract compile
```

You should see your signature in the compiled artifact!

## Step 7: Verify the signatures

To check that the contract is signed by all required parties, we can simply
run:

```bash
themis-contract verify-signatures
```

What this will do, since we're using image-/Git-based signing, is:

1. Check which signatories' signatures are present in the folder.
2. Check the Git commit history for each signature to see what the hash of the
   contract configuration file was at the time of last modifying the signature.
3. If the current `contract.dhall` file's hash is the same as that in the Git
   commit history, then it's considered a valid signature. If a signature is
   missing, or the hash doesn't match, then it's considered invalid.

[keybase]: https://keybase.io/
