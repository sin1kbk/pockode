package agent

import "context"

// Agent defines the interface for an AI agent.
type Agent interface {
	// Run executes the agent with the given prompt.
	// It returns a Session for bidirectional communication.
	// The context can be used to cancel the execution.
	// sessionID is used to continue a previous conversation. If empty, a new session is created.
	Run(ctx context.Context, prompt string, workDir string, sessionID string) (*Session, error)
}

// Session represents an active agent session with bidirectional communication.
type Session struct {
	// Events is a channel for receiving events from the agent.
	Events <-chan AgentEvent

	// sendPermission is a function to send permission responses to the agent.
	sendPermission func(PermissionResponse) error
}

// SendPermissionResponse sends a permission response to the agent.
func (s *Session) SendPermissionResponse(resp PermissionResponse) error {
	if s.sendPermission == nil {
		return nil
	}
	return s.sendPermission(resp)
}
