package agent

// AgentType identifies which CLI backend to use (single choice at server startup).
type AgentType string

const (
	TypeClaude      AgentType = "claude"
	TypeCursorAgent AgentType = "cursor-agent"
)

// Default is the default agent type when none is specified.
const Default AgentType = TypeClaude

// IsValid returns true if the agent type is supported.
func (t AgentType) IsValid() bool {
	switch t {
	case TypeClaude, TypeCursorAgent:
		return true
	default:
		return false
	}
}
