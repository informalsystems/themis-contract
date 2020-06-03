# Anatomy of a Contract

A final contract artifact (generally a PDF file) is produced from contract
source files. Contract source files are made up of:

1. A **contract configuration file**, written in [Dhall][dhall].
2. A **contract text template**. This contains the actual text of the contract
   and placeholders for variables that must be injected into the contract.
   Variable values are specified in the contract configuration file (1).
3. **Signatures**, which can be cryptographic or simple image-based ones
   (*optional*).
4. **Additional assets**, such as images and styling configuration to use when
   producing the final contract artifact (*optional*).

## Contract Templates

Contracts can be derived from other contracts to make them reusable, yet
modifiable. We refer to an upstream contract as a **contract template**, which
is different to the *contract text template* mentioned earlier (the latter being
a component of a contract).
