package worktree

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewRegistry_NonGitRepo(t *testing.T) {
	dir := resolveSymlinks(t, t.TempDir())

	r := NewRegistry(dir)

	if r.IsGitRepo() {
		t.Error("expected IsGitRepo() = false for non-git directory")
	}
	if r.MainDir() != dir {
		t.Errorf("MainDir() = %q, want %q", r.MainDir(), dir)
	}
}

func TestNewRegistry_GitRepo(t *testing.T) {
	dir := initGitRepo(t)

	r := NewRegistry(dir)

	if !r.IsGitRepo() {
		t.Error("expected IsGitRepo() = true for git repository")
	}
}

func TestResolve_MainWorktree(t *testing.T) {
	dir := resolveSymlinks(t, t.TempDir())
	r := NewRegistry(dir)

	path, err := r.Resolve("")
	if err != nil {
		t.Fatalf("Resolve(\"\") failed: %v", err)
	}
	if path != dir {
		t.Errorf("Resolve(\"\") = %q, want %q", path, dir)
	}
}

func TestResolve_NonGitRepo(t *testing.T) {
	dir := t.TempDir()
	r := NewRegistry(dir)

	_, err := r.Resolve("some-worktree")
	if err != ErrNotGitRepo {
		t.Errorf("Resolve() error = %v, want ErrNotGitRepo", err)
	}
}

func TestResolve_NotFound(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	_, err := r.Resolve("nonexistent")
	if err != ErrWorktreeNotFound {
		t.Errorf("Resolve() error = %v, want ErrWorktreeNotFound", err)
	}
}

func TestList_NonGitRepo(t *testing.T) {
	dir := t.TempDir()
	r := NewRegistry(dir)

	list := r.List()

	if len(list) != 1 {
		t.Fatalf("List() returned %d items, want 1", len(list))
	}
	if list[0].Name != "" {
		t.Errorf("List()[0].Name = %q, want empty string", list[0].Name)
	}
	if !list[0].IsMain {
		t.Error("List()[0].IsMain = false, want true")
	}
}

func TestList_GitRepo(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	list := r.List()

	if len(list) < 1 {
		t.Fatal("List() returned empty list")
	}

	var found bool
	for _, info := range list {
		if info.IsMain && info.Name == "" {
			found = true
			break
		}
	}
	if !found {
		t.Error("List() does not contain main worktree")
	}
}

func TestCreate_Success(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	info, err := r.Create("feature", "feature-branch")
	if err != nil {
		t.Fatalf("Create() failed: %v", err)
	}

	if info.Name != "feature" {
		t.Errorf("info.Name = %q, want %q", info.Name, "feature")
	}
	if info.Branch != "feature-branch" {
		t.Errorf("info.Branch = %q, want %q", info.Branch, "feature-branch")
	}

	expectedPath := filepath.Join(r.worktreesDir(), "feature")
	if info.Path != expectedPath {
		t.Errorf("info.Path = %q, want %q", info.Path, expectedPath)
	}

	// Verify worktree exists on disk
	if _, err := os.Stat(info.Path); os.IsNotExist(err) {
		t.Error("worktree directory was not created")
	}

	// Verify Resolve works
	path, err := r.Resolve("feature")
	if err != nil {
		t.Fatalf("Resolve() failed after Create: %v", err)
	}
	if path != expectedPath {
		t.Errorf("Resolve() = %q, want %q", path, expectedPath)
	}
}

func TestCreate_ExistingBranch(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	cmd := exec.Command("git", "-C", dir, "branch", "existing-branch")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git branch failed: %s", out)
	}

	info, err := r.Create("feature", "existing-branch")
	if err != nil {
		t.Fatalf("Create() with existing branch failed: %v", err)
	}
	if info.Branch != "existing-branch" {
		t.Errorf("info.Branch = %q, want %q", info.Branch, "existing-branch")
	}
}

func TestCreate_RemoteBranch(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	cmd := exec.Command("git", "-C", dir, "remote", "add", "origin", "https://example.com/repo.git")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git remote add failed: %s", out)
	}
	cmd = exec.Command("git", "-C", dir, "update-ref", "refs/remotes/origin/feature-x", "HEAD")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git update-ref failed: %s", out)
	}

	info, err := r.Create("feature", "feature-x")
	if err != nil {
		t.Fatalf("Create() with remote branch failed: %v", err)
	}
	if info.Branch != "feature-x" {
		t.Errorf("info.Branch = %q, want %q", info.Branch, "feature-x")
	}
}

func TestCreate_EmptyName(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	_, err := r.Create("", "branch")
	if err == nil {
		t.Error("Create() with empty name should fail")
	}
}

func TestCreate_EmptyBranch(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	_, err := r.Create("feature", "")
	if err == nil {
		t.Error("Create() with empty branch should fail")
	}
}

func TestCreate_Duplicate(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	_, err := r.Create("feature", "branch1")
	if err != nil {
		t.Fatalf("first Create() failed: %v", err)
	}

	_, err = r.Create("feature", "branch2")
	if err != ErrWorktreeAlreadyExist {
		t.Errorf("duplicate Create() error = %v, want ErrWorktreeAlreadyExist", err)
	}
}

func TestCreate_PathTraversal(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	_, err := r.Create("../escape", "branch")
	if err == nil {
		t.Fatal("Create() with path traversal should fail")
	}
	if !strings.Contains(err.Error(), "path traversal") {
		t.Errorf("expected path traversal error, got %v", err)
	}
}

func TestCreate_NonGitRepo(t *testing.T) {
	dir := t.TempDir()
	r := NewRegistry(dir)

	_, err := r.Create("feature", "branch")
	if err != ErrNotGitRepo {
		t.Errorf("Create() error = %v, want ErrNotGitRepo", err)
	}
}

func TestDelete_Success(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	info, err := r.Create("to-delete", "delete-branch")
	if err != nil {
		t.Fatalf("Create() failed: %v", err)
	}

	err = r.Delete("to-delete", false)
	if err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}

	// Verify worktree is removed from disk
	if _, err := os.Stat(info.Path); !os.IsNotExist(err) {
		t.Error("worktree directory still exists after Delete")
	}

	// Verify Resolve returns not found
	_, err = r.Resolve("to-delete")
	if err != ErrWorktreeNotFound {
		t.Errorf("Resolve() after Delete error = %v, want ErrWorktreeNotFound", err)
	}
}

func TestDelete_MainWorktree(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	err := r.Delete("", false)
	if err != ErrMainWorktree {
		t.Errorf("Delete(\"\") error = %v, want ErrMainWorktree", err)
	}
}

func TestDelete_NotFound(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	err := r.Delete("nonexistent", false)
	if err != ErrWorktreeNotFound {
		t.Errorf("Delete() error = %v, want ErrWorktreeNotFound", err)
	}
}

func TestDelete_ExternalWorktreeNotVisible(t *testing.T) {
	dir := initGitRepo(t)
	r := NewRegistry(dir)

	// Create worktree outside of worktreesDir
	externalPath := filepath.Join(filepath.Dir(dir), "external-worktree")
	cmd := exec.Command("git", "-C", dir, "worktree", "add", "-b", "ext-branch", externalPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git worktree add failed: %s", out)
	}
	defer func() {
		exec.Command("git", "-C", dir, "worktree", "remove", "--force", externalPath).Run()
	}()

	r.invalidateCache()

	// External worktrees are not visible in List
	list := r.List()
	for _, info := range list {
		if info.Name == "external-worktree" {
			t.Error("external worktree should not be visible")
		}
	}

	// Delete returns not found since external worktrees are ignored
	err := r.Delete("external-worktree", false)
	if err != ErrWorktreeNotFound {
		t.Errorf("Delete() error = %v, want ErrWorktreeNotFound", err)
	}
}

func TestDelete_NonGitRepo(t *testing.T) {
	dir := t.TempDir()
	r := NewRegistry(dir)

	err := r.Delete("feature", false)
	if err != ErrNotGitRepo {
		t.Errorf("Delete() error = %v, want ErrNotGitRepo", err)
	}
}

func TestWorktreesDir(t *testing.T) {
	r := NewRegistry("/path/to/myproject")

	got := r.worktreesDir()
	want := "/path/to/myproject-worktrees"

	if got != want {
		t.Errorf("worktreesDir() = %q, want %q", got, want)
	}
}

// initGitRepo creates a temporary git repository with an initial commit.
func initGitRepo(t *testing.T) string {
	t.Helper()

	dir := resolveSymlinks(t, t.TempDir())

	commands := [][]string{
		{"git", "init"},
		{"git", "config", "user.email", "test@test.com"},
		{"git", "config", "user.name", "Test"},
		{"git", "config", "commit.gpgsign", "false"},
		{"git", "commit", "--allow-empty", "-m", "initial"},
	}

	for _, args := range commands {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%v failed: %s", args, out)
		}
	}

	return dir
}

// resolveSymlinks resolves symlinks for consistent path comparison (e.g., /var -> /private/var on macOS).
func resolveSymlinks(t *testing.T, path string) string {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		t.Fatalf("EvalSymlinks(%q) failed: %v", path, err)
	}
	return resolved
}
