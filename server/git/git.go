// Package git provides git repository operations including initialization, status, and diff.
package git

import (
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Config holds configuration for git initialization.
type Config struct {
	RepoURL   string
	RepoToken string
	UserName  string
	UserEmail string
	WorkDir   string
}

// Init initializes a git repository with the provided configuration.
// It performs the following steps:
// 1. git init (if .git doesn't exist)
// 2. Configure local credential helper
// 3. Write .git/.git-credentials
// 4. git remote add origin
// 5. git fetch + checkout default branch
// 6. Configure user info (local)
func Init(cfg Config) error {
	gitDir := filepath.Join(cfg.WorkDir, ".git")

	// Ensure work directory exists
	if err := os.MkdirAll(cfg.WorkDir, 0755); err != nil {
		return fmt.Errorf("failed to create work directory: %w", err)
	}

	// Check if already initialized
	if _, err := os.Stat(gitDir); err == nil {
		slog.Info("repository already exists, skipping initialization", "workDir", cfg.WorkDir)
		return nil
	}

	// Extract host from URL for credential
	host, err := extractHost(cfg.RepoURL)
	if err != nil {
		return fmt.Errorf("failed to extract host from URL: %w", err)
	}

	slog.Info("initializing git repository", "workDir", cfg.WorkDir)

	// 1. git init
	if err := initRepo(cfg.WorkDir); err != nil {
		return err
	}

	// 2 & 3. Setup local credential
	if err := setupLocalCredential(cfg.WorkDir, host, cfg.RepoToken); err != nil {
		return err
	}

	// 4. git remote add origin
	if err := addRemote(cfg.WorkDir, cfg.RepoURL); err != nil {
		return err
	}

	// 5. git fetch + checkout default branch
	if err := fetchAndCheckout(cfg.WorkDir); err != nil {
		return err
	}

	// 6. Configure user info
	if err := configUser(cfg.WorkDir, cfg.UserName, cfg.UserEmail); err != nil {
		return err
	}

	slog.Info("git repository initialized successfully")
	return nil
}

// initRepo executes git init in the specified directory.
func initRepo(dir string) error {
	cmd := exec.Command("git", "init")
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git init failed: %w", err)
	}
	return nil
}

// setupLocalCredential configures a local credential helper and writes the credentials file.
func setupLocalCredential(dir, host, token string) error {
	gitDir := filepath.Join(dir, ".git")
	credFile := filepath.Join(gitDir, ".git-credentials")

	// Configure local credential helper to use .git/.git-credentials
	cmd := exec.Command("git", "config", "--local", "credential.helper", fmt.Sprintf("store --file=%s", credFile))
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to configure credential helper: %w", err)
	}

	// Write credentials file
	// Format: https://username:password@host
	// For GitHub PAT, use x-access-token as username
	credContent := fmt.Sprintf("https://x-access-token:%s@%s\n", token, host)
	if err := os.WriteFile(credFile, []byte(credContent), 0600); err != nil {
		return fmt.Errorf("failed to write credentials file: %w", err)
	}

	slog.Info("local credential configured", "host", host)
	return nil
}

// addRemote adds the origin remote to the repository.
func addRemote(dir, repoURL string) error {
	cmd := exec.Command("git", "remote", "add", "origin", repoURL)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git remote add failed: %w", err)
	}
	return nil
}

// fetchAndCheckout fetches from origin and checks out the default branch.
func fetchAndCheckout(dir string) error {
	// First, fetch all refs from origin
	fetchCmd := exec.Command("git", "fetch", "origin")
	fetchCmd.Dir = dir
	fetchCmd.Stdout = os.Stdout
	fetchCmd.Stderr = os.Stderr

	if err := fetchCmd.Run(); err != nil {
		return fmt.Errorf("git fetch failed: %w", err)
	}

	// Get the default branch from origin/HEAD
	// If origin/HEAD is not set, try common defaults
	defaultBranch := getDefaultBranch(dir)

	// Checkout the default branch
	checkoutCmd := exec.Command("git", "checkout", "-t", fmt.Sprintf("origin/%s", defaultBranch))
	checkoutCmd.Dir = dir
	checkoutCmd.Stdout = os.Stdout
	checkoutCmd.Stderr = os.Stderr

	if err := checkoutCmd.Run(); err != nil {
		return fmt.Errorf("git checkout failed: %w", err)
	}
	return nil
}

// getDefaultBranch determines the default branch name.
func getDefaultBranch(dir string) string {
	// Try to get the default branch from remote HEAD
	cmd := exec.Command("git", "symbolic-ref", "refs/remotes/origin/HEAD")
	cmd.Dir = dir
	output, err := cmd.Output()
	if err == nil {
		// Output is like "refs/remotes/origin/main"
		ref := strings.TrimSpace(string(output))
		parts := strings.Split(ref, "/")
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}

	// Fallback: check if main or master exists
	for _, branch := range []string{"main", "master"} {
		cmd := exec.Command("git", "rev-parse", "--verify", fmt.Sprintf("origin/%s", branch))
		cmd.Dir = dir
		if err := cmd.Run(); err == nil {
			return branch
		}
	}

	// Last resort: use main
	return "main"
}

// configUser sets the local git user name and email.
func configUser(dir, name, email string) error {
	// Set user.name
	cmd := exec.Command("git", "config", "--local", "user.name", name)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set user.name: %w", err)
	}

	// Set user.email
	cmd = exec.Command("git", "config", "--local", "user.email", email)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set user.email: %w", err)
	}

	return nil
}

// FileStatus represents a file's git status.
type FileStatus struct {
	Path   string `json:"path"`
	Status string `json:"status"` // M=modified, A=added, D=deleted, R=renamed, ?=untracked
}

// GitStatus represents the overall git status.
type GitStatus struct {
	Staged   []FileStatus `json:"staged"`
	Unstaged []FileStatus `json:"unstaged"`
}

// Status returns the current git status (staged and unstaged files).
func Status(dir string) (*GitStatus, error) {
	cmd := exec.Command("git", "status", "--porcelain=v1")
	cmd.Dir = dir
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git status failed: %w", err)
	}

	result := &GitStatus{
		Staged:   []FileStatus{},
		Unstaged: []FileStatus{},
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if len(line) < 3 {
			continue
		}

		// Porcelain v1 format: XY PATH
		// X = staged status, Y = unstaged status
		x := line[0] // staged
		y := line[1] // unstaged
		path := strings.TrimSpace(line[3:])

		// Handle renamed files (format: "R  old -> new")
		if strings.Contains(path, " -> ") {
			parts := strings.Split(path, " -> ")
			path = parts[len(parts)-1]
		}

		// Staged changes (index vs HEAD)
		if x != ' ' && x != '?' {
			result.Staged = append(result.Staged, FileStatus{
				Path:   path,
				Status: string(x),
			})
		}

		// Unstaged changes (worktree vs index) or untracked
		if y != ' ' {
			result.Unstaged = append(result.Unstaged, FileStatus{
				Path:   path,
				Status: string(y),
			})
		}
	}

	return result, nil
}

// Diff returns the unified diff for a specific file.
// If staged is true, returns diff of staged changes (index vs HEAD).
// If staged is false, returns diff of unstaged changes (worktree vs index).
func Diff(dir, path string, staged bool) (string, error) {
	var args []string
	if staged {
		args = []string{"diff", "--cached", "--", path}
	} else {
		args = []string{"diff", "--", path}
	}

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Check if file exists - if not, it's a real error
		fullPath := filepath.Join(dir, path)
		if _, statErr := os.Stat(fullPath); os.IsNotExist(statErr) {
			return "", fmt.Errorf("file not found: %s", path)
		}
		// For unstaged, try showing as untracked file
		if !staged {
			untrackedDiff, untrackedErr := showUntrackedFile(dir, path)
			if untrackedErr == nil {
				return untrackedDiff, nil
			}
		}
		return "", fmt.Errorf("git diff failed: %w (output: %s)", err, string(output))
	}

	// Empty output means no diff (file might be untracked)
	if len(output) == 0 && !staged {
		return showUntrackedFile(dir, path)
	}

	return string(output), nil
}

// showUntrackedFile generates a diff-like output for untracked files.
func showUntrackedFile(dir, path string) (string, error) {
	fullPath := filepath.Join(dir, path)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Handle empty file (Git doesn't output ---/+++ for empty files)
	if len(content) == 0 {
		var result strings.Builder
		result.WriteString(fmt.Sprintf("diff --git a/%s b/%s\n", path, path))
		result.WriteString("new file mode 100644\n")
		return result.String(), nil
	}

	// Split content into lines, preserving trailing newline information
	text := string(content)
	hasTrailingNewline := strings.HasSuffix(text, "\n")
	if hasTrailingNewline {
		text = text[:len(text)-1]
	}

	lines := strings.Split(text, "\n")
	var result strings.Builder

	result.WriteString(fmt.Sprintf("diff --git a/%s b/%s\n", path, path))
	result.WriteString("new file mode 100644\n")
	result.WriteString("--- /dev/null\n")
	result.WriteString(fmt.Sprintf("+++ b/%s\n", path))
	result.WriteString(fmt.Sprintf("@@ -0,0 +1,%d @@\n", len(lines)))

	for _, line := range lines {
		result.WriteString("+" + line + "\n")
	}

	if !hasTrailingNewline {
		result.WriteString("\\ No newline at end of file\n")
	}

	return result.String(), nil
}

// extractHost extracts the host from a git URL.
// Supports both HTTPS and SSH URL formats.
func extractHost(repoURL string) (string, error) {
	// Handle SSH format: git@github.com:user/repo.git
	if strings.HasPrefix(repoURL, "git@") {
		parts := strings.SplitN(repoURL, ":", 2)
		if len(parts) < 2 {
			return "", fmt.Errorf("invalid SSH URL format: %s", repoURL)
		}
		host := strings.TrimPrefix(parts[0], "git@")
		return host, nil
	}

	// Handle HTTPS format: https://github.com/user/repo.git
	parsed, err := url.Parse(repoURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse URL: %w", err)
	}

	if parsed.Host == "" {
		return "", fmt.Errorf("URL has no host: %s", repoURL)
	}

	return parsed.Host, nil
}
