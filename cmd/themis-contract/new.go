package main

import (
	"os"

	"github.com/informalsystems/themis-contract/pkg/contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func newCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "new [upstream]",
		Short: "Create a new contract",
		Long:  "Create a new contract, using the specified upstream contract effectively as a template",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			cache, err := themisContractCache()
			if err != nil {
				log.Error().Err(err).Msg("Failed to initialize cache")
				os.Exit(1)
			}
			_, err = contract.New(flagContractPath, args[0], cache)
			if err != nil {
				log.Error().Err(err).Msg("Failed to create new contract")
				os.Exit(1)
			}
		},
	}
	return cmd
}
