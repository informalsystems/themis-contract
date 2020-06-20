package main

import "github.com/spf13/cobra"

func signatureCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "signature",
		Short: "Signature management",
	}
	cmd.AddCommand(
		signatureListCmd(),
		//signatureAddCmd(),
		//signatureRemoveCmd(),
		//signatureRenameCmd(),
		//signatureSetCmd(),
	)
	return cmd
}

func signatureListCmd() *cobra.Command {
	return nil
}
