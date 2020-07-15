package main

import (
	"fmt"
	"os"
)

func main() {
	cmd, err := rootCmd()
	if err != nil {
		fmt.Printf("Failed to initialize CLI: %e\n", err)
		os.Exit(1)
	}
	if err := cmd.Execute(); err != nil {
		fmt.Printf("Failed to execute CLI: %s\n", err)
		os.Exit(1)
	}
}
