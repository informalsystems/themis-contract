package contract

import "fmt"

// Signatory captures the minimum amount of information about a specific
// signatory who is required to sign a contract.
type Signatory struct {
	Id    string `json:"id" yaml:"id" toml:"id"`
	Name  string `json:"name" yaml:"name" toml:"name"`
	Email string `json:"email" yaml:"email" toml:"email"`
}

func (s *Signatory) String() string {
	return fmt.Sprintf("Signatory{Id: \"%s\", Name: \"%s\", Email: \"%s\"}", s.Id, s.Name, s.Email)
}
