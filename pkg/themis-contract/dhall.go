package themis_contract

import (
	"net/http"
	"path"
)

// Ensures that we have a copy of the Themis Contract Dhall package files
// accessible from within the home directory. Usually located under
// `~/.themis/contract/dhall`.
func initDhallPackages(home string, fs http.FileSystem) error {
	dhallPackageFiles := []string{
		"/dhall/package.dhall",
		"/dhall/Contract.dhall",
		"/dhall/FileRef.dhall",
		"/dhall/Signatory.dhall",
		"/dhall/Template.dhall",
		"/dhall/TemplateFormat.dhall",
	}
	return copyStaticResources(dhallPackageFiles, dhallPackagePath(home), true, fs)
}

func dhallPackagePath(home string) string {
	return path.Join(home, "dhall")
}
