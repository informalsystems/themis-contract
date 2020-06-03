package main

import (
	"os"

	"github.com/informalsystems/themis-contract/pkg/themis/contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var (
	flagUpstream string
)

func newCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "new",
		Short: "Create a new contract",
		Run: func(cmd *cobra.Command, args []string) {
			_, err := contract.New(flagContractPath, flagUpstream, themisContractCachePath())
			if err != nil {
				log.Fatal().Err(err).Msg("Failed to create new contract")
				os.Exit(1)
			}
		},
	}
	cmd.PersistentFlags().StringVarP(&flagUpstream, "upstream", "u", "", "the upstream contract to use as a template")
	return cmd
}
