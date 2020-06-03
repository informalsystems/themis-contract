package main

import (
	"os"
	"os/user"
	"path"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var (
	flagVerbose      bool
	flagContractPath string
	flagThemisHome   string
)

func defaultThemisHome() (string, error) {
	usr, err := user.Current()
	if err != nil {
		return "", err
	}
	return path.Join(usr.HomeDir, ".themis"), nil
}

func themisContractHome() string {
	return path.Join(flagThemisHome, "contract")
}

func themisContractCachePath() string {
	return path.Join(themisContractHome(), "cache")
}

func rootCmd() (*cobra.Command, error) {
	themisHome, err := defaultThemisHome()
	if err != nil {
		return nil, err
	}
	cmd := &cobra.Command{
		Use:   "themis-contract",
		Short: "Themis Contract is a tool to help with parameterized legal contracting",
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})
			level := zerolog.InfoLevel
			if flagVerbose {
				level = zerolog.DebugLevel
			}
			zerolog.SetGlobalLevel(level)
			log.Debug().Msg("Increasing output verbosity to debug level")
		},
	}
	cmd.PersistentFlags().BoolVarP(&flagVerbose, "verbose", "v", false, "increase output logging verbosity")
	cmd.PersistentFlags().StringVar(&flagContractPath, "contract", ".", "path to the contract you want to interact with")
	cmd.PersistentFlags().StringVar(&flagThemisHome, "themis-home", themisHome, "path to the root of your Themis configuration directory")
	cmd.AddCommand(
		newCmd(),
		compileCmd(),
		listSignatoriesCmd(),
		signAsCmd(),
	)
	return cmd, nil
}
