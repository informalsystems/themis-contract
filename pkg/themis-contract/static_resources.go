package themis_contract

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/rs/zerolog/log"
)

func readStaticResource(filename string, fs http.FileSystem) ([]byte, error) {
	f, err := fs.Open(filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return ioutil.ReadAll(f)
}

func copyStaticResources(inputFiles []string, destPath string, overwrite bool, fs http.FileSystem) error {
	if err := os.MkdirAll(destPath, 0755); err != nil {
		return err
	}
	for _, filename := range inputFiles {
		filenameParts := strings.Split(filename, "/")
		fullPath := path.Join(destPath, filenameParts[len(filenameParts)-1])
		log.Debug().Msgf("Copying static resource %s to %s", filename, fullPath)
		// skip files if they exist and we don't want to overwrite them
		_, err := os.Stat(fullPath)
		if !os.IsNotExist(err) && !overwrite {
			log.Debug().Msgf("Static resource already exists at %s and not overwriting", fullPath)
			continue
		}
		content, err := readStaticResource(filename, fs)
		if err != nil {
			return err
		}
		if err := ioutil.WriteFile(fullPath, content, 0644); err != nil {
			return fmt.Errorf("failed to write to \"%s\": %s", fullPath, err)
		}
	}
	return nil
}
