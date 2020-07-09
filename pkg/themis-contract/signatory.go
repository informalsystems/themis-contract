package themis_contract

import "fmt"

// Signatory captures the minimum amount of information about a specific
// signatory who is required to sign a contract.
type Signatory struct {
	Id    string `json:"id" yaml:"id" toml:"id"`
	Name  string `json:"name" yaml:"name" toml:"name"`
	Email string `json:"email" yaml:"email" toml:"email"`

	Signature  string `json:"signature,omitempty" yaml:"signature,omitempty" toml:"signature,omitempty"`       // The path to the image to use for this person's signature.
	SignedDate string `json:"signed_date,omitempty" yaml:"signed_date,omitempty" toml:"signed_date,omitempty"` // The date on which the signature was created.
}

func (s *Signatory) String() string {
	return fmt.Sprintf("Signatory{Id: \"%s\", Name: \"%s\", Email: \"%s\", Signature: \"%s\", SignedDate: \"%s\"}", s.Id, s.Name, s.Email, s.Signature, s.SignedDate)
}
