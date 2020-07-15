package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

var version string

func versionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show the current version of Themis Contract",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("Themis Contract %s\n", version)
		},
	}
}
