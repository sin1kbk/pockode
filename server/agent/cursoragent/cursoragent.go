// Package cursoragent implements Agent interface using Cursor Agent CLI.
// Cursor CLI uses the same stream-json protocol as Claude Agent SDK.
package cursoragent

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/pockode/server/agent"
	"github.com/pockode/server/logger"
	"github.com/pockode/server/session"
)

const (
	// Binary is the Cursor Agent CLI executable name.
	Binary            = "cursor-agent"
	stderrReadTimeout = 5 * time.Second
)

var execCommandContext = exec.CommandContext

// Agent implements agent.Agent using Cursor Agent CLI.
type Agent struct{}

// New creates a new Cursor Agent.
func New() *Agent {
	return &Agent{}
}

// Start launches a persistent Cursor Agent CLI process.
func (a *Agent) Start(ctx context.Context, opts agent.StartOptions) (agent.Session, error) {
	procCtx, cancel := context.WithCancel(ctx)

	log := slog.With("sessionId", opts.SessionID)
	chatID, err := createChatID(procCtx, opts.WorkDir)
	if err != nil {
		cancel()
		return nil, err
	}

	events := make(chan agent.AgentEvent)
	sess := &cliSession{
		log:     log,
		events:  events,
		workDir: opts.WorkDir,
		mode:    opts.Mode,
		chatID:  chatID,
		ctx:     procCtx,
		cancel:  cancel,
	}

	return sess, nil
}

type cliSession struct {
	log             *slog.Logger
	events          chan agent.AgentEvent
	workDir         string
	mode            session.Mode
	chatID          string
	ctx             context.Context
	activeCancelMu  sync.Mutex
	activeCancel    context.CancelFunc
	runningMu       sync.Mutex
	running         bool
	closeMu         sync.Mutex
	closePending    bool
	closed          bool
	cancel          func()
	closeOnce       sync.Once
}

func (s *cliSession) Events() <-chan agent.AgentEvent { return s.events }

func (s *cliSession) SendMessage(prompt string) error {
	s.runningMu.Lock()
	if s.running {
		s.runningMu.Unlock()
		return fmt.Errorf("another request is already running")
	}
	s.running = true
	s.runningMu.Unlock()

	go func() {
		defer func() {
			s.runningMu.Lock()
			s.running = false
			s.runningMu.Unlock()
			s.maybeCloseEvents()
		}()
		if err := s.runPrompt(prompt); err != nil {
			select {
			case s.events <- agent.ErrorEvent{Error: err.Error()}:
			default:
			}
		}
	}()

	return nil
}

func (s *cliSession) SendPermissionResponse(data agent.PermissionRequestData, choice agent.PermissionChoice) error {
	return fmt.Errorf("permission responses are not supported in cursor-agent print mode")
}

func (s *cliSession) SendQuestionResponse(data agent.QuestionRequestData, answers map[string]string) error {
	return fmt.Errorf("question responses are not supported in cursor-agent print mode")
}

func (s *cliSession) SendInterrupt() error {
	s.activeCancelMu.Lock()
	cancel := s.activeCancel
	s.activeCancelMu.Unlock()
	if cancel == nil {
		return nil
	}
	cancel()
	select {
	case s.events <- agent.InterruptedEvent{}:
	default:
	}
	return nil
}

func (s *cliSession) Close() {
	s.closeOnce.Do(func() {
		s.log.Info("terminating cursor-agent session")
		s.cancel()
		s.closeMu.Lock()
		s.closePending = true
		s.closeMu.Unlock()
		s.maybeCloseEvents()
	})
}

func (s *cliSession) runPrompt(prompt string) error {
	cmdCtx, cancel := context.WithCancel(s.ctx)
	s.activeCancelMu.Lock()
	s.activeCancel = cancel
	s.activeCancelMu.Unlock()
	defer func() {
		cancel()
		s.activeCancelMu.Lock()
		s.activeCancel = nil
		s.activeCancelMu.Unlock()
	}()

	args := []string{
		"--print",
		"--output-format", "stream-json",
		"--resume", s.chatID,
	}
	if s.mode == session.ModeYolo {
		args = append(args, "--force")
	}

	cmd := execCommandContext(cmdCtx, Binary, args...)
	cmd.Dir = s.workDir

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		stdin.Close()
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		stdin.Close()
		stdout.Close()
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		stdin.Close()
		stdout.Close()
		stderr.Close()
		return fmt.Errorf("failed to start cursor-agent: %w", err)
	}

	s.log.Info("cursor-agent message started", "pid", cmd.Process.Pid)

	if _, err := io.WriteString(stdin, prompt); err != nil {
		stdin.Close()
		return fmt.Errorf("failed to write prompt: %w", err)
	}
	if err := stdin.Close(); err != nil {
		return fmt.Errorf("failed to close stdin: %w", err)
	}

	stderrCh := readStderr(stderr)
	streamOutput(cmdCtx, s.log, stdout, s.events)
	waitForProcess(cmdCtx, s.log, cmd, stderrCh, s.events)

	select {
	case s.events <- agent.ProcessEndedEvent{}:
	case <-cmdCtx.Done():
	}

	return nil
}

func (s *cliSession) maybeCloseEvents() {
	s.closeMu.Lock()
	defer s.closeMu.Unlock()
	if s.closed || !s.closePending {
		return
	}
	s.runningMu.Lock()
	running := s.running
	s.runningMu.Unlock()
	if running {
		return
	}
	close(s.events)
	s.closed = true
}

func readStderr(stderr io.Reader) <-chan string {
	ch := make(chan string, 1)
	go func() {
		var content strings.Builder
		defer func() {
			if r := recover(); r != nil {
				logger.LogPanic(r, "failed to read cursor-agent stderr")
			}
			ch <- content.String()
		}()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			content.WriteString(scanner.Text())
			content.WriteString("\n")
		}
		if err := scanner.Err(); err != nil {
			slog.Error("stderr scanner error", "error", err)
		}
	}()
	return ch
}

func createChatID(ctx context.Context, workDir string) (string, error) {
	cmd := execCommandContext(ctx, Binary, "create-chat")
	cmd.Dir = workDir
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to create cursor-agent chat: %w", err)
	}
	chatID := strings.TrimSpace(string(output))
	if chatID == "" {
		return "", fmt.Errorf("cursor-agent returned empty chat id")
	}
	return chatID, nil
}

func streamOutput(ctx context.Context, log *slog.Logger, stdout io.Reader, events chan<- agent.AgentEvent) {
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		for _, event := range parseLine(log, line) {
			select {
			case events <- event:
			case <-ctx.Done():
				return
			}
		}
	}
	if err := scanner.Err(); err != nil {
		log.Error("stdout scanner error", "error", err)
		msg := "Some output could not be read"
		code := "scanner_error"
		if errors.Is(err, bufio.ErrTooLong) {
			msg = "Some output was too large to display"
			code = "scanner_buffer_overflow"
		}
		select {
		case events <- agent.WarningEvent{Message: msg, Code: code}:
		case <-ctx.Done():
		}
	}
}

func waitForProcess(ctx context.Context, log *slog.Logger, cmd *exec.Cmd, stderrCh <-chan string, events chan<- agent.AgentEvent) {
	var stderrContent string
	select {
	case stderrContent = <-stderrCh:
	case <-time.After(stderrReadTimeout):
	}
	if err := cmd.Wait(); err != nil {
		if ctx.Err() == nil {
			errMsg := stderrContent
			if errMsg == "" {
				errMsg = err.Error()
			}
			select {
			case events <- agent.ErrorEvent{Error: errMsg}:
			case <-ctx.Done():
			}
		}
	}
	log.Info("cursor-agent process exited")
}

type controlRequest struct {
	RequestID string          `json:"request_id"`
	Request   *controlPayload `json:"request"`
}

type controlPayload struct {
	Subtype               string                   `json:"subtype"`
	ToolName              string                   `json:"tool_name,omitempty"`
	Input                 json.RawMessage          `json:"input,omitempty"`
	ToolUseID             string                   `json:"tool_use_id,omitempty"`
	PermissionSuggestions []agent.PermissionUpdate `json:"permission_suggestions,omitempty"`
}

type cliEvent struct {
	Type      string          `json:"type"`
	Subtype   string          `json:"subtype,omitempty"`
	Message   json.RawMessage `json:"message,omitempty"`
	SessionID string          `json:"session_id,omitempty"`
}

type cliMessage struct {
	Content []cliContentBlock `json:"content"`
}

type cliMessageString struct {
	Content string `json:"content"`
}

type cliContentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   json.RawMessage `json:"content,omitempty"`
}

func parseLine(log *slog.Logger, line []byte) []agent.AgentEvent {
	if len(line) == 0 {
		return nil
	}
	var event cliEvent
	if err := json.Unmarshal(line, &event); err != nil {
		log.Warn("failed to parse JSON from CLI", "error", err, "lineLength", len(line))
		return []agent.AgentEvent{agent.TextEvent{Content: string(line)}}
	}
	switch event.Type {
	case "assistant":
		return parseAssistantEvent(log, event)
	case "user":
		return parseUserEvent(log, event)
	case "result":
		return []agent.AgentEvent{parseResultEvent(line)}
	case "system":
		if event.Subtype == "init" {
			return nil
		}
		return []agent.AgentEvent{agent.SystemEvent{Content: string(line)}}
	case "control_request":
		return parseControlRequest(log, line)
	case "control_response":
		return parseControlResponse(log, line)
	case "control_cancel_request":
		return parseControlCancelRequest(log, line)
	case "progress":
		return nil
	case "thinking":
		return nil
	default:
		log.Debug("unhandled event type from CLI", "type", event.Type)
		return []agent.AgentEvent{agent.RawEvent{Content: string(line)}}
	}
}

func parseControlRequest(log *slog.Logger, line []byte) []agent.AgentEvent {
	var req controlRequest
	if err := json.Unmarshal(line, &req); err != nil {
		log.Warn("failed to parse control request from CLI", "error", err)
		return nil
	}
	if req.Request == nil {
		return nil
	}
	switch req.Request.Subtype {
	case "can_use_tool":
		if req.Request.ToolName == "AskUserQuestion" {
			var input struct {
				Questions []agent.AskUserQuestion `json:"questions"`
			}
			if err := json.Unmarshal(req.Request.Input, &input); err != nil {
				log.Warn("failed to parse AskUserQuestion input from CLI", "error", err)
				return nil
			}
			log.Info("AskUserQuestion received", "requestId", req.RequestID)
			return []agent.AgentEvent{agent.AskUserQuestionEvent{
				RequestID: req.RequestID,
				ToolUseID: req.Request.ToolUseID,
				Questions: input.Questions,
			}}
		}
		log.Info("tool permission request", "tool", req.Request.ToolName, "requestId", req.RequestID)
		return []agent.AgentEvent{agent.PermissionRequestEvent{
			RequestID:             req.RequestID,
			ToolName:              req.Request.ToolName,
			ToolInput:             req.Request.Input,
			ToolUseID:             req.Request.ToolUseID,
			PermissionSuggestions: req.Request.PermissionSuggestions,
		}}
	default:
		return nil
	}
}

type cliControlResponse struct {
	Type     string `json:"type"`
	Response struct {
		Subtype   string `json:"subtype"`
		RequestID string `json:"request_id"`
	} `json:"response"`
}

func parseControlResponse(log *slog.Logger, line []byte) []agent.AgentEvent {
	var resp cliControlResponse
	if err := json.Unmarshal(line, &resp); err != nil {
		log.Warn("failed to parse control response from CLI", "error", err)
		return nil
	}
	return nil
}

type controlCancelRequest struct {
	Type      string `json:"type"`
	RequestID string `json:"request_id"`
}

func parseControlCancelRequest(log *slog.Logger, line []byte) []agent.AgentEvent {
	var req controlCancelRequest
	if err := json.Unmarshal(line, &req); err != nil {
		log.Warn("failed to parse control cancel request from CLI", "error", err)
		return nil
	}
	log.Debug("control cancel request received", "requestId", req.RequestID)
	return []agent.AgentEvent{agent.RequestCancelledEvent{RequestID: req.RequestID}}
}

func parseAssistantEvent(log *slog.Logger, event cliEvent) []agent.AgentEvent {
	if event.Message == nil {
		return nil
	}
	var msg cliMessage
	if err := json.Unmarshal(event.Message, &msg); err != nil {
		log.Warn("failed to parse assistant message from CLI", "error", err)
		return []agent.AgentEvent{agent.TextEvent{Content: string(event.Message)}}
	}
	var events []agent.AgentEvent
	var textParts []string
	for _, block := range msg.Content {
		switch block.Type {
		case "text":
			if block.Text != "" {
				textParts = append(textParts, block.Text)
			}
		case "tool_use", "server_tool_use":
			if len(textParts) > 0 {
				events = append(events, agent.TextEvent{Content: strings.Join(textParts, "")})
				textParts = nil
			}
			events = append(events, agent.ToolCallEvent{
				ToolUseID: block.ID,
				ToolName:  block.Name,
				ToolInput: block.Input,
			})
		}
	}
	if len(textParts) > 0 {
		events = append(events, agent.TextEvent{Content: strings.Join(textParts, "")})
	}
	return events
}

func parseUserEvent(log *slog.Logger, event cliEvent) []agent.AgentEvent {
	if event.Message == nil {
		return nil
	}
	var msg cliMessage
	if err := json.Unmarshal(event.Message, &msg); err != nil {
		var msgStr cliMessageString
		if err := json.Unmarshal(event.Message, &msgStr); err != nil {
			return []agent.AgentEvent{agent.TextEvent{Content: string(event.Message)}}
		}
		return extractEventsFromText(log, msgStr.Content)
	}
	var events []agent.AgentEvent
	for _, block := range msg.Content {
		switch block.Type {
		case "tool_result":
			if hasImageContent(block.Content) {
				events = append(events, agent.WarningEvent{
					Message: "Image content is not supported yet",
					Code:    "image_not_supported",
				})
				continue
			}
			var content string
			if err := json.Unmarshal(block.Content, &content); err != nil {
				content = string(block.Content)
			}
			events = append(events, agent.ToolResultEvent{
				ToolUseID:  block.ToolUseID,
				ToolResult: content,
			})
		}
	}
	return events
}

func extractEventsFromText(log *slog.Logger, text string) []agent.AgentEvent {
	tags := []struct{ open, close string }{
		{"<local-command-stdout>", "</local-command-stdout>"},
		{"<local-command-stderr>", "</local-command-stderr>"},
	}
	var events []agent.AgentEvent
	remaining := text
	for len(remaining) > 0 {
		bestIdx := -1
		var bestTag struct{ open, close string }
		for _, tag := range tags {
			idx := strings.Index(remaining, tag.open)
			if idx != -1 && (bestIdx == -1 || idx < bestIdx) {
				bestIdx = idx
				bestTag = tag
			}
		}
		if bestIdx == -1 {
			break
		}
		endIdx := strings.Index(remaining[bestIdx:], bestTag.close)
		if endIdx == -1 {
			break
		}
		endIdx += bestIdx
		contentStart := bestIdx + len(bestTag.open)
		content := strings.TrimSpace(remaining[contentStart:endIdx])
		if content != "" {
			events = append(events, agent.CommandOutputEvent{Content: content})
		}
		remaining = remaining[endIdx+len(bestTag.close):]
	}
	return events
}

func hasImageContent(content json.RawMessage) bool {
	if len(content) == 0 || content[0] != '[' {
		return false
	}
	var items []struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(content, &items); err != nil {
		return false
	}
	for _, item := range items {
		if item.Type == "image" {
			return true
		}
	}
	return false
}

type resultEvent struct {
	Subtype   string   `json:"subtype"`
	SessionID string   `json:"session_id"`
	Errors    []string `json:"errors"`
}

func parseResultEvent(line []byte) agent.AgentEvent {
	var result resultEvent
	if err := json.Unmarshal(line, &result); err != nil {
		return agent.DoneEvent{}
	}
	if result.Subtype == "error_during_execution" {
		for _, e := range result.Errors {
			if strings.Contains(e, "Request was aborted") {
				return agent.InterruptedEvent{}
			}
		}
	}
	return agent.DoneEvent{}
}
