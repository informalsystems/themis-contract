# Contracting Workflows

Themis Contract aims to speed up the process of contracting while simultaneously
allowing for better-tracked contract negotiation (better than having to track
endless e-mail trails).

By leveraging the power of GitHub/GitLab and Git, we automatically get the
following for free:

* Discussions on desired changes (to parameters and/or contract text)
* Permissioned merging of changes (when using pull/merge requests)
* Version control history (with optional cryptographic integrity checks if
  Git commits have to be signed when submitted)
  
Let's take a look at some simple workflow examples that could help to make your
contracting experience easier.

## Example 1: Negotiating contract text with lawyers

If your lawyers are open to negotiating contracts in Markdown via GitHub/GitLab
pull/merge requests, then this is the workflow for you. Usually in this case
you'd be deliberating on the *text of the contract itself*, and not so much the
parameters.

1. Create a Git repository
2. Push your initial contract, template and parameters files.
3. Open up a pull/merge request with the desired changes to the template text.
4. Deliberate changes through the GitHub/GitLab UI.
5. Once all parties agree that the contract text is acceptable, someone needs
   to update the `contract.dhall` file (`themis-contract update`), commit it
   to the pull/merge request, and merge it all.

Now you have all deliberations and conversations tracked in one place, and a
full commit history of who modified which part of the contract when (and
hopefully why they made those modifications in the commit messages).

## Example 2: Negotiating with counterparties

Generally when you're negotiating with counterparties, you'd hopefully have a
contract template that was already approved by your lawyers (as per example 1
above). Most of the time here you'd only really be negotiating on parameters
(your `params.dhall` file), but sometimes counterparties want minor
modifications to the template text itself.

In this case, you'd need to:

1. Have your upstream contract (pre-negotiated with your lawyers) at the ready.
   This should hopefully be stored in a Git repository.
2. Set up your new contract either inside a new Git repository or inside an
   existing one (but ideally not alongside your upstream):
   
```bash
mkdir new-contract

# Uses the upstream contract in your `contract-templates` repository, while
# setting the new contract's remote origin to your `new-contract` repository 
themis-contract new \
    git://git@github.com/you/contract-templates.git/service-agreement/contract.dhall \
    --git-remote git://git@github.com/you/new-contract.git

# Optionally leave out the --git-remote if you're creating a contract in an
# existing Git repository or if you'd prefer to configure the remote yourself
themis-contract new \
    git://git@github.com/you/contract-templates.git/service-agreement/contract.dhall
```

3. Open up a pull/merge request to negotiate changes to the `params.dhall` and
   `template.md` files.
4. Once everyone's happy with the contract, sign it (`themis-contract sign`)
   and push the signatures to the pull/merge request.
5. Merge all signatures in and you've got a signed contract.

If you've changed something in the `template.md` file and would like to see
how different the new contract's text is from the upstream's, Themis Contract
provides a shortcut for you:

```bash
# Show a diff between our `template.md` and the upstream's `template.md` files
themis-contract upstream diff
```

## Next Steps

More tutorials will be coming soon!
