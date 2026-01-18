package agent

import "encoding/json"

// HistoryRecord wraps an AgentEvent for JSON serialization with a type field.
// This is used for persisting events to history storage.
type HistoryRecord struct {
	Type                  EventType          `json:"type"`
	Content               string             `json:"content,omitempty"`
	ToolName              string             `json:"tool_name,omitempty"`
	ToolInput             json.RawMessage    `json:"tool_input,omitempty"`
	ToolUseID             string             `json:"tool_use_id,omitempty"`
	ToolResult            string             `json:"tool_result,omitempty"`
	Error                 string             `json:"error,omitempty"`
	Message               string             `json:"message,omitempty"`
	Code                  string             `json:"code,omitempty"`
	RequestID             string             `json:"request_id,omitempty"`
	PermissionSuggestions []PermissionUpdate `json:"permission_suggestions,omitempty"`
	Questions             []AskUserQuestion  `json:"questions,omitempty"`
	Choice                string             `json:"choice,omitempty"`
	Answers               map[string]string  `json:"answers,omitempty"`
}

// NewHistoryRecord creates a HistoryRecord from an AgentEvent.
func NewHistoryRecord(event AgentEvent) HistoryRecord {
	return event.ToHistoryRecord()
}
