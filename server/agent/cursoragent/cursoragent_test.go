package cursoragent

import (
	"context"
	"os/exec"
	"sync"
	"testing"
	"time"

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

func TestStart_creates_chat_and_sends_with_resume(t *testing.T) {
	original := execCommandContext
	t.Cleanup(func() { execCommandContext = original })

	var (
		mu     sync.Mutex
		calls  [][]string
		chatID = "chat-123"
	)

	execCommandContext = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		mu.Lock()
		calls = append(calls, append([]string{name}, args...))
		mu.Unlock()

		if len(args) > 0 && args[0] == "create-chat" {
			return exec.CommandContext(ctx, "/bin/sh", "-c", "printf '"+chatID+"'")
		}

		output := `printf '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n{"type":"result","subtype":"success"}\n'`
		return exec.CommandContext(ctx, "/bin/sh", "-c", output)
	}

	a := New()
	sess, err := a.Start(context.Background(), agent.StartOptions{
		WorkDir: t.TempDir(),
		Mode:    session.ModeDefault,
	})
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}
	defer sess.Close()

	if err := sess.SendMessage("hello"); err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}

	waitForEventType(t, sess.Events(), agent.EventTypeDone, 2*time.Second)

	mu.Lock()
	defer mu.Unlock()
	if !callsContainArgs(calls, "--resume", chatID) {
		t.Fatalf("expected --resume %s in exec args, got: %v", chatID, calls)
	}
}

func TestSendMessage_rejects_concurrent_requests(t *testing.T) {
	original := execCommandContext
	t.Cleanup(func() { execCommandContext = original })

	execCommandContext = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		if len(args) > 0 && args[0] == "create-chat" {
			return exec.CommandContext(ctx, "/bin/sh", "-c", "printf 'chat-1'")
		}

		output := `sleep 0.2; printf '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n{"type":"result","subtype":"success"}\n'`
		return exec.CommandContext(ctx, "/bin/sh", "-c", output)
	}

	a := New()
	sess, err := a.Start(context.Background(), agent.StartOptions{
		WorkDir: t.TempDir(),
		Mode:    session.ModeDefault,
	})
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}
	defer sess.Close()

	if err := sess.SendMessage("first"); err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}
	if err := sess.SendMessage("second"); err == nil {
		t.Fatalf("expected concurrent SendMessage to fail")
	}

	waitForEventType(t, sess.Events(), agent.EventTypeDone, 2*time.Second)
}

func TestSendMessage_adds_force_in_yolo_mode(t *testing.T) {
	original := execCommandContext
	t.Cleanup(func() { execCommandContext = original })

	var (
		mu    sync.Mutex
		calls [][]string
	)

	execCommandContext = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		mu.Lock()
		calls = append(calls, append([]string{name}, args...))
		mu.Unlock()

		if len(args) > 0 && args[0] == "create-chat" {
			return exec.CommandContext(ctx, "/bin/sh", "-c", "printf 'chat-2'")
		}

		output := `printf '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n{"type":"result","subtype":"success"}\n'`
		return exec.CommandContext(ctx, "/bin/sh", "-c", output)
	}

	a := New()
	sess, err := a.Start(context.Background(), agent.StartOptions{
		WorkDir: t.TempDir(),
		Mode:    session.ModeYolo,
	})
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}
	defer sess.Close()

	if err := sess.SendMessage("hi"); err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}

	waitForEventType(t, sess.Events(), agent.EventTypeDone, 2*time.Second)

	mu.Lock()
	defer mu.Unlock()
	if !callsContainArgs(calls, "--force") {
		t.Fatalf("expected --force in exec args, got: %v", calls)
	}
}

func waitForEventType(t *testing.T, ch <-chan agent.AgentEvent, eventType agent.EventType, timeout time.Duration) {
	t.Helper()

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case <-timer.C:
			t.Fatalf("timed out waiting for event %s", eventType)
		case evt, ok := <-ch:
			if !ok {
				t.Fatalf("events channel closed before %s", eventType)
			}
			if evt.EventType() == eventType {
				return
			}
		}
	}
}

func callsContainArgs(calls [][]string, seq ...string) bool {
	for _, call := range calls {
		if containsSequence(call, seq) {
			return true
		}
	}
	return false
}

func containsSequence(args []string, seq []string) bool {
	if len(seq) == 0 || len(args) < len(seq) {
		return false
	}
	for i := 0; i+len(seq) <= len(args); i++ {
		match := true
		for j := range seq {
			if args[i+j] != seq[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
