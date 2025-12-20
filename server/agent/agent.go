package agent

import "context"

// Agent defines the interface for an AI agent.
type Agent interface {
	// Run executes the agent with the given prompt.
	// It returns a channel of events that will be closed when the agent finishes.
	// The context can be used to cancel the execution.
	// sessionID is used to continue a previous conversation. If empty, a new session is created.
	Run(ctx context.Context, prompt string, workDir string, sessionID string) (<-chan AgentEvent, error)
}
