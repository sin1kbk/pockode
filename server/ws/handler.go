package ws

import (
	"context"
	"crypto/subtle"
	"encoding/json"
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

// sessionState holds the state for a WebSocket connection.
type sessionState struct {
	mu        sync.Mutex
	sessionID string
	session   *agent.Session // current active session for permission responses
}

// handleConnection manages the WebSocket connection lifecycle.
func (h *Handler) handleConnection(ctx context.Context, conn *websocket.Conn) {
	logger.Info("handleConnection: new connection")
	var cancel context.CancelFunc
	state := &sessionState{}

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			logger.Debug("handleConnection: read error: %v", err)
			if cancel != nil {
				cancel()
			}
			return
		}

		logger.Debug("handleConnection: received message (len=%d)", len(data))

		var msg ClientMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			logger.Error("handleConnection: unmarshal error: %v", err)
			h.sendError(ctx, conn, "", "Invalid message format")
			continue
		}

		logger.Debug("handleConnection: parsed message type=%s, id=%s", msg.Type, msg.ID)

		switch msg.Type {
		case "message":
			if cancel != nil {
				cancel()
			}
			var msgCtx context.Context
			msgCtx, cancel = context.WithCancel(ctx)
			go h.handleMessage(msgCtx, conn, msg, state)

		case "cancel":
			if cancel != nil {
				cancel()
				cancel = nil
			}

		case "permission_response":
			state.mu.Lock()
			session := state.session
			state.mu.Unlock()
			if session != nil {
				if err := session.SendPermissionResponse(agent.PermissionResponse{
					RequestID: msg.RequestID,
					Allow:     msg.Allow,
				}); err != nil {
					logger.Error("handleConnection: permission response error: %v", err)
				}
			} else {
				logger.Error("handleConnection: no active session for permission response")
			}

		default:
			h.sendError(ctx, conn, msg.ID, "Unknown message type")
		}
	}
}

// handleMessage processes a user message and streams the response.
func (h *Handler) handleMessage(ctx context.Context, conn *websocket.Conn, msg ClientMessage, state *sessionState) {
	// Use client-provided sessionID if present, otherwise use server-side state
	sessionID := msg.SessionID
	if sessionID == "" {
		state.mu.Lock()
		sessionID = state.sessionID
		state.mu.Unlock()
	}

	logger.Info("handleMessage: prompt=%q, workDir=%s, sessionID=%s", logger.Truncate(msg.Content, promptLogMaxLen), h.workDir, sessionID)

	session, err := h.agent.Run(ctx, msg.Content, h.workDir, sessionID)
	if err != nil {
		logger.Error("agent.Run error: %v", err)
		h.sendError(ctx, conn, msg.ID, err.Error())
		return
	}

	// Store session for permission responses
	state.mu.Lock()
	state.session = session
	state.mu.Unlock()

	for event := range session.Events {
		logger.Debug("event: type=%s", event.Type)

		// Update session ID when received from agent
		if event.SessionID != "" {
			state.mu.Lock()
			state.sessionID = event.SessionID
			state.mu.Unlock()
			logger.Info("handleMessage: session updated to %s", event.SessionID)
		}

		serverMsg := ServerMessage{
			Type:       string(event.Type),
			MessageID:  msg.ID,
			Content:    event.Content,
			ToolName:   event.ToolName,
			ToolInput:  event.ToolInput,
			ToolUseID:  event.ToolUseID,
			ToolResult: event.ToolResult,
			Error:      event.Error,
			SessionID:  event.SessionID,
			RequestID:  event.RequestID,
		}

		if err := h.send(ctx, conn, serverMsg); err != nil {
			logger.Error("send error: %v", err)
			return
		}
	}

	// Clear session when done
	state.mu.Lock()
	state.session = nil
	state.mu.Unlock()
}

// send writes a message to the WebSocket connection.
func (h *Handler) send(ctx context.Context, conn *websocket.Conn, msg ServerMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, data)
}

// sendError sends an error message to the client.
func (h *Handler) sendError(ctx context.Context, conn *websocket.Conn, msgID, errMsg string) error {
	if err := h.send(ctx, conn, ServerMessage{
		Type:      "error",
		MessageID: msgID,
		Error:     errMsg,
	}); err != nil {
		logger.Error("sendError: failed to send error message: %v", err)
		return err
	}
	return nil
}
