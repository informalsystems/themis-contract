import { TomlError } from "@sgarciac/bombadil";

export class ContractFormatError extends Error { }

export class ContractMissingFieldError extends ContractFormatError {
  constructor(fieldName: string) {
    super(`Missing field in contract: "${fieldName}"`)
  }
}

export class SignatoryMissingFieldError extends ContractFormatError {
  constructor(counterpartyId: string, signatoryId: string, fieldName: string) {
    super(`Signatory "${signatoryId}" for counterparty "${counterpartyId}" is missing field "${fieldName}"`)
  }
}

export class CounterpartyMissingFieldError extends ContractFormatError {
  constructor(counterpartyId: string, fieldName: string) {
    super(`Counterparty "${counterpartyId}" is missing field "${fieldName}"`)
  }
}

export class ContractInvalidTomlError extends ContractFormatError {
  constructor(filename: string, tomlErrors: TomlError[]) {
    super(`Errors when parsing TOML from file ${filename}: ${tomlErrors}`);
  }
}

export class TemplateError extends Error {}

export class DBError extends Error { }

export class KeybaseError extends Error { }
