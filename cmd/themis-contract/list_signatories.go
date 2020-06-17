package main

import (
	"os"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func listSignatoriesCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list-signatories [contract]",
		Short: "List all signatories' details for a given contract",
		Run: func(cmd *cobra.Command, args []string) {
			contractPath := defaultContractPath
			if len(args) > 0 {
				contractPath = args[0]
			}
			ctx, err := contract.InitContext(themisContractHome())
			if err != nil {
				log.Error().Err(err).Msg("Failed to initialize context")
			}
			c, err := contract.Load(contractPath, ctx)
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
				log.Info().Msgf("- %s (id: %s, e-mail: %s)", sig.Name, sig.Id, sig.Email)
			}
		},
	}
}
