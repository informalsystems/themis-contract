package main

import (
	"os"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func newCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "new [upstream] [output]",
		Short: "Create a new contract",
		Long:  "Create a new contract, using the specified upstream contract effectively as a template",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			contractPath := defaultContractPath
			if len(args) > 1 {
				contractPath = args[1]
			}
			if _, err := contract.New(contractPath, args[0], globalCtx); err != nil {
				log.Error().Err(err).Msg("Failed to create new contract")
				os.Exit(1)
			}
		},
	}
}
