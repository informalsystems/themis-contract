package themis_contract

func WordWrapString(s string, lineWidth int) string {
	return wordWrapString(s, lineWidth)
}

func NewTestContext(cache Cache, activeProfile *Profile) *Context {
	return &Context{
		cache: cache,
		profileDB: &ProfileDB{
			activeProfile: activeProfile,
		},
	}
}

func NewTestProfile(name, contractsRepo string, contracts []*ProfileContract) *Profile {
	return &Profile{
		Name:          name,
		ContractsRepo: contractsRepo,
		Contracts:     contracts,
	}
}

func NewTestProfileContract(id, url, localPath string) *ProfileContract {
	return &ProfileContract{
		ID:        id,
		url:       url,
		localPath: localPath,
	}
}
