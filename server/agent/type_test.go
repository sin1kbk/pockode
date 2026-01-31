package agent

import (
	"testing"
)

func TestAgentType_IsValid(t *testing.T) {
	tests := []struct {
		name      string
		agentType AgentType
		want      bool
	}{
		{"claude is valid", TypeClaude, true},
		{"cursor-agent is valid", TypeCursorAgent, true},
		{"empty is invalid", "", false},
		{"unknown is invalid", AgentType("unknown"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.agentType.IsValid(); got != tt.want {
				t.Errorf("IsValid(%q) = %v, want %v", string(tt.agentType), got, tt.want)
			}
		})
	}
}
