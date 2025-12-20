package ws

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/pockode/server/agent"
)

// mockAgent implements agent.Agent for testing.
type mockAgent struct {
	events    []agent.AgentEvent
	err       error
	sessionID string             // session ID to return
	calls     []mockAgentRunCall // record of all Run calls
}

type mockAgentRunCall struct {
	Prompt    string
	WorkDir   string
	SessionID string
}

func (m *mockAgent) Run(ctx context.Context, prompt string, workDir string, sessionID string) (<-chan agent.AgentEvent, error) {
	m.calls = append(m.calls, mockAgentRunCall{
		Prompt:    prompt,
		WorkDir:   workDir,
		SessionID: sessionID,
	})

	if m.err != nil {
		return nil, m.err
	}

	ch := make(chan agent.AgentEvent)
	go func() {
		defer close(ch)

		// Always send session event first (matches real Claude CLI behavior)
		// If no sessionID configured, generate a fake one for testing
		sessionID := m.sessionID
		if sessionID == "" {
			sessionID = "mock-session-" + prompt[:min(8, len(prompt))]
		}
		select {
		case ch <- agent.AgentEvent{Type: agent.EventTypeSession, SessionID: sessionID}:
		case <-ctx.Done():
			return
		}

		for _, event := range m.events {
			select {
			case ch <- event:
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch, nil
}

func TestHandler_MissingToken(t *testing.T) {
	h := NewHandler("secret-token", &mockAgent{}, "/tmp", true)

	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}

	if !strings.Contains(rec.Body.String(), "Missing token") {
		t.Errorf("expected 'Missing token' in body, got %q", rec.Body.String())
	}
}

func TestHandler_InvalidToken(t *testing.T) {
	h := NewHandler("secret-token", &mockAgent{}, "/tmp", true)

	req := httptest.NewRequest(http.MethodGet, "/ws?token=wrong-token", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}

	if !strings.Contains(rec.Body.String(), "Invalid token") {
		t.Errorf("expected 'Invalid token' in body, got %q", rec.Body.String())
	}
}

func TestHandler_WebSocketConnection(t *testing.T) {
	events := []agent.AgentEvent{
		{Type: agent.EventTypeText, Content: "Hello"},
		{Type: agent.EventTypeDone},
	}
	h := NewHandler("test-token", &mockAgent{events: events}, "/tmp", true)

	server := httptest.NewServer(h)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?token=test-token"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Send a message
	msg := ClientMessage{
		Type:    "message",
		ID:      "test-123",
		Content: "Hello AI",
	}
	msgData, _ := json.Marshal(msg)
	if err := conn.Write(ctx, websocket.MessageText, msgData); err != nil {
		t.Fatalf("failed to write: %v", err)
	}

	// Read responses (session + text + done = 3)
	var responses []ServerMessage
	for i := 0; i < 3; i++ {
		_, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("failed to read: %v", err)
		}
		var resp ServerMessage
		if err := json.Unmarshal(data, &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		responses = append(responses, resp)
	}

	// Verify responses
	if len(responses) != 3 {
		t.Fatalf("expected 3 responses, got %d", len(responses))
	}

	if responses[0].Type != "session" {
		t.Errorf("expected first response to be session, got %+v", responses[0])
	}

	if responses[1].Type != "text" || responses[1].Content != "Hello" {
		t.Errorf("unexpected second response: %+v", responses[1])
	}

	if responses[2].Type != "done" {
		t.Errorf("unexpected third response: %+v", responses[2])
	}

	if responses[1].MessageID != "test-123" {
		t.Errorf("expected message_id 'test-123', got %q", responses[1].MessageID)
	}
}

func TestHandler_SessionPersistence(t *testing.T) {
	mock := &mockAgent{
		sessionID: "session-abc-123",
		events: []agent.AgentEvent{
			{Type: agent.EventTypeText, Content: "Response"},
			{Type: agent.EventTypeDone},
		},
	}
	h := NewHandler("test-token", mock, "/tmp", true)

	server := httptest.NewServer(h)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?token=test-token"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Send first message
	msg1 := ClientMessage{Type: "message", ID: "msg-1", Content: "First message"}
	msgData, _ := json.Marshal(msg1)
	if err := conn.Write(ctx, websocket.MessageText, msgData); err != nil {
		t.Fatalf("failed to write first message: %v", err)
	}

	// Read all responses for first message (session + text + done = 3)
	for i := 0; i < 3; i++ {
		_, _, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("failed to read response %d: %v", i, err)
		}
	}

	// Send second message
	msg2 := ClientMessage{Type: "message", ID: "msg-2", Content: "Second message"}
	msgData, _ = json.Marshal(msg2)
	if err := conn.Write(ctx, websocket.MessageText, msgData); err != nil {
		t.Fatalf("failed to write second message: %v", err)
	}

	// Read all responses for second message
	for i := 0; i < 3; i++ {
		_, _, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("failed to read response %d: %v", i, err)
		}
	}

	// Verify session persistence
	if len(mock.calls) != 2 {
		t.Fatalf("expected 2 agent calls, got %d", len(mock.calls))
	}

	// First call should have empty session ID
	if mock.calls[0].SessionID != "" {
		t.Errorf("first call should have empty sessionID, got %q", mock.calls[0].SessionID)
	}

	// Second call should have the session ID from first response
	if mock.calls[1].SessionID != "session-abc-123" {
		t.Errorf("second call should have sessionID 'session-abc-123', got %q", mock.calls[1].SessionID)
	}
}

func TestHandler_ClientProvidedSessionID(t *testing.T) {
	mock := &mockAgent{
		events: []agent.AgentEvent{
			{Type: agent.EventTypeText, Content: "Response"},
			{Type: agent.EventTypeDone},
		},
	}
	h := NewHandler("test-token", mock, "/tmp", true)

	server := httptest.NewServer(h)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?token=test-token"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Send message with client-provided session ID
	msg := ClientMessage{
		Type:      "message",
		ID:        "msg-1",
		Content:   "Hello",
		SessionID: "client-session-xyz",
	}
	msgData, _ := json.Marshal(msg)
	if err := conn.Write(ctx, websocket.MessageText, msgData); err != nil {
		t.Fatalf("failed to write: %v", err)
	}

	// Read all responses (session + text + done = 3)
	for i := 0; i < 3; i++ {
		_, _, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("failed to read response %d: %v", i, err)
		}
	}

	// Verify client-provided session ID was used
	if len(mock.calls) != 1 {
		t.Fatalf("expected 1 agent call, got %d", len(mock.calls))
	}

	if mock.calls[0].SessionID != "client-session-xyz" {
		t.Errorf("expected client-provided sessionID 'client-session-xyz', got %q", mock.calls[0].SessionID)
	}
}
