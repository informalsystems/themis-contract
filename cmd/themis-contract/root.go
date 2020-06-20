package main

import (
	"os"
	"os/user"
	"path"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

const defaultContractPath = "contract.dhall"

var (
	flagVerbose bool
	flagHome    string

	globalCtx *contract.Context
)

func defaultThemisContractHome() (string, error) {
	usr, err := user.Current()
	if err != nil {
		return "", err
	}
	return path.Join(usr.HomeDir, ".themis", "contract"), nil
}

func rootCmd() (*cobra.Command, error) {
	home, err := defaultThemisContractHome()
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

			globalCtx, err = contract.InitContext(flagHome)
			if err != nil {
				log.Error().Msgf("Failed to initialize context: %s", err)
				os.Exit(1)
			}
		},
	}
	cmd.PersistentFlags().BoolVarP(&flagVerbose, "verbose", "v", false, "increase output logging verbosity")
	cmd.PersistentFlags().StringVar(&flagHome, "home", home, "path to the root of your Themis Contract configuration directory")
	cmd.AddCommand(
		newCmd(),
		compileCmd(),
		listSignatoriesCmd(),
		signCmd(),
		updateCmd(),
		profileCmd(),
		signatureCmd(),
	)
	return cmd, nil
}
