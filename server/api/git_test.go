package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/pockode/server/git"
)

// setupGitRepo creates a temporary git repository for testing.
func setupGitRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	// Initialize git repo
	cmd := exec.Command("git", "init")
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		t.Fatalf("failed to init git repo: %v", err)
	}

	// Configure user for commits
	cmd = exec.Command("git", "config", "user.email", "test@test.com")
	cmd.Dir = dir
	cmd.Run()
	cmd = exec.Command("git", "config", "user.name", "Test")
	cmd.Dir = dir
	cmd.Run()

	return dir
}

func TestGitHandler_HandleStatus_Success(t *testing.T) {
	dir := setupGitRepo(t)

	// Create a test file
	testFile := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(testFile, []byte("hello"), 0644); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	handler := NewGitHandler(dir)
	req := httptest.NewRequest(http.MethodGet, "/api/git/status", nil)
	rec := httptest.NewRecorder()

	handler.HandleStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var status git.GitStatus
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Should have one untracked file
	if len(status.Unstaged) != 1 {
		t.Errorf("expected 1 unstaged file, got %d", len(status.Unstaged))
	}
	if status.Unstaged[0].Path != "test.txt" {
		t.Errorf("expected path 'test.txt', got %q", status.Unstaged[0].Path)
	}
	if status.Unstaged[0].Status != "?" {
		t.Errorf("expected status '?', got %q", status.Unstaged[0].Status)
	}
}

func TestGitHandler_HandleStatus_EmptyRepo(t *testing.T) {
	dir := setupGitRepo(t)

	handler := NewGitHandler(dir)
	req := httptest.NewRequest(http.MethodGet, "/api/git/status", nil)
	rec := httptest.NewRecorder()

	handler.HandleStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var status git.GitStatus
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(status.Staged) != 0 || len(status.Unstaged) != 0 {
		t.Errorf("expected empty status, got staged=%d unstaged=%d", len(status.Staged), len(status.Unstaged))
	}
}

func TestGitHandler_HandleUnstagedDiff_Success(t *testing.T) {
	dir := setupGitRepo(t)

	// Create and commit a file first
	testFile := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(testFile, []byte("original"), 0644); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}
	cmd := exec.Command("git", "add", "test.txt")
	cmd.Dir = dir
	cmd.Run()
	cmd = exec.Command("git", "commit", "-m", "initial")
	cmd.Dir = dir
	cmd.Run()

	// Modify the file
	if err := os.WriteFile(testFile, []byte("modified"), 0644); err != nil {
		t.Fatalf("failed to modify test file: %v", err)
	}

	handler := NewGitHandler(dir)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/git/unstaged/test.txt", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp struct {
		Diff string `json:"diff"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Diff == "" {
		t.Error("expected non-empty diff")
	}
}

func TestGitHandler_HandleUnstagedDiff_UntrackedFile(t *testing.T) {
	dir := setupGitRepo(t)

	// Create an untracked file
	testFile := filepath.Join(dir, "untracked.txt")
	if err := os.WriteFile(testFile, []byte("content\n"), 0644); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	handler := NewGitHandler(dir)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/git/unstaged/untracked.txt", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp struct {
		Diff string `json:"diff"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Should show the file as addition
	if resp.Diff == "" {
		t.Error("expected non-empty diff for untracked file")
	}
}

func TestGitHandler_HandleStagedDiff_Success(t *testing.T) {
	dir := setupGitRepo(t)

	// Create and commit a file first
	testFile := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(testFile, []byte("original"), 0644); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}
	cmd := exec.Command("git", "add", "test.txt")
	cmd.Dir = dir
	cmd.Run()
	cmd = exec.Command("git", "commit", "-m", "initial")
	cmd.Dir = dir
	cmd.Run()

	// Modify and stage the file
	if err := os.WriteFile(testFile, []byte("modified"), 0644); err != nil {
		t.Fatalf("failed to modify test file: %v", err)
	}
	cmd = exec.Command("git", "add", "test.txt")
	cmd.Dir = dir
	cmd.Run()

	handler := NewGitHandler(dir)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/git/staged/test.txt", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp struct {
		Diff string `json:"diff"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Diff == "" {
		t.Error("expected non-empty diff for staged file")
	}
}

func TestGitHandler_HandleDiff_PathTraversal(t *testing.T) {
	dir := setupGitRepo(t)
	handler := NewGitHandler(dir)
	mux := http.NewServeMux()
	handler.Register(mux)

	testCases := []struct {
		name string
		path string
	}{
		// URL-encoded paths that bypass HTTP normalization
		{"encoded dot dot", "/api/git/unstaged/..%2F..%2Fetc%2Fpasswd"},
		{"encoded double dot start", "/api/git/unstaged/..%2Ftest.txt"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("expected status 400 for %s, got %d", tc.path, rec.Code)
			}
		})
	}
}

func TestGitHandler_HandleDiff_PathRequired(t *testing.T) {
	dir := setupGitRepo(t)
	handler := NewGitHandler(dir)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/git/unstaged/", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}

func TestGitHandler_HandleDiff_FileNotFound(t *testing.T) {
	dir := setupGitRepo(t)
	handler := NewGitHandler(dir)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/git/unstaged/nonexistent.txt", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", rec.Code)
	}
}
