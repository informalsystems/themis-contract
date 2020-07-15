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
	flagVerbose      bool
	flagHome         string
	flagNoAutoCommit bool
	flagNoAutoPush   bool

	ctx *contract.Context
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

			ctx, err = contract.InitContext(flagHome, !flagNoAutoCommit, !flagNoAutoPush)
			if err != nil {
				log.Error().Msgf("Failed to initialize context: %s", err)
				os.Exit(1)
			}
		},
	}
	cmd.PersistentFlags().BoolVar(&flagNoAutoCommit, "no-auto-commit", false, "do not attempt to automatically commit changes to contracts to their parent Git repository")
	cmd.PersistentFlags().BoolVar(&flagNoAutoPush, "no-auto-push", false, "do not attempt to automatically push changes to contracts to their remote Git repository")
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
		executeCmd(),
		upstreamCmd(),
		//reviewCmd(),
		versionCmd(),
	)
	return cmd, nil
}
