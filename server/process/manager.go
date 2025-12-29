package process

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/pockode/server/agent"
	"github.com/pockode/server/session"
)

// Manager manages global agent sessions with idle timeout.
// Sessions persist beyond WebSocket connections until idle timeout.
type Manager struct {
	agent        agent.Agent
	workDir      string
	sessionStore session.Store
	idleTimeout  time.Duration

	entriesMu sync.Mutex
	entries   map[string]*Entry

	ctx    context.Context
	cancel context.CancelFunc
}

// Entry holds an active agent session with its subscribers.
type Entry struct {
	sessionID    string
	session      agent.Session
	sessionStore session.Store

	mu         sync.Mutex
	lastActive time.Time
	conns      []*connWriter
}

// connWriter wraps a WebSocket connection for thread-safe writes.
type connWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

// NewManager creates a new session manager with the given idle timeout.
func NewManager(ag agent.Agent, workDir string, store session.Store, idleTimeout time.Duration) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	m := &Manager{
		agent:        ag,
		workDir:      workDir,
		sessionStore: store,
		idleTimeout:  idleTimeout,
		entries:      make(map[string]*Entry),
		ctx:          ctx,
		cancel:       cancel,
	}
	go m.runIdleReaper()
	return m
}

// GetOrCreate returns an existing session or creates a new one.
// Returns the entry and whether it was newly created.
func (m *Manager) GetOrCreate(ctx context.Context, sessionID string, resume bool) (*Entry, bool, error) {
	m.entriesMu.Lock()
	defer m.entriesMu.Unlock()

	if entry, exists := m.entries[sessionID]; exists {
		entry.touch()
		return entry, false, nil
	}

	// Use manager's context for process lifecycle, not request context
	sess, err := m.agent.Start(m.ctx, m.workDir, sessionID, resume)
	if err != nil {
		return nil, false, err
	}

	entry := &Entry{
		sessionID:    sessionID,
		session:      sess,
		sessionStore: m.sessionStore,
		lastActive:   time.Now(),
		conns:        make([]*connWriter, 0),
	}
	m.entries[sessionID] = entry

	go func() {
		entry.streamEvents(m.ctx)
		m.remove(sessionID)
		slog.Info("session process ended", "sessionId", sessionID)
	}()

	slog.Info("created session process", "sessionId", sessionID, "resume", resume)
	return entry, true, nil
}

// Get returns an existing entry or nil.
func (m *Manager) Get(sessionID string) *Entry {
	m.entriesMu.Lock()
	defer m.entriesMu.Unlock()
	return m.entries[sessionID]
}

// Touch updates the session's last active time.
func (m *Manager) Touch(sessionID string) {
	m.entriesMu.Lock()
	defer m.entriesMu.Unlock()
	if entry, exists := m.entries[sessionID]; exists {
		entry.touch()
	}
}

// remove removes an entry from the manager and returns it.
func (m *Manager) remove(sessionID string) *Entry {
	m.entriesMu.Lock()
	defer m.entriesMu.Unlock()
	entry := m.entries[sessionID]
	delete(m.entries, sessionID)
	return entry
}

// removeWhere removes entries matching the predicate and returns them.
func (m *Manager) removeWhere(predicate func(*Entry) bool) []*Entry {
	m.entriesMu.Lock()
	defer m.entriesMu.Unlock()

	var removed []*Entry
	for sessionID, entry := range m.entries {
		if predicate(entry) {
			removed = append(removed, entry)
			delete(m.entries, sessionID)
		}
	}
	return removed
}

// Close terminates a specific session.
func (m *Manager) Close(sessionID string) {
	if entry := m.remove(sessionID); entry != nil {
		entry.session.Close()
		slog.Info("closed session", "sessionId", sessionID)
	}
}

// Shutdown closes all sessions gracefully.
func (m *Manager) Shutdown() {
	m.cancel()
	entries := m.removeWhere(func(*Entry) bool { return true })
	for _, e := range entries {
		e.session.Close()
	}
	slog.Info("manager shutdown complete", "sessionsClosed", len(entries))
}

func (m *Manager) runIdleReaper() {
	ticker := time.NewTicker(m.idleTimeout / 4)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.reapIdle()
		case <-m.ctx.Done():
			return
		}
	}
}

func (m *Manager) reapIdle() {
	now := time.Now()
	entries := m.removeWhere(func(e *Entry) bool {
		return now.Sub(e.getLastActive()) > m.idleTimeout
	})
	for _, entry := range entries {
		entry.session.Close()
		slog.Info("reaped idle session", "sessionId", entry.sessionID)
	}
}

// Session returns the underlying agent session.
func (e *Entry) Session() agent.Session {
	return e.session
}

func (e *Entry) touch() {
	e.mu.Lock()
	e.lastActive = time.Now()
	e.mu.Unlock()
}

func (e *Entry) getLastActive() time.Time {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.lastActive
}

// Attach adds a WebSocket connection to receive events.
func (e *Entry) Attach(conn *websocket.Conn) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.conns = append(e.conns, &connWriter{conn: conn})
	slog.Debug("attached connection", "sessionId", e.sessionID, "totalConns", len(e.conns))
}

// Detach removes a WebSocket connection from receiving events.
// It does not close the connection; the caller is responsible for that.
func (e *Entry) Detach(conn *websocket.Conn) {
	e.mu.Lock()
	defer e.mu.Unlock()

	newConns := make([]*connWriter, 0, len(e.conns))
	for _, cw := range e.conns {
		if cw.conn != conn {
			newConns = append(newConns, cw)
		}
	}
	e.conns = newConns
	slog.Debug("detached connection", "sessionId", e.sessionID, "totalConns", len(e.conns))
}

// streamEvents routes events to history and all connected WebSockets.
func (e *Entry) streamEvents(ctx context.Context) {
	log := slog.With("sessionId", e.sessionID)

	for event := range e.session.Events() {
		log.Debug("streaming event", "type", event.Type)

		serverMsg := toServerMessage(e.sessionID, event)

		// History persists even when no WebSocket is connected
		if err := e.sessionStore.AppendToHistory(ctx, e.sessionID, serverMsg); err != nil {
			log.Error("failed to append to history", "error", err)
		}

		e.broadcast(ctx, serverMsg)
	}

	log.Info("event stream ended")
}

func (e *Entry) broadcast(ctx context.Context, msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("failed to marshal message", "error", err)
		return
	}

	e.mu.Lock()
	conns := make([]*connWriter, len(e.conns))
	copy(conns, e.conns)
	e.mu.Unlock()

	for _, cw := range conns {
		cw.mu.Lock()
		err := cw.conn.Write(ctx, websocket.MessageText, data)
		cw.mu.Unlock()

		if err != nil {
			slog.Debug("broadcast write failed", "error", err)
		}
	}
}

// ServerMessage represents a message sent to the client.
type ServerMessage struct {
	Type                  string                   `json:"type"`
	SessionID             string                   `json:"session_id"`
	Content               string                   `json:"content,omitempty"`
	ToolName              string                   `json:"tool_name,omitempty"`
	ToolInput             json.RawMessage          `json:"tool_input,omitempty"`
	ToolUseID             string                   `json:"tool_use_id,omitempty"`
	ToolResult            string                   `json:"tool_result,omitempty"`
	Error                 string                   `json:"error,omitempty"`
	RequestID             string                   `json:"request_id,omitempty"`
	PermissionSuggestions []agent.PermissionUpdate `json:"permission_suggestions,omitempty"`
	Questions             []agent.AskUserQuestion  `json:"questions,omitempty"`
}

func toServerMessage(sessionID string, event agent.AgentEvent) ServerMessage {
	return ServerMessage{
		Type:                  string(event.Type),
		SessionID:             sessionID,
		Content:               event.Content,
		ToolName:              event.ToolName,
		ToolInput:             event.ToolInput,
		ToolUseID:             event.ToolUseID,
		ToolResult:            event.ToolResult,
		Error:                 event.Error,
		RequestID:             event.RequestID,
		PermissionSuggestions: event.PermissionSuggestions,
		Questions:             event.Questions,
	}
}
