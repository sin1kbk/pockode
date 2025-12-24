package session

import (
	"testing"
)

func TestFileStore_Create(t *testing.T) {
	store, err := NewFileStore(t.TempDir())
	if err != nil {
		t.Fatalf("NewFileStore failed: %v", err)
	}

	sess, err := store.Create()
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	if sess.ID == "" {
		t.Error("expected non-empty ID")
	}
	if sess.Title != "New Chat" {
		t.Errorf("expected title 'New Chat', got %q", sess.Title)
	}
	if sess.CreatedAt.IsZero() {
		t.Error("expected non-zero CreatedAt")
	}
}

func TestFileStore_List(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())

	// Initially empty
	sessions, err := store.List()
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(sessions))
	}

	// Create sessions
	sess1, _ := store.Create()
	sess2, _ := store.Create()

	sessions, err = store.List()
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(sessions) != 2 {
		t.Errorf("expected 2 sessions, got %d", len(sessions))
	}

	// Newest first
	if sessions[0].ID != sess2.ID {
		t.Errorf("expected newest session first, got %s", sessions[0].ID)
	}
	if sessions[1].ID != sess1.ID {
		t.Errorf("expected oldest session second, got %s", sessions[1].ID)
	}
}

func TestFileStore_Delete(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())

	sess, _ := store.Create()

	err := store.Delete(sess.ID)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	sessions, _ := store.List()
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions after delete, got %d", len(sessions))
	}
}

func TestFileStore_DeleteNonExistent(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())

	// Should not error on non-existent session
	err := store.Delete("non-existent-id")
	if err != nil {
		t.Errorf("Delete non-existent should not error, got %v", err)
	}
}

func TestFileStore_Update(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())

	sess, _ := store.Create()
	if sess.Title != "New Chat" {
		t.Fatalf("expected initial title 'New Chat', got %q", sess.Title)
	}

	err := store.Update(sess.ID, "Updated Title")
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	sessions, _ := store.List()
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].Title != "Updated Title" {
		t.Errorf("expected title 'Updated Title', got %q", sessions[0].Title)
	}
	if !sessions[0].UpdatedAt.After(sess.UpdatedAt) {
		t.Error("expected UpdatedAt to be updated")
	}
}

func TestFileStore_UpdateNonExistent(t *testing.T) {
	store, _ := NewFileStore(t.TempDir())

	// Should not error on non-existent session
	err := store.Update("non-existent-id", "Title")
	if err != nil {
		t.Errorf("Update non-existent should not error, got %v", err)
	}
}

func TestFileStore_Persistence(t *testing.T) {
	dir := t.TempDir()

	// Create session with first store instance
	store1, _ := NewFileStore(dir)
	sess, _ := store1.Create()

	// Create new store instance, should see persisted data
	store2, _ := NewFileStore(dir)
	sessions, err := store2.List()
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Errorf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].ID != sess.ID {
		t.Errorf("expected session ID %s, got %s", sess.ID, sessions[0].ID)
	}
}
