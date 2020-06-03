package main

import (
	"os"

	"github.com/informalsystems/themis-contract/pkg/themis/contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var (
	flagOutput string
)

func compileCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "compile",
		Short: "Compile a contract's sources to produce a PDF",
		Run: func(cmd *cobra.Command, args []string) {
			c, err := contract.Load(flagContractPath, themisContractCachePath())
			if err != nil {
				log.Fatal().Err(err).Msg("Failed to load contract")
				os.Exit(1)
			}
			err = c.Compile(flagOutput)
			if err != nil {
				log.Fatal().Err(err).Msg("Failed to compile contract")
				os.Exit(1)
			}
		},
	}
	cmd.PersistentFlags().StringVarP(&flagOutput, "output", "o", "contract.pdf", "where to write the output contract")
	return cmd
}
