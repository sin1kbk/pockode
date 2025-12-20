package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/pockode/server/logger"
)

const (
	DefaultTimeout    = 5 * time.Minute
	ClaudeBinary      = "claude"
	stderrReadTimeout = 5 * time.Second
)

// ClaudeAgent implements the Agent interface using Claude CLI.
type ClaudeAgent struct {
	timeout time.Duration
}

// NewClaudeAgent creates a new ClaudeAgent with default settings.
func NewClaudeAgent() *ClaudeAgent {
	return &ClaudeAgent{timeout: DefaultTimeout}
}

// userMessage is the format for sending prompts via stdin with stream-json input.
type userMessage struct {
	Type    string      `json:"type"`
	Message userContent `json:"message"`
}

type userContent struct {
	Role    string        `json:"role"`
	Content []textContent `json:"content"`
}

type textContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Run executes Claude CLI with the given prompt and streams events.
// sessionID is used to continue a previous conversation. If empty, a new session is created.
func (c *ClaudeAgent) Run(ctx context.Context, prompt string, workDir string, sessionID string) (*Session, error) {
	events := make(chan AgentEvent)

	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)

	// When using --input-format stream-json, prompt is sent via stdin, not -p flag
	args := []string{
		"--output-format", "stream-json",
		"--input-format", "stream-json",
		"--permission-prompt-tool", "stdio",
		"--verbose",
	}
	if sessionID != "" {
		args = append(args, "--resume", sessionID)
	}

	cmd := exec.CommandContext(timeoutCtx, ClaudeBinary, args...)
	cmd.Dir = workDir

	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to start claude: %w", err)
	}

	// Helper to cleanup on error after process started
	cleanupOnError := func(err error) (*Session, error) {
		cancel()
		stdin.Close()
		cmd.Process.Kill()
		cmd.Wait()
		return nil, err
	}

	// Send prompt via stdin as JSON (required for --input-format stream-json)
	userMsg := userMessage{
		Type: "user",
		Message: userContent{
			Role: "user",
			Content: []textContent{
				{Type: "text", Text: prompt},
			},
		},
	}
	msgData, err := json.Marshal(userMsg)
	if err != nil {
		return cleanupOnError(fmt.Errorf("failed to marshal user message: %w", err))
	}
	if _, err := stdin.Write(append(msgData, '\n')); err != nil {
		return cleanupOnError(fmt.Errorf("failed to write prompt to stdin: %w", err))
	}

	// Track pending permission requests for response handling
	pendingRequests := &sync.Map{}

	// Create session with permission response capability
	session := &Session{
		Events: events,
		sendPermission: func(resp PermissionResponse) error {
			pending, ok := pendingRequests.Load(resp.RequestID)
			if !ok {
				return fmt.Errorf("no pending request for id: %s", resp.RequestID)
			}
			req := pending.(*controlRequest)
			return c.sendControlResponse(stdin, resp, req)
		},
	}

	go func() {
		defer close(events)
		defer cancel()
		defer stdin.Close()

		// Read stderr in a separate goroutine
		stderrCh := make(chan string, 1)
		go func() {
			var stderrContent strings.Builder
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				stderrContent.WriteString(scanner.Text())
				stderrContent.WriteString("\n")
			}
			stderrCh <- stderrContent.String()
		}()

		scanner := bufio.NewScanner(stdout)
		// Increase buffer size for long lines
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}

			parsedEvents, isResult := c.parseLine(line, pendingRequests)
			for _, event := range parsedEvents {
				select {
				case events <- event:
				case <-timeoutCtx.Done():
					return
				}
			}

			// Close stdin after result to let CLI exit
			if isResult {
				stdin.Close()
			}
		}

		if err := scanner.Err(); err != nil {
			logger.Error("stdout scanner error: %v", err)
		}

		// Wait for stderr goroutine with timeout
		var stderrContent string
		select {
		case stderrContent = <-stderrCh:
		case <-time.After(stderrReadTimeout):
			// Timeout waiting for stderr, continue without it
		}

		if err := cmd.Wait(); err != nil {
			errMsg := stderrContent
			if errMsg == "" {
				errMsg = err.Error()
			}
			select {
			case events <- AgentEvent{Type: EventTypeError, Error: errMsg}:
			case <-timeoutCtx.Done():
			}
		}

		select {
		case events <- AgentEvent{Type: EventTypeDone}:
		case <-timeoutCtx.Done():
		}
	}()

	return session, nil
}

// controlRequest holds data for a pending permission request.
type controlRequest struct {
	RequestID string          `json:"request_id"`
	Request   *permissionData `json:"request"`
}

// permissionData contains the details of a permission request.
type permissionData struct {
	Subtype   string          `json:"subtype"`
	ToolName  string          `json:"tool_name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
}

// controlResponse is the response format for permission requests.
type controlResponse struct {
	Type     string                 `json:"type"`
	Response controlResponsePayload `json:"response"`
}

type controlResponsePayload struct {
	Subtype   string                 `json:"subtype"`
	RequestID string                 `json:"request_id"`
	Response  controlResponseContent `json:"response"`
}

type controlResponseContent struct {
	Behavior     string          `json:"behavior"`
	Message      string          `json:"message,omitempty"`
	Interrupt    bool            `json:"interrupt,omitempty"`
	ToolUseID    string          `json:"toolUseID"`
	UpdatedInput json.RawMessage `json:"updatedInput,omitempty"`
}

// sendControlResponse writes a permission response to stdin.
func (c *ClaudeAgent) sendControlResponse(stdin io.Writer, resp PermissionResponse, req *controlRequest) error {
	var content controlResponseContent
	if resp.Allow {
		content = controlResponseContent{
			Behavior:     "allow",
			ToolUseID:    req.Request.ToolUseID,
			UpdatedInput: req.Request.Input,
		}
	} else {
		content = controlResponseContent{
			Behavior:  "deny",
			Message:   "User denied permission",
			Interrupt: true,
			ToolUseID: req.Request.ToolUseID,
		}
	}

	response := controlResponse{
		Type: "control_response",
		Response: controlResponsePayload{
			Subtype:   "success",
			RequestID: resp.RequestID,
			Response:  content,
		},
	}

	data, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("failed to marshal control response: %w", err)
	}

	logger.Debug("sendControlResponse: %s", string(data))
	_, err = stdin.Write(append(data, '\n'))
	return err
}

// cliEvent represents a raw event from Claude CLI verbose stream-json output.
type cliEvent struct {
	Type      string          `json:"type"`
	Subtype   string          `json:"subtype,omitempty"`
	Message   json.RawMessage `json:"message,omitempty"`
	Result    string          `json:"result,omitempty"`
	SessionID string          `json:"session_id,omitempty"`
}

// cliMessage represents the message object in assistant events.
type cliMessage struct {
	Content []cliContentBlock `json:"content"`
}

// cliContentBlock represents a content block in the message.
type cliContentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"` // for tool_result
	Content   string          `json:"content,omitempty"`     // for tool_result
}

// parseLine parses a single line of Claude CLI verbose stream-json output.
// Returns a slice of events and a bool indicating if this is a result event (signals end of turn).
func (c *ClaudeAgent) parseLine(line []byte, pendingRequests *sync.Map) ([]AgentEvent, bool) {
	if len(line) == 0 {
		return nil, false
	}

	var event cliEvent
	if err := json.Unmarshal(line, &event); err != nil {
		logger.Error("parseLine: failed to parse JSON: %v, line: %s", err, logger.Truncate(string(line), 100))
		// Fallback: send raw content as text to ensure minimum usability
		return []AgentEvent{{
			Type:    EventTypeText,
			Content: string(line),
		}}, false
	}

	switch event.Type {
	case "assistant":
		return c.parseAssistantEvent(event), false
	case "user":
		// "user" in Claude API contains tool_result, not actual user input
		return c.parseUserEvent(event), false
	case "result":
		// Result event means completion, signal to close stdin
		return nil, true
	case "system":
		// System event contains the session ID
		if event.SessionID != "" {
			return []AgentEvent{{
				Type:      EventTypeSession,
				SessionID: event.SessionID,
			}}, false
		}
		return nil, false
	case "control_request":
		return c.parseControlRequest(line, pendingRequests), false
	default:
		logger.Info("parseLine: unknown event type: %s", event.Type)
		return []AgentEvent{{
			Type:    EventTypeText,
			Content: string(line),
		}}, false
	}
}

// parseControlRequest handles permission request messages from Claude CLI.
func (c *ClaudeAgent) parseControlRequest(line []byte, pendingRequests *sync.Map) []AgentEvent {
	var req controlRequest
	if err := json.Unmarshal(line, &req); err != nil {
		logger.Error("parseControlRequest: failed to parse: %v", err)
		return nil
	}

	// Only handle can_use_tool requests (permission requests)
	if req.Request == nil {
		logger.Debug("parseControlRequest: ignoring request with nil request data")
		return nil
	}
	if req.Request.Subtype != "can_use_tool" {
		logger.Debug("parseControlRequest: ignoring non-permission request: %s", req.Request.Subtype)
		return nil
	}

	logger.Info("parseControlRequest: tool=%s, requestID=%s", req.Request.ToolName, req.RequestID)

	// Store the request for later response
	pendingRequests.Store(req.RequestID, &req)

	return []AgentEvent{{
		Type:      EventTypePermissionRequest,
		RequestID: req.RequestID,
		ToolName:  req.Request.ToolName,
		ToolInput: req.Request.Input,
		ToolUseID: req.Request.ToolUseID,
	}}
}

// parseAssistantEvent handles assistant message events.
// Returns multiple events when message contains multiple content blocks.
func (c *ClaudeAgent) parseAssistantEvent(event cliEvent) []AgentEvent {
	if event.Message == nil {
		logger.Error("parseAssistantEvent: message is nil, subtype: %s", event.Subtype)
		return nil
	}

	var msg cliMessage
	if err := json.Unmarshal(event.Message, &msg); err != nil {
		logger.Error("parseAssistantEvent: failed to parse message: %v", err)
		// Fallback: send raw message as text
		return []AgentEvent{{
			Type:    EventTypeText,
			Content: string(event.Message),
		}}
	}

	var events []AgentEvent
	var textParts []string

	for _, block := range msg.Content {
		switch block.Type {
		case "text":
			if block.Text != "" {
				textParts = append(textParts, block.Text)
			}
		case "tool_use":
			// Flush accumulated text before tool_use
			if len(textParts) > 0 {
				events = append(events, AgentEvent{
					Type:    EventTypeText,
					Content: strings.Join(textParts, ""),
				})
				textParts = nil
			}
			events = append(events, AgentEvent{
				Type:      EventTypeToolCall,
				ToolUseID: block.ID,
				ToolName:  block.Name,
				ToolInput: block.Input,
			})
		}
	}

	// Flush remaining text
	if len(textParts) > 0 {
		events = append(events, AgentEvent{
			Type:    EventTypeText,
			Content: strings.Join(textParts, ""),
		})
	}

	return events
}

// parseUserEvent handles "user" type events from Claude CLI.
//
// In Claude API protocol, tool execution results are sent as "user" role messages.
// This is different from actual user input (which comes from the frontend).
// We extract tool_result blocks and convert them to EventTypeToolResult.
func (c *ClaudeAgent) parseUserEvent(event cliEvent) []AgentEvent {
	if event.Message == nil {
		return nil
	}

	var msg cliMessage
	if err := json.Unmarshal(event.Message, &msg); err != nil {
		logger.Error("parseUserEvent: failed to parse message: %v", err)
		// Fallback: send raw message as text
		return []AgentEvent{{
			Type:    EventTypeText,
			Content: string(event.Message),
		}}
	}

	var events []AgentEvent
	for _, block := range msg.Content {
		if block.Type == "tool_result" {
			events = append(events, AgentEvent{
				Type:       EventTypeToolResult,
				ToolUseID:  block.ToolUseID,
				ToolResult: block.Content,
			})
		}
	}

	return events
}
