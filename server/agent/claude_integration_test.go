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

	session, err := agent.Run(ctx, "Reply with exactly: OK", t.TempDir(), "")
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	var textEvents, doneEvents, sessionEvents int

eventLoop:
	for {
		select {
		case event, ok := <-session.Events:
			if !ok {
				break eventLoop
			}
			switch event.Type {
			case EventTypeSession:
				sessionEvents++
				t.Logf("session: %s", event.SessionID)
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

	if sessionEvents == 0 {
		t.Error("expected at least one session event")
	}
	if textEvents == 0 {
		t.Error("expected at least one text event")
	}
	if doneEvents != 1 {
		t.Errorf("expected exactly 1 done event, got %d", doneEvents)
	}
}

func TestIntegration_PermissionFlow(t *testing.T) {
	agent := NewClaudeAgent()

	// Test timeout is shorter than agent default (5min) to fail fast
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Use a command that will definitely require permission (not pre-approved)
	// Ruby version check is a good candidate as it's not a common pre-approved command
	session, err := agent.Run(ctx, "Run this exact command and show output: ruby --version", t.TempDir(), "")
	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	var toolCalls, toolResults, errorEvents, permissionRequests int

eventLoop:
	for {
		select {
		case event, ok := <-session.Events:
			if !ok {
				break eventLoop
			}
			switch event.Type {
			case EventTypeToolCall:
				toolCalls++
				t.Logf("tool_call: %s (id=%s)", event.ToolName, event.ToolUseID)
			case EventTypeToolResult:
				toolResults++
				t.Logf("tool_result: id=%s, content=%s", event.ToolUseID, event.ToolResult[:min(100, len(event.ToolResult))])
			case EventTypePermissionRequest:
				permissionRequests++
				t.Logf("permission_request: %s (request_id=%s)", event.ToolName, event.RequestID)
				if event.RequestID == "" {
					t.Error("permission_request missing RequestID")
				}
				if event.ToolName == "" {
					t.Error("permission_request missing ToolName")
				}
				// Auto-approve for integration test
				if err := session.SendPermissionResponse(PermissionResponse{
					RequestID: event.RequestID,
					Allow:     true,
				}); err != nil {
					t.Errorf("failed to send permission response: %v", err)
				}
			case EventTypeError:
				errorEvents++
				t.Logf("error: %s", event.Error)
			case EventTypeText:
				t.Logf("text: %s", event.Content[:min(100, len(event.Content))])
			}
		case <-ctx.Done():
			t.Fatal("timeout waiting for events")
		}
	}

	t.Logf("summary: permission_requests=%d, tool_calls=%d, tool_results=%d, errors=%d",
		permissionRequests, toolCalls, toolResults, errorEvents)

	// With --permission-prompt-tool stdio, we MUST get permission requests
	if permissionRequests == 0 {
		t.Error("expected at least one permission_request event - permission flow not triggered")
	}

	// After approval, tool should execute
	if permissionRequests > 0 && toolResults == 0 {
		t.Error("permission was approved but no tool_result received")
	}
}
