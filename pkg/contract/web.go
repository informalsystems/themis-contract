package contract

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"

	"github.com/rs/zerolog/log"
)

// Downloads the file at the given URL, saving it in the specified destination
// file.
func downloadFile(u *url.URL, destFile string) error {
	log.Info().Msgf("Fetching URL: %s", u)
	res, err := http.Get(u.String())
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("request to \"%s\" failed with code %d", u, res.StatusCode)
	}
	content, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return err
	}

	log.Info().Msgf("Writing response body to %s", destFile)
	f, err := os.Create(destFile)
	if err != nil {
		return fmt.Errorf("failed to create destination file %s: %v", destFile, err)
	}
	defer f.Close()
	if _, err := f.Write(content); err != nil {
		return err
	}
	return nil
}
