package main

//func reviewCmd() *cobra.Command {
//	cmd := &cobra.Command{
//		Use:   "review [contract-url]",
//		Args:  cobra.ExactArgs(1),
//		Short: "Fetch a pre-existing contract for local review",
//		Long: `The review command allows you to fetch a contract from an existing Git
//repository for local review. It clones the remote repository locally. If you
//have already cloned a repository using the "review" command, rather use the
//"update" command for future updates.`,
//		Run: func(cmd *cobra.Command, args []string) {
//			c, err := contract.Review(args[0])
//			if err != nil {
//				log.Error().Msgf("Failed to acquire remote contract for review: %s", err)
//				os.Exit(1)
//			}
//			log.Info().Msgf("Successfully acquired remote contract here: %s", c)
//		},
//	}
//	return cmd
//}
