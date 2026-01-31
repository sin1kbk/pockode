package startup

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/term"
)

const (
	// ANSI color codes
	reset = "\033[0m"
	bold  = "\033[1m"
	dim   = "\033[2m"
	cyan  = "\033[36m"
	green = "\033[32m"
	white = "\033[37m"

	indent = "    "
)

// BannerOptions configures the startup banner display.
type BannerOptions struct {
	Version  string
	LocalURL string
}

// colorsEnabled returns true if ANSI colors should be used.
func colorsEnabled() bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	return term.IsTerminal(int(os.Stdout.Fd()))
}

// color wraps text with ANSI color codes if colors are enabled.
func color(code, text string) string {
	if !colorsEnabled() {
		return text
	}
	return code + text + reset
}

// PrintBanner displays the startup banner with the given options.
func PrintBanner(opts BannerOptions) {
	fmt.Println()

	logo := color(cyan, "◆") + "  " + color(bold+white, "P O C K O D E")
	versionStr := color(dim, opts.Version)
	fmt.Printf("%s%s%s%s\n", indent, logo, strings.Repeat(" ", 30), versionStr)

	fmt.Println()
	fmt.Printf("%s%s  %s\n", indent, color(dim, "▸ Local"), color(green, opts.LocalURL))
	fmt.Println()
}

// PrintFooter prints the footer with shutdown instructions.
func PrintFooter() {
	fmt.Printf("%s%s\n", indent, color(dim, "Press Ctrl+C to stop"))
	fmt.Println()
}
