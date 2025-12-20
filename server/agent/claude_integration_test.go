//go:build integration

package agent

import (
	"context"
	"os/exec"
	"testing"
	"time"
)

// Integration tests for Claude CLI.
// These tests call real Claude CLI and consume API tokens.
//
// Run manually with: go test -tags=integration ./agent -v -run Integration
//
// Prerequisites:
//   - claude CLI installed and in PATH
//   - Valid API credentials configured

func TestIntegration_ClaudeCliAvailable(t *testing.T) {
	_, err := exec.LookPath(ClaudeBinary)
	if err != nil {
		t.Fatalf("claude CLI not found in PATH: %v", err)
	}
}

func TestIntegration_SimplePrompt(t *testing.T) {
	agent := NewClaudeAgent()

	// Test timeout is shorter than agent default (5min) to fail fast
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	events, err := agent.Run(ctx, "Reply with exactly: OK", t.TempDir(), "")
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	var textEvents, doneEvents int

eventLoop:
	for {
		select {
		case event, ok := <-events:
			if !ok {
				break eventLoop
			}
			switch event.Type {
			case EventTypeText:
				textEvents++
				t.Logf("text: %s", event.Content)
			case EventTypeDone:
				doneEvents++
			case EventTypeError:
				t.Errorf("error event: %s", event.Error)
			}
		case <-ctx.Done():
			t.Fatal("timeout waiting for events")
		}
	}

	if textEvents == 0 {
		t.Error("expected at least one text event")
	}
	if doneEvents != 1 {
		t.Errorf("expected exactly 1 done event, got %d", doneEvents)
	}
}

func TestIntegration_ToolUse(t *testing.T) {
	agent := NewClaudeAgent()

	// Test timeout is shorter than agent default (5min) to fail fast
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Prompt that forces tool use by requiring file system interaction
	events, err := agent.Run(ctx, "Run: ls -la", t.TempDir(), "")
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	var toolCalls, toolResults, errorEvents int

eventLoop:
	for {
		select {
		case event, ok := <-events:
			if !ok {
				break eventLoop
			}
			switch event.Type {
			case EventTypeToolCall:
				toolCalls++
				t.Logf("tool_call: %s (id=%s)", event.ToolName, event.ToolUseID)
				if event.ToolUseID == "" {
					t.Error("tool_use missing ToolUseID")
				}
				if event.ToolName == "" {
					t.Error("tool_use missing ToolName")
				}
			case EventTypeToolResult:
				toolResults++
				t.Logf("tool_result: id=%s", event.ToolUseID)
				if event.ToolUseID == "" {
					t.Error("tool_result missing ToolUseID")
				}
			case EventTypeError:
				errorEvents++
				t.Logf("error: %s", event.Error)
			}
		case <-ctx.Done():
			t.Fatal("timeout waiting for events")
		}
	}

	t.Logf("summary: tool_calls=%d, tool_results=%d, errors=%d", toolCalls, toolResults, errorEvents)

	// Note: Claude's behavior is non-deterministic, so this test may occasionally fail
	if toolCalls == 0 {
		t.Error("expected at least one tool_call event")
	}
	if toolCalls > 0 && toolResults == 0 {
		t.Error("got tool_calls but no tool_results")
	}
}
