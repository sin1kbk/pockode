package agent

import (
	"bytes"
	"encoding/json"
	"sync"
	"testing"
)

func TestParseLine(t *testing.T) {
	agent := NewClaudeAgent()

	tests := []struct {
		name     string
		input    string
		expected []AgentEvent
		isResult bool
	}{
		{
			name:     "empty line",
			input:    "",
			expected: nil,
		},
		{
			name:  "invalid json falls back to raw text",
			input: "not json",
			expected: []AgentEvent{{
				Type:    EventTypeText,
				Content: "not json",
			}},
		},
		{
			name:     "system init event",
			input:    `{"type":"system","subtype":"init","cwd":"/tmp"}`,
			expected: nil,
		},
		{
			name:     "result event",
			input:    `{"type":"result","subtype":"success","result":"Hello"}`,
			expected: nil,
			isResult: true,
		},
		{
			name:  "assistant text message",
			input: `{"type":"assistant","message":{"content":[{"type":"text","text":"Hello World"}]}}`,
			expected: []AgentEvent{{
				Type:    EventTypeText,
				Content: "Hello World",
			}},
		},
		{
			name:  "assistant message with multiple text blocks",
			input: `{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"},{"type":"text","text":" World"}]}}`,
			expected: []AgentEvent{{
				Type:    EventTypeText,
				Content: "Hello World",
			}},
		},
		{
			name:     "assistant message with empty content",
			input:    `{"type":"assistant","message":{"content":[]}}`,
			expected: nil,
		},
		{
			name:  "assistant tool_use message",
			input: `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_123","name":"Read","input":{"file":"test.go"}}]}}`,
			expected: []AgentEvent{{
				Type:      EventTypeToolCall,
				ToolUseID: "toolu_123",
				ToolName:  "Read",
				ToolInput: json.RawMessage(`{"file":"test.go"}`),
			}},
		},
		{
			name:  "assistant text and tool_use in same message",
			input: `{"type":"assistant","message":{"content":[{"type":"text","text":"I will read the file"},{"type":"tool_use","id":"toolu_456","name":"Read","input":{"path":"main.go"}}]}}`,
			expected: []AgentEvent{
				{
					Type:    EventTypeText,
					Content: "I will read the file",
				},
				{
					Type:      EventTypeToolCall,
					ToolUseID: "toolu_456",
					ToolName:  "Read",
					ToolInput: json.RawMessage(`{"path":"main.go"}`),
				},
			},
		},
		{
			name:  "assistant multiple tool_use (parallel tools)",
			input: `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Read","input":{"path":"a.go"}},{"type":"tool_use","id":"toolu_2","name":"Read","input":{"path":"b.go"}}]}}`,
			expected: []AgentEvent{
				{
					Type:      EventTypeToolCall,
					ToolUseID: "toolu_1",
					ToolName:  "Read",
					ToolInput: json.RawMessage(`{"path":"a.go"}`),
				},
				{
					Type:      EventTypeToolCall,
					ToolUseID: "toolu_2",
					ToolName:  "Read",
					ToolInput: json.RawMessage(`{"path":"b.go"}`),
				},
			},
		},
		{
			name:  "user tool_result message",
			input: `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_123","content":"file contents here"}]}}`,
			expected: []AgentEvent{{
				Type:       EventTypeToolResult,
				ToolUseID:  "toolu_123",
				ToolResult: "file contents here",
			}},
		},
		{
			name:  "user multiple tool_results (parallel tool results)",
			input: `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"result 1"},{"type":"tool_result","tool_use_id":"toolu_2","content":"result 2"}]}}`,
			expected: []AgentEvent{
				{
					Type:       EventTypeToolResult,
					ToolUseID:  "toolu_1",
					ToolResult: "result 1",
				},
				{
					Type:       EventTypeToolResult,
					ToolUseID:  "toolu_2",
					ToolResult: "result 2",
				},
			},
		},
		{
			name:  "user event with invalid message falls back to raw text",
			input: `{"type":"user","message":"invalid message format"}`,
			expected: []AgentEvent{{
				Type:    EventTypeText,
				Content: `"invalid message format"`,
			}},
		},
		{
			name:  "unknown event type falls back to raw text",
			input: `{"type":"unknown_event"}`,
			expected: []AgentEvent{{
				Type:    EventTypeText,
				Content: `{"type":"unknown_event"}`,
			}},
		},
		{
			name:  "control_request permission request",
			input: `{"type":"control_request","request_id":"req-123","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"ruby --version"},"tool_use_id":"toolu_abc"}}`,
			expected: []AgentEvent{{
				Type:      EventTypePermissionRequest,
				RequestID: "req-123",
				ToolName:  "Bash",
				ToolInput: json.RawMessage(`{"command":"ruby --version"}`),
				ToolUseID: "toolu_abc",
			}},
		},
		{
			name:     "control_request non-permission request ignored",
			input:    `{"type":"control_request","request_id":"req-456","request":{"subtype":"other_type"}}`,
			expected: nil,
		},
		{
			name:     "control_request with nil request ignored",
			input:    `{"type":"control_request","request_id":"req-789"}`,
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pendingRequests := &sync.Map{}
			results, isResult := agent.parseLine([]byte(tt.input), pendingRequests)

			if isResult != tt.isResult {
				t.Errorf("isResult: expected %v, got %v", tt.isResult, isResult)
			}

			if tt.expected == nil {
				if len(results) != 0 {
					t.Errorf("expected nil/empty, got %+v", results)
				}
				return
			}

			if len(results) != len(tt.expected) {
				t.Fatalf("expected %d events, got %d: %+v", len(tt.expected), len(results), results)
			}

			for i, expected := range tt.expected {
				result := results[i]

				if result.Type != expected.Type {
					t.Errorf("event[%d] Type: expected %q, got %q", i, expected.Type, result.Type)
				}

				if result.Content != expected.Content {
					t.Errorf("event[%d] Content: expected %q, got %q", i, expected.Content, result.Content)
				}

				if result.ToolName != expected.ToolName {
					t.Errorf("event[%d] ToolName: expected %q, got %q", i, expected.ToolName, result.ToolName)
				}

				if result.ToolUseID != expected.ToolUseID {
					t.Errorf("event[%d] ToolUseID: expected %q, got %q", i, expected.ToolUseID, result.ToolUseID)
				}

				if result.ToolResult != expected.ToolResult {
					t.Errorf("event[%d] ToolResult: expected %q, got %q", i, expected.ToolResult, result.ToolResult)
				}

				if result.RequestID != expected.RequestID {
					t.Errorf("event[%d] RequestID: expected %q, got %q", i, expected.RequestID, result.RequestID)
				}

				if expected.ToolInput != nil {
					if string(result.ToolInput) != string(expected.ToolInput) {
						t.Errorf("event[%d] ToolInput: expected %s, got %s", i, expected.ToolInput, result.ToolInput)
					}
				}
			}
		})
	}
}

func TestNewClaudeAgent(t *testing.T) {
	agent := NewClaudeAgent()

	if agent == nil {
		t.Fatal("NewClaudeAgent returned nil")
	}
}

func TestParseControlRequest_StoresPendingRequest(t *testing.T) {
	agent := NewClaudeAgent()
	pendingRequests := &sync.Map{}

	input := `{"type":"control_request","request_id":"req-789","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"ls"},"tool_use_id":"toolu_xyz"}}`
	results, isResult := agent.parseLine([]byte(input), pendingRequests)

	if isResult {
		t.Error("expected isResult to be false for control_request")
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	// Verify request is stored in pending map
	stored, ok := pendingRequests.Load("req-789")
	if !ok {
		t.Fatal("expected pending request to be stored")
	}

	req := stored.(*controlRequest)
	if req.RequestID != "req-789" {
		t.Errorf("expected request_id 'req-789', got %q", req.RequestID)
	}
	if req.Request.ToolName != "Bash" {
		t.Errorf("expected tool_name 'Bash', got %q", req.Request.ToolName)
	}
	if req.Request.ToolUseID != "toolu_xyz" {
		t.Errorf("expected tool_use_id 'toolu_xyz', got %q", req.Request.ToolUseID)
	}
}

func TestSendControlResponse_Allow(t *testing.T) {
	agent := NewClaudeAgent()
	var buf bytes.Buffer

	req := &controlRequest{
		RequestID: "req-123",
		Request: &permissionData{
			ToolUseID: "toolu_abc",
			Input:     json.RawMessage(`{"command":"ruby --version"}`),
		},
	}

	err := agent.sendControlResponse(&buf, PermissionResponse{
		RequestID: "req-123",
		Allow:     true,
	}, req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var response controlResponse
	if err := json.Unmarshal(buf.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Type != "control_response" {
		t.Errorf("expected type 'control_response', got %q", response.Type)
	}
	if response.Response.Subtype != "success" {
		t.Errorf("expected subtype 'success', got %q", response.Response.Subtype)
	}
	if response.Response.RequestID != "req-123" {
		t.Errorf("expected request_id 'req-123', got %q", response.Response.RequestID)
	}
	if response.Response.Response.Behavior != "allow" {
		t.Errorf("expected behavior 'allow', got %q", response.Response.Response.Behavior)
	}
	if response.Response.Response.ToolUseID != "toolu_abc" {
		t.Errorf("expected toolUseID 'toolu_abc', got %q", response.Response.Response.ToolUseID)
	}
	if string(response.Response.Response.UpdatedInput) != `{"command":"ruby --version"}` {
		t.Errorf("expected updatedInput, got %q", string(response.Response.Response.UpdatedInput))
	}
}

func TestSendControlResponse_Deny(t *testing.T) {
	agent := NewClaudeAgent()
	var buf bytes.Buffer

	req := &controlRequest{
		RequestID: "req-456",
		Request: &permissionData{
			ToolUseID: "toolu_def",
		},
	}

	err := agent.sendControlResponse(&buf, PermissionResponse{
		RequestID: "req-456",
		Allow:     false,
	}, req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var response controlResponse
	if err := json.Unmarshal(buf.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Response.Response.Behavior != "deny" {
		t.Errorf("expected behavior 'deny', got %q", response.Response.Response.Behavior)
	}
	if !response.Response.Response.Interrupt {
		t.Error("expected interrupt to be true")
	}
	if response.Response.Response.Message != "User denied permission" {
		t.Errorf("expected message 'User denied permission', got %q", response.Response.Response.Message)
	}
}
