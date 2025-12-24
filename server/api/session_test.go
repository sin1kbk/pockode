package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pockode/server/session"
)

func TestSessionHandler_List(t *testing.T) {
	store, _ := session.NewFileStore(t.TempDir())
	store.Create()
	store.Create()

	handler := NewSessionHandler(store)
	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	rec := httptest.NewRecorder()

	handler.HandleList(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp struct {
		Sessions []session.SessionMeta `json:"sessions"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Sessions) != 2 {
		t.Errorf("expected 2 sessions, got %d", len(resp.Sessions))
	}
}

func TestSessionHandler_Create(t *testing.T) {
	store, _ := session.NewFileStore(t.TempDir())
	handler := NewSessionHandler(store)

	req := httptest.NewRequest(http.MethodPost, "/api/sessions", nil)
	rec := httptest.NewRecorder()

	handler.HandleCreate(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d", rec.Code)
	}

	var sess session.SessionMeta
	if err := json.NewDecoder(rec.Body).Decode(&sess); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if sess.ID == "" {
		t.Error("expected non-empty session ID")
	}
	if sess.Title != "New Chat" {
		t.Errorf("expected title 'New Chat', got %q", sess.Title)
	}
}

func TestSessionHandler_Delete(t *testing.T) {
	store, _ := session.NewFileStore(t.TempDir())
	sess, _ := store.Create()

	handler := NewSessionHandler(store)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodDelete, "/api/sessions/"+sess.ID, nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", rec.Code)
	}

	// Verify deleted
	sessions, _ := store.List()
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions after delete, got %d", len(sessions))
	}
}
