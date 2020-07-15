package main

import (
	"os"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var flagDiffProg string

func upstreamCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "upstream",
		Short: "Comparing a contract to its upstream",
	}
	cmd.AddCommand(
		upstreamDiffCmd(),
	)
	return cmd
}

func upstreamDiffCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "diff [contract]",
		Short: "Show a diff of a contract compared to its upstream",
		Long: `Show a diff of the various components of a contract compared to its upstream.
This will show differences between both the parameters of the upstream and the
template used in the upstream contract.`,
		Run: func(cmd *cobra.Command, args []string) {
			contractPath := defaultContractPath
			if len(args) > 0 {
				contractPath = args[0]
			}
			c, err := contract.Load(contractPath, ctx)
			if err != nil {
				log.Error().Msgf("Failed to load contract: %s", err)
				os.Exit(1)
			}
			diff, err := c.UpstreamDiff(flagDiffProg, ctx)
			if err != nil {
				log.Error().Msgf("Upstream diff failed: %s", err)
				os.Exit(1)
			}
			if len(diff.ParamsDiff) == 0 {
				log.Info().Msgf("Parameters files are identical")
			} else {
				log.Info().Msgf("Comparing our parameters (left) to upstream (right):\n%s\n", diff.ParamsDiff)
			}
			if len(diff.TemplateDiff) == 0 {
				log.Info().Msgf("Template files are identical")
			} else {
				log.Info().Msgf("Comparing our template (left) to upstream (right):\n%s\n", diff.TemplateDiff)
			}
		},
	}
	cmd.PersistentFlags().StringVar(&flagDiffProg, "diff-prog", "diff", "the program to use to perform the diff (try colordiff too)")
	return cmd
}
