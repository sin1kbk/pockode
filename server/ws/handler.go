package ws

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/pockode/server/agent"
	"github.com/pockode/server/logger"
)

const (
	// promptLogMaxLen limits prompt length in logs for privacy.
	promptLogMaxLen = 50
)

// Handler handles WebSocket connections for chat.
type Handler struct {
	token   string
	agent   agent.Agent
	workDir string
	devMode bool
}

// NewHandler creates a new WebSocket handler.
func NewHandler(token string, ag agent.Agent, workDir string, devMode bool) *Handler {
	return &Handler{
		token:   token,
		agent:   ag,
		workDir: workDir,
		devMode: devMode,
	}
}

// ServeHTTP handles HTTP requests and upgrades to WebSocket.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Validate token from query parameter
	queryToken := r.URL.Query().Get("token")
	if queryToken == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	if subtle.ConstantTimeCompare([]byte(queryToken), []byte(h.token)) != 1 {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// Accept WebSocket connection
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: h.devMode,
	})
	if err != nil {
		logger.Error("Failed to accept websocket: %v", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	h.handleConnection(r.Context(), conn)
}

// sessionEntry holds the state for a single agent session.
type sessionEntry struct {
	session *agent.Session
}

// connectionState holds the state for a WebSocket connection.
// A single WebSocket connection can manage multiple agent sessions.
type connectionState struct {
	mu       sync.Mutex
	sessions map[string]*sessionEntry // sessionID -> session entry

	// writeMu protects WebSocket writes from concurrent access
	writeMu sync.Mutex
}

// handleConnection manages the WebSocket connection lifecycle.
func (h *Handler) handleConnection(ctx context.Context, conn *websocket.Conn) {
	logger.Info("handleConnection: new connection")

	state := &connectionState{
		sessions: make(map[string]*sessionEntry),
	}

	// Cleanup all sessions on connection close
	defer func() {
		state.mu.Lock()
		for sessionID, entry := range state.sessions {
			logger.Info("handleConnection: closing session %s", sessionID)
			entry.session.Close()
		}
		state.mu.Unlock()
	}()

	// Main loop: read messages from client
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			logger.Debug("handleConnection: read error: %v", err)
			return
		}

		logger.Debug("handleConnection: received message (len=%d)", len(data))

		var msg ClientMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			logger.Error("handleConnection: unmarshal error: %v", err)
			h.sendErrorWithLock(ctx, conn, state, "Invalid message format")
			continue
		}

		logger.Debug("handleConnection: parsed message type=%s, id=%s, sessionID=%s", msg.Type, msg.ID, msg.SessionID)

		switch msg.Type {
		case "message":
			if err := h.handleMessage(ctx, conn, msg, state); err != nil {
				logger.Error("handleConnection: handleMessage error: %v", err)
				h.sendErrorWithLock(ctx, conn, state, err.Error())
			}

		case "cancel":
			// TODO: implement cancel for specific session
			logger.Info("handleConnection: cancel not yet implemented")

		case "permission_response":
			if err := h.handlePermissionResponse(ctx, conn, msg, state); err != nil {
				logger.Error("handleConnection: permission response error: %v", err)
				h.sendErrorWithLock(ctx, conn, state, err.Error())
			}

		default:
			h.sendErrorWithLock(ctx, conn, state, "Unknown message type")
		}
	}
}

// handleMessage processes a user message, creating or reusing a session as needed.
func (h *Handler) handleMessage(ctx context.Context, conn *websocket.Conn, msg ClientMessage, state *connectionState) error {
	state.mu.Lock()
	entry, exists := state.sessions[msg.SessionID]

	if !exists {
		// Create new session (or resume if sessionID is provided)
		// Hold lock during creation to prevent duplicate sessions
		session, err := h.agent.Start(ctx, h.workDir, msg.SessionID)
		if err != nil {
			state.mu.Unlock()
			return err
		}

		entry = &sessionEntry{session: session}
		state.sessions[msg.SessionID] = entry
		state.mu.Unlock()

		// Start goroutine to stream events from this session
		go h.streamEvents(ctx, conn, msg.SessionID, state)

		logger.Info("handleMessage: created session %s", msg.SessionID)
	} else {
		state.mu.Unlock()
	}

	logger.Info("handleMessage: prompt=%q, sessionID=%s", logger.Truncate(msg.Content, promptLogMaxLen), msg.SessionID)

	return entry.session.SendMessage(msg.Content)
}

// handlePermissionResponse routes a permission response to the correct session.
func (h *Handler) handlePermissionResponse(ctx context.Context, conn *websocket.Conn, msg ClientMessage, state *connectionState) error {
	state.mu.Lock()
	entry, exists := state.sessions[msg.SessionID]
	state.mu.Unlock()

	if !exists {
		return fmt.Errorf("session not found: %s", msg.SessionID)
	}

	return entry.session.SendPermissionResponse(agent.PermissionResponse{
		RequestID: msg.RequestID,
		Allow:     msg.Allow,
	})
}

// streamEvents reads events from the agent session and sends them to the client.
func (h *Handler) streamEvents(ctx context.Context, conn *websocket.Conn, sessionID string, state *connectionState) {
	state.mu.Lock()
	entry, exists := state.sessions[sessionID]
	state.mu.Unlock()

	if !exists {
		logger.Error("streamEvents: session not found: %s", sessionID)
		return
	}

	for event := range entry.session.Events {
		logger.Debug("streamEvents: sessionID=%s, type=%s", sessionID, event.Type)

		serverMsg := ServerMessage{
			Type:       string(event.Type),
			Content:    event.Content,
			ToolName:   event.ToolName,
			ToolInput:  event.ToolInput,
			ToolUseID:  event.ToolUseID,
			ToolResult: event.ToolResult,
			Error:      event.Error,
			SessionID:  event.SessionID,
			RequestID:  event.RequestID,
		}

		if err := h.sendWithLock(ctx, conn, state, serverMsg); err != nil {
			logger.Error("streamEvents: send error: %v", err)
			return
		}
	}

	logger.Info("streamEvents: session %s ended", sessionID)
}

// sendWithLock writes a message to the WebSocket connection with mutex protection.
func (h *Handler) sendWithLock(ctx context.Context, conn *websocket.Conn, state *connectionState, msg ServerMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	state.writeMu.Lock()
	defer state.writeMu.Unlock()
	return conn.Write(ctx, websocket.MessageText, data)
}

// sendErrorWithLock sends an error message to the client with mutex protection.
func (h *Handler) sendErrorWithLock(ctx context.Context, conn *websocket.Conn, state *connectionState, errMsg string) error {
	return h.sendWithLock(ctx, conn, state, ServerMessage{
		Type:  "error",
		Error: errMsg,
	})
}
