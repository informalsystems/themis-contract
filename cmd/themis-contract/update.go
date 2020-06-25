package main

import (
	"os"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func updateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "update [contract]",
		Short: "Update a contract's parameters/template files' hashes",
		Long:  "Automatically refreshes the hashes of the parameters and/or template files",
		Run: func(cmd *cobra.Command, args []string) {
			contractPath := defaultContractPath
			if len(args) > 0 {
				contractPath = args[0]
			}
			if err := contract.Update(contractPath, globalCtx); err != nil {
				log.Error().Err(err).Msg("Failed to load contract")
				os.Exit(1)
			}
			log.Info().Msg("Successfully updated contract")
		},
	}
}
