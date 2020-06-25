package main

import (
	"os"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var flagGitRemote string

func newCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "new [upstream] [output]",
		Short: "Create a new contract",
		Long:  "Create a new contract, using the specified upstream contract effectively as a template",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			contractPath := defaultContractPath
			if len(args) > 1 {
				contractPath = args[1]
			}
			if _, err := contract.New(contractPath, args[0], flagGitRemote, globalCtx); err != nil {
				log.Error().Err(err).Msg("Failed to create new contract")
				os.Exit(1)
			}
			log.Info().Msg("Successfully created new contract")
		},
	}
	cmd.PersistentFlags().StringVar(&flagGitRemote, "git-remote", "", "assuming you're creating a new repo for your contract, the URL of the Git remote")
	return cmd
}
