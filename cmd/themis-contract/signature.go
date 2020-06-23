package main

import (
	"fmt"
	"os"
	"strings"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

func signatureCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "signature",
		Aliases: []string{"signatures", "sig", "sigs"},
		Short:   "Signature management",
	}
	cmd.AddCommand(
		signatureListCmd(),
		signatureAddCmd(),
		signatureRemoveCmd(),
		signatureRenameCmd(),
		signatureSetCmd(),
	)
	return cmd
}

func signatureListCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List existing signatures",
		Run: func(cmd *cobra.Command, args []string) {
			sigs, err := globalCtx.Signatures()
			if err != nil {
				log.Error().Msgf("Failed to load signatures: %s", err)
				os.Exit(1)
			}
			if len(sigs) == 0 {
				log.Info().Msgf("No signatures configured yet. Use \"themis-contract signature add\" to add one.")
				return
			}
			log.Info().Msgf("%d signatures(s) available:", len(sigs))
			for _, sig := range sigs {
				log.Info().Msgf("- %s", sig.Display())
			}
		},
	}
}

func signatureAddCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "add [name] [email] [image]",
		Short: "Add a new signature",
		Long: `Add a new signature with the given name and e-mail address, and copy the 
specified image to use when signing contracts`,
		Args: cobra.ExactArgs(3),
		Run: func(cmd *cobra.Command, args []string) {
			sig, err := globalCtx.AddSignature(args[0], args[1], args[2])
			if err != nil {
				log.Error().Msgf("Failed to add new signature: %s", err)
				os.Exit(1)
			}
			log.Info().Msgf("Added signature: %s", sig.Display())
		},
	}
}

func signatureRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "remove [id]",
		Aliases: []string{"rm", "del"},
		Short:   "Remove a signature",
		Long:    "Remove the signature with the given ID",
		Args:    cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			if err := globalCtx.RemoveSignature(args[0]); err != nil {
				log.Error().Msgf("Failed to remove signature \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			log.Info().Msgf("Successfully removed signature with ID \"%s\"", args[0])
		},
	}
}

func signatureRenameCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "rename [src-id] [dest-name]",
		Aliases: []string{"mv", "ren"},
		Short:   "Rename a signature",
		Long: `Rename the signature with the given ID to have the specified name (the new ID
will automatically be derived from the name)`,
		Args: cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			if err := globalCtx.RenameSignature(args[0], args[1]); err != nil {
				log.Error().Msgf("Failed to rename signature \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			log.Info().Msgf("Successfully renamed signature with ID \"%s\" to \"%s\"", args[0], args[1])
		},
	}
}

func signatureSetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "set [id] [param] [value]",
		Short: "Set a signature parameter value",
		Long: fmt.Sprintf(`Set a specific signature parameter to the given value

Valid signature parameter names include: %s`, strings.Join(contract.ValidSignatureParamNames(), ", ")),
		Args: cobra.ExactArgs(3),
		Run: func(cmd *cobra.Command, args []string) {
			sig, err := globalCtx.GetSignatureByID(args[0])
			if err != nil {
				log.Error().Msgf("Failed to load signature \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			if err := globalCtx.SetSignatureParam(sig, args[1], args[2]); err != nil {
				log.Error().Msgf("Failed to set parameter \"%s\" for signature \"%s\": %s", args[1], args[0], err)
				os.Exit(1)
			}
			if err := sig.Save(); err != nil {
				log.Error().Msgf("Failed to save signature \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			log.Info().Msgf("Successfully updated signature \"%s\"", sig.Name)
		},
	}
}
