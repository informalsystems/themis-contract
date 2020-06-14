package main

import (
	"os"

	"github.com/informalsystems/themis-contract/pkg/contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func listSignatoriesCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list-signatories",
		Short: "List all signatories' details for a given contract",
		Run: func(cmd *cobra.Command, args []string) {
			cache, err := themisContractCache()
			if err != nil {
				log.Error().Err(err).Msg("Failed to initialize cache")
				os.Exit(1)
			}
			c, err := contract.Load(flagContractPath, cache)
			if err != nil {
				log.Error().Err(err).Msg("Failed to load contract")
				os.Exit(1)
			}
			sigs := c.Signatories()
			if len(sigs) == 0 {
				log.Error().Msg("No signatories in contract (there should be at least one)")
				// this should not happen
				os.Exit(1)
			}
			log.Info().Msg("Signatories:")
			for _, sig := range sigs {
				log.Info().Str("id", sig.Id).Str("email", sig.Email).Str("name", sig.Name)
			}
		},
	}
}
