package termsvc

import (
	"os"
	"testing"
	"time"
)

func TestTerminalService(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "astrocode_test_term")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	svc := NewTerminalService()

	session, err := svc.CreateTerminal(tempDir)
	if err != nil {
		t.Fatalf("failed to create terminal session: %v", err)
	}
	if session.ID == "" {
		t.Errorf("expected non-empty session ID")
	}

	// Test write
	err = svc.WriteTerminal(session.ID, "echo 'hello terminal'\n")
	if err != nil {
		t.Errorf("failed to write to terminal: %v", err)
	}

	// Test resize
	err = svc.ResizeTerminal(session.ID, 80, 24)
	if err != nil {
		t.Errorf("failed to resize terminal: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	// Test close
	err = svc.CloseTerminal(session.ID)
	if err != nil {
		t.Errorf("failed to close terminal: %v", err)
	}
}
