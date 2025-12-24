package session

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Store defines operations for session management.
type Store interface {
	List() ([]SessionMeta, error)
	Create() (SessionMeta, error)
	Delete(sessionID string) error
	Update(sessionID string, title string) error
}

// indexData is the structure of index.json.
type indexData struct {
	Sessions []SessionMeta `json:"sessions"`
}

// FileStore implements Store using file system storage.
type FileStore struct {
	dataDir string
	mu      sync.RWMutex
}

// NewFileStore creates a new FileStore with the given data directory.
func NewFileStore(dataDir string) (*FileStore, error) {
	sessionsDir := filepath.Join(dataDir, "sessions")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		return nil, err
	}
	return &FileStore{dataDir: dataDir}, nil
}

func (s *FileStore) indexPath() string {
	return filepath.Join(s.dataDir, "sessions", "index.json")
}

func (s *FileStore) readIndex() (indexData, error) {
	data, err := os.ReadFile(s.indexPath())
	if os.IsNotExist(err) {
		return indexData{Sessions: []SessionMeta{}}, nil
	}
	if err != nil {
		return indexData{}, err
	}

	var idx indexData
	if err := json.Unmarshal(data, &idx); err != nil {
		return indexData{}, err
	}
	return idx, nil
}

func (s *FileStore) writeIndex(idx indexData) error {
	data, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.indexPath(), data, 0644)
}

func generateUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	// Set version 4 (random)
	b[6] = (b[6] & 0x0f) | 0x40
	// Set variant (RFC 4122)
	b[8] = (b[8] & 0x3f) | 0x80
	return hex.EncodeToString(b[:4]) + "-" +
		hex.EncodeToString(b[4:6]) + "-" +
		hex.EncodeToString(b[6:8]) + "-" +
		hex.EncodeToString(b[8:10]) + "-" +
		hex.EncodeToString(b[10:])
}

// List returns all sessions sorted by updated_at (newest first).
func (s *FileStore) List() ([]SessionMeta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	idx, err := s.readIndex()
	if err != nil {
		return nil, err
	}
	return idx.Sessions, nil
}

// Create creates a new session with default title.
func (s *FileStore) Create() (SessionMeta, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx, err := s.readIndex()
	if err != nil {
		return SessionMeta{}, err
	}

	now := time.Now()
	session := SessionMeta{
		ID:        generateUUID(),
		Title:     "New Chat",
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Prepend new session (newest first)
	idx.Sessions = append([]SessionMeta{session}, idx.Sessions...)

	if err := s.writeIndex(idx); err != nil {
		return SessionMeta{}, err
	}
	return session, nil
}

// Delete removes a session by ID.
func (s *FileStore) Delete(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx, err := s.readIndex()
	if err != nil {
		return err
	}

	// Find and remove session
	newSessions := make([]SessionMeta, 0, len(idx.Sessions))
	for _, sess := range idx.Sessions {
		if sess.ID != sessionID {
			newSessions = append(newSessions, sess)
		}
	}
	idx.Sessions = newSessions

	return s.writeIndex(idx)
}

// Update updates a session's title by ID.
func (s *FileStore) Update(sessionID string, title string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx, err := s.readIndex()
	if err != nil {
		return err
	}

	now := time.Now()
	for i, sess := range idx.Sessions {
		if sess.ID == sessionID {
			idx.Sessions[i].Title = title
			idx.Sessions[i].UpdatedAt = now
			return s.writeIndex(idx)
		}
	}

	return nil // Session not found, no error
}
