// Package agentfactory creates an Agent by type (used at server startup).
package agentfactory

import (
	"errors"
	"fmt"

	"github.com/pockode/server/agent"
	"github.com/pockode/server/agent/claude"
	"github.com/pockode/server/agent/cursoragent"
)

var errUnknownAgent = errors.New("unknown agent type")

// New returns an Agent for the given type. Returns error if type is not supported.
func New(t agent.AgentType) (agent.Agent, error) {
	if !t.IsValid() {
		return nil, fmt.Errorf("%w: %q", errUnknownAgent, t)
	}
	switch t {
	case agent.TypeClaude:
		return claude.New(), nil
	case agent.TypeCursorAgent:
		return cursoragent.New(), nil
	default:
		return nil, fmt.Errorf("%w: %q", errUnknownAgent, t)
	}
}
