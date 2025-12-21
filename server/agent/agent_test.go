package agent

import "testing"

func TestSession_SendMessage_NilFunc(t *testing.T) {
	session := &Session{}

	err := session.SendMessage("test")

	if err != ErrSessionClosed {
		t.Errorf("expected ErrSessionClosed, got %v", err)
	}
}

func TestSession_SendPermissionResponse_NilFunc(t *testing.T) {
	session := &Session{}

	err := session.SendPermissionResponse(PermissionResponse{
		RequestID: "req-123",
		Allow:     true,
	})

	if err != ErrSessionClosed {
		t.Errorf("expected ErrSessionClosed, got %v", err)
	}
}

func TestSession_Close_NilFunc(t *testing.T) {
	session := &Session{}

	// Should not panic
	session.Close()
}

func TestNewSession(t *testing.T) {
	events := make(chan AgentEvent)
	sendMessageCalled := false
	sendPermissionCalled := false
	closeCalled := false

	session := NewSession(
		events,
		func(prompt string) error {
			sendMessageCalled = true
			return nil
		},
		func(resp PermissionResponse) error {
			sendPermissionCalled = true
			return nil
		},
		func() {
			closeCalled = true
		},
	)

	if session.Events != events {
		t.Error("Events channel not set correctly")
	}

	if err := session.SendMessage("test"); err != nil {
		t.Errorf("SendMessage failed: %v", err)
	}
	if !sendMessageCalled {
		t.Error("sendMessage function not called")
	}

	if err := session.SendPermissionResponse(PermissionResponse{}); err != nil {
		t.Errorf("SendPermissionResponse failed: %v", err)
	}
	if !sendPermissionCalled {
		t.Error("sendPermission function not called")
	}

	session.Close()
	if !closeCalled {
		t.Error("close function not called")
	}
}
