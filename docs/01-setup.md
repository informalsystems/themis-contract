# Setting up Themis Contract

This brief tutorial assumes you have already successfully installed Themis
Contract and its dependencies.

Themis Contract assumes that you may want to sign contracts on behalf of one
or more counterparties. For example, you may want to sign contracts in your
personal capacity, but you also may want to sign contracts on behalf of your
company.

To allow for this, Themis Contract allows you to create **signatures**, where
each signature can be attached to one or more **profiles**.

Running through an example of setting up your first signature and profile will
help to illustrate the distinction and potential usefulness of these different
concepts.

## Step 1: Create a signature

To set up your first signature, make sure you have an image handy that contains
the signature you want to apply to contracts that you sign. To do this, you
could use an image editing program or your could scan or take a photo of your
handwritten signature.

*Note: in future, we aim to introduce rendered signatures based on a 
user-selected font, or even cryptographic signatures contained in barcodes.
These features are not yet supported.*

Let's say this image is located at `~/Documents/signature.png`.

```bash
# Add a signature with name "Personal" associated with e-mail address
# "your.personal@email.address.com", using your custom handwritten signature.
themis-contract signatures add \
    Personal \
    your.personal@email.address.com \
    ~/Documents/signature.png

# Now list all available signatures to see the newly added one
themis-contract signatures list

# Shorthand version of the above command
themis-contract sigs ls
```

This data is stored in the Themis Contracts home folder, which, by default,
is located at `~/.themis/contract/`. It's stored in plain text files, and your
signature image is copied across, so you could potentially commit Themis 
Contract's data to a Git repository for backup purposes.

For the above signature specifically, look in
`~/.themis/contract/signatures/personal` for its contents.

## Step 2: Create a profile

Profiles allow you to group certain information to facilitate quicker signing
of contracts. At any given point in time when using Themis Contract, a profile
must be active. Profiles additionally allow you to group the following
information:

* Which signature must be used when signing with that profile active?
* Does this profile have a contract templates Git repository associated with it?
  If so, where is this located?
* Formatting customizations to apply when compiling the contract using this
  specific profile.

```bash
# Add a profile called "Personal" (we won't add a contract templates repo yet -
# we'll get to that in another tutorial)
themis-contract profile add \
    Personal \
    --sig-id personal

# List all profiles
themis-contract profile ls

# Activate your "Personal" profile for subsequent Themis Contract commands
themis-contract profile use personal
```

Again, take a look at `~/.themis/contract/profiles/personal` for the metadata
that Themis Contract stores regarding your new profile.

## Next Steps

Once you've created a signature and a profile, you're ready to get started with
[creating your first contract](02-first-contract.md).
