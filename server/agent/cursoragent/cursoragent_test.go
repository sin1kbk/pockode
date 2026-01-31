package cursoragent

import (
	"context"
	"testing"

	"github.com/pockode/server/agent"
	"github.com/pockode/server/session"
)

func TestNew_returns_agent(t *testing.T) {
	a := New()
	if a == nil {
		t.Fatal("New() returned nil")
	}
	_, err := a.Start(context.Background(), agent.StartOptions{
		WorkDir: t.TempDir(),
		Mode:    session.ModeDefault,
	})
	// Start may fail if cursor-agent is not in PATH; we only assert agent is non-nil.
	_ = err
}

func TestBinary_constant(t *testing.T) {
	if Binary != "cursor-agent" {
		t.Errorf("Binary = %q, want cursor-agent", Binary)
	}
}
