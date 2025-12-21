package agent

import (
	"context"
	"errors"
)

// ErrSessionClosed is returned when attempting to use a closed session.
var ErrSessionClosed = errors.New("session is closed")

// Agent defines the interface for an AI agent.
type Agent interface {
	// Start launches a persistent agent process and returns a Session.
	// The process stays alive until the context is cancelled or Close is called.
	// workDir is the working directory for the agent.
	// sessionID is used to resume a previous conversation. If empty, a new session is created.
	Start(ctx context.Context, workDir string, sessionID string) (*Session, error)
}

// Session represents an active agent session with bidirectional communication.
// The process persists across multiple messages within the same session.
type Session struct {
	// Events streams all events from the agent process.
	// The channel remains open until the process terminates.
	// EventTypeDone signals the current message response is complete.
	Events <-chan AgentEvent

	// sendMessage sends a new message to the agent.
	// It should only be called after the previous message is complete (received EventTypeDone).
	sendMessage func(prompt string) error

	// sendPermission sends a permission response to the agent.
	sendPermission func(PermissionResponse) error

	// close terminates the agent process.
	close func()
}

// SendMessage sends a new message to the agent.
// Returns ErrSessionClosed if the session is closed or not properly initialized.
func (s *Session) SendMessage(prompt string) error {
	if s.sendMessage == nil {
		return ErrSessionClosed
	}
	return s.sendMessage(prompt)
}

// SendPermissionResponse sends a permission response to the agent.
// Returns ErrSessionClosed if the session is closed or not properly initialized.
func (s *Session) SendPermissionResponse(resp PermissionResponse) error {
	if s.sendPermission == nil {
		return ErrSessionClosed
	}
	return s.sendPermission(resp)
}

// Close terminates the agent process and releases resources.
func (s *Session) Close() {
	if s.close != nil {
		s.close()
	}
}

// NewSession creates a new Session with the given functions.
// This is primarily for testing purposes.
func NewSession(events <-chan AgentEvent, sendMessage func(string) error, sendPermission func(PermissionResponse) error, close func()) *Session {
	return &Session{
		Events:         events,
		sendMessage:    sendMessage,
		sendPermission: sendPermission,
		close:          close,
	}
}
