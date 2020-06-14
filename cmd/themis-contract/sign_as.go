package main

import (
	"os"

	"github.com/informalsystems/themis-contract/pkg/contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func signAsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "sign-as [signatory-id]",
		Short: "Sign a contract as a particular signatory",
		Args:  cobra.ExactArgs(1),
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
			err = c.SignAs(themisContractHome(), args[0])
			if err != nil {
				log.Error().Err(err).Msg("Failed to sign contract")
				os.Exit(1)
			}
		},
	}
}
