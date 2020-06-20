package main

import (
	"os"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var flagSigId string

func signCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sign [contract]",
		Short: "Sign a contract",
		Long:  "Sign a contract, optionally specifying the signatory as whom you want to sign",
		Run: func(cmd *cobra.Command, args []string) {
			contractPath := defaultContractPath
			if len(args) > 0 {
				contractPath = args[0]
			}
			c, err := contract.Load(contractPath, globalCtx)
			if err != nil {
				log.Error().Err(err).Msg("Failed to load contract")
				os.Exit(1)
			}
			err = c.Sign(flagSigId, globalCtx)
			if err != nil {
				log.Error().Err(err).Msg("Failed to sign contract")
				os.Exit(1)
			}
		},
	}
	cmd.PersistentFlags().StringVar(&flagSigId, "as", "", "the ID of the signatory on behalf of whom you want to sign")
	return cmd
}
