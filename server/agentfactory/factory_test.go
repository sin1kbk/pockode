package agentfactory

import (
	"context"
	"testing"

	"github.com/pockode/server/agent"
)

func TestNew_claude_returns_agent(t *testing.T) {
	ag, err := New(agent.TypeClaude)
	if err != nil {
		t.Fatalf("New(claude): %v", err)
	}
	if ag == nil {
		t.Fatal("New(claude): got nil agent")
	}
	_, _ = ag.Start(context.Background(), agent.StartOptions{WorkDir: t.TempDir()})
}

func TestNew_cursor_agent_returns_agent(t *testing.T) {
	ag, err := New(agent.TypeCursorAgent)
	if err != nil {
		t.Fatalf("New(cursor-agent): %v", err)
	}
	if ag == nil {
		t.Fatal("New(cursor-agent): got nil agent")
	}
	_, _ = ag.Start(context.Background(), agent.StartOptions{WorkDir: t.TempDir()})
}

func TestNew_unknown_returns_error(t *testing.T) {
	ag, err := New("invalid")
	if err == nil {
		t.Fatal("New(invalid): expected error, got nil")
	}
	if ag != nil {
		t.Fatalf("New(invalid): expected nil agent, got %T", ag)
	}
}
