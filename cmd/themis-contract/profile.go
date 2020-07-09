package main

import (
	"fmt"
	"os"
	"strings"

	contract "github.com/informalsystems/themis-contract/pkg/themis-contract"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var (
	flagProfileSigID         string
	flagProfileContractsRepo string
	flagProfileID            string
)

func profileCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "profile",
		Aliases: []string{"profiles"},
		Short:   "ActiveProfile management",
	}
	cmd.AddCommand(
		profileListCmd(),
		profileUseCmd(),
		profileAddCmd(),
		profileRemoveCmd(),
		profileRenameCmd(),
		profileSetCmd(),
		profileContractsCmd(),
	)
	return cmd
}

func profileListCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List existing profiles",
		Run: func(cmd *cobra.Command, args []string) {
			profiles := ctx.Profiles()
			if len(profiles) == 0 {
				log.Info().Msgf("No profiles configured yet. Use \"themis-contract profile add\" to add one.")
				return
			}
			activeProfile := ctx.ActiveProfile()
			if activeProfile == nil {
				log.Info().Msg("No active profile currently. Use \"themis-contract use\" to set one.")
			} else {
				log.Info().Msgf("Currently active profile: %s", activeProfile.ID())
			}
			log.Info().Msgf("%d profile(s) available:", len(profiles))
			for _, profile := range profiles {
				act := "  "
				if activeProfile != nil && activeProfile.ID() == profile.ID() {
					act = "> "
				}
				log.Info().Msgf("%s%s", act, profile.Display())
			}
		},
	}
}

func profileUseCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "use [id]",
		Short: "Switch to using a specific profile",
		Long:  "Switch to using the profile with the specified ID",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			profile, err := ctx.UseProfile(args[0])
			if err != nil {
				log.Error().Msgf("Failed to switch to profile \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			log.Info().Msgf("Switched to profile: %s", profile.Display())
		},
	}
}

func profileAddCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add [name]",
		Short: "Add a new profile",
		Long:  "Add a new profile with the given name",
		Run: func(cmd *cobra.Command, args []string) {
			profile, err := ctx.AddProfile(args[0], flagProfileSigID, flagProfileContractsRepo)
			if err != nil {
				log.Error().Msgf("Failed to add new profile: %s", err)
				os.Exit(1)
			}
			log.Info().Msgf("Added profile: %s", profile.Display())
			// if we only have one new profile now, try to make it the default
			if len(ctx.Profiles()) == 1 {
				log.Info().Msgf("Automatically choosing profile \"%s\" as currently active, since it's the only profile", profile.ID())
				if _, err := ctx.UseProfile(profile.ID()); err != nil {
					log.Error().Msgf("Failed to select profile \"%s\" as active: %s", profile.ID(), err)
				}
			}
		},
	}
	cmd.PersistentFlags().StringVar(&flagProfileSigID, "sig-id", "", "optionally specify a signature ID to use")
	cmd.PersistentFlags().StringVar(&flagProfileContractsRepo, "contracts-repo", "", "optionally specify a repository for all contracts for this profile")
	return cmd
}

func profileRemoveCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "remove [id]",
		Aliases: []string{"rm", "del"},
		Short:   "Remove a profile",
		Long:    "Remove the profile with the given ID",
		Args:    cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			if err := ctx.RemoveProfile(args[0]); err != nil {
				log.Error().Msgf("Failed to remove profile \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			log.Info().Msgf("Successfully removed profile with ID \"%s\"", args[0])
		},
	}
}

func profileRenameCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "rename [src-id] [dest-name]",
		Aliases: []string{"mv", "ren"},
		Short:   "Rename a profile",
		Long: `Rename the profile with the given ID to have the specified name (the new ID
will automatically be derived from the name)`,
		Args: cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			if err := ctx.RenameProfile(args[0], args[1]); err != nil {
				log.Error().Msgf("Failed to rename profile \"%s\": %s", args[0], err)
				os.Exit(1)
			}
			log.Info().Msgf("Successfully renamed profile with ID \"%s\" to \"%s\"", args[0], args[1])
		},
	}
}

func profileSetCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "set [param] [value]",
		Short: "Set a profile parameter value",
		Long: fmt.Sprintf(`
Set a specific profile parameter to the given value. If no profile ID is 
supplied, the currently active profile's parameter will be set.

Valid profile parameter names include: %s`, strings.Join(contract.ValidProfileParamNames(), ", ")),
		Args: cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			profile := ctx.ActiveProfile()
			if len(flagProfileID) > 0 {
				var err error
				profile, err = ctx.GetProfileByID(flagProfileID)
				if err != nil {
					log.Error().Msgf("Failed to load profile \"%s\": %s", flagProfileID, err)
					os.Exit(1)
				}
			}
			if err := ctx.SetProfileParam(profile, args[0], args[1]); err != nil {
				log.Error().Msgf("Failed to set parameter \"%s\" for profile \"%s\": %s", args[0], profile.ID(), err)
				os.Exit(1)
			}
			if err := profile.Save(); err != nil {
				log.Error().Msgf("Failed to save profile \"%s\": %s", profile.ID(), err)
				os.Exit(1)
			}
			log.Info().Msgf("Successfully updated profile \"%s\" (ID: \"%s\")", profile.Name, profile.ID())
		},
	}
	cmd.PersistentFlags().StringVar(&flagProfileID, "id", "", "the profile ID whose parameter is to be set")
	return cmd
}

func profileContractsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "contracts",
		Short: "Manage profile-specific contracts",
	}
	cmd.AddCommand(
		profileContractsListCmd(),
		profileContractsSyncCmd(),
	)
	return cmd
}

func profileContractsListCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "list [profile-id]",
		Aliases: []string{"ls"},
		Short:   "List cached contracts for a profile",
		Long: `List cached contracts for a profile (if no profile ID is supplied, the cached
contracts for the currently active profile will be listed)`,
		Run: func(cmd *cobra.Command, args []string) {
			var err error
			profile := ctx.ActiveProfile()
			if len(args) > 0 {
				profile, err = ctx.GetProfileByID(args[0])
				if err != nil {
					log.Error().Msgf("Failed to get profile with ID \"%s\": %s", args[0], err)
					os.Exit(1)
				}
			}
			listProfileContracts(profile)
		},
	}
}

func profileContractsSyncCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "sync [profile-id]",
		Short: "Sync cached contracts for a profile",
		Long: `Sync cached contracts for a profile (if no profile ID is supplied, the cached
contracts for the currently active profile will be used)`,
		Run: func(cmd *cobra.Command, args []string) {
			var err error
			profile := ctx.ActiveProfile()
			if len(args) > 0 {
				profile, err = ctx.GetProfileByID(args[0])
				if err != nil {
					log.Error().Msgf("Failed to get profile with ID \"%s\": %s", args[0], err)
					os.Exit(1)
				}
			}
			if len(profile.ContractsRepo) == 0 {
				log.Error().Msgf("No contracts repository configured for profile \"%s\" - please set one first", profile.ID())
				os.Exit(1)
			}
			log.Info().Msgf("Synchronizing contracts repo \"%s\" for profile \"%s\"...", profile.ContractsRepo, profile.ID())
			if err := profile.SyncContractsRepo(ctx); err != nil {
				log.Error().Msgf("Failed to sync contracts repo for profile \"%s\": %s", profile.ID(), err)
				os.Exit(1)
			}
			listProfileContracts(profile)
		},
	}
}

func listProfileContracts(profile *contract.Profile) {
	if len(profile.Contracts) == 0 {
		log.Info().Msgf("No contracts for profile \"%s\"", profile.ID())
		os.Exit(0)
	}
	log.Info().Msgf("Contracts for profile \"%s\":", profile.ID())
	for _, c := range profile.Contracts {
		log.Info().Msgf("- %s: %s", c.ID, c.URL())
	}
}
