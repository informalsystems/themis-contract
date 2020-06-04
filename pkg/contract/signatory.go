package contract

// Signatory captures the minimum amount of information about a specific
// signatory who is required to sign a contract.
type Signatory struct {
	Id    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}
