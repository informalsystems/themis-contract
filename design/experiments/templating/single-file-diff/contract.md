---
# A YAML-based example. We could use Dhall or TOML here if we wanted.
template:
  source: "file://./template.md"
  sha256: 6c97dfc331c33ea0883f6338c10e1745e1c6d76a9ba654ab1c4753d2738ac1f8
title: Service Agreement
client:
  name: Company A
supplier:
  name: Company B
---
# Service Agreement

This agreement takes place between {{client.name}} and {{supplier.name}}.

## General Terms

1. General
2. Terms
3. Go
4. Here
