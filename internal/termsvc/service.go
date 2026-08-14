package termsvc

import (
	"context"
	"fmt"
	"io"
	"sync"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type TerminalSessionInfo struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Cwd   string `json:"cwd"`
}

type TerminalService struct {
	ctx      context.Context
	sessions map[string]*ptySession
	mu       sync.RWMutex
}

func NewTerminalService() *TerminalService {
	return &TerminalService{
		sessions: make(map[string]*ptySession),
	}
}

func (s *TerminalService) Startup(ctx context.Context) {
	s.ctx = ctx
}

func (s *TerminalService) CreateTerminal(cwd string) (TerminalSessionInfo, error) {
	id := uuid.New().String()
	sess, err := startPty(cwd)
	if err != nil {
		return TerminalSessionInfo{}, fmt.Errorf("failed to start pty: %w", err)
	}

	s.mu.Lock()
	s.sessions[id] = sess
	s.mu.Unlock()

	// Read output in goroutine and stream over Wails events
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := sess.Read(buf)
			if n > 0 {
				if s.ctx != nil {
					wailsRuntime.EventsEmit(s.ctx, "terminal:data:"+id, string(buf[:n]))
				}
			}
			if err != nil {
				if err != io.EOF {
					// log or handle error
				}
				if s.ctx != nil {
					wailsRuntime.EventsEmit(s.ctx, "terminal:exit:"+id, 0)
				}
				break
			}
		}
		s.CloseTerminal(id)
	}()

	return TerminalSessionInfo{
		ID:    id,
		Title: "bash",
		Cwd:   cwd,
	}, nil
}

func (s *TerminalService) WriteTerminal(id string, data string) error {
	s.mu.RLock()
	sess, exists := s.sessions[id]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("session %s not found", id)
	}

	_, err := sess.Write([]byte(data))
	return err
}

func (s *TerminalService) ResizeTerminal(id string, cols, rows int) error {
	s.mu.RLock()
	sess, exists := s.sessions[id]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("session %s not found", id)
	}

	return sess.Resize(cols, rows)
}

func (s *TerminalService) CloseTerminal(id string) error {
	s.mu.Lock()
	sess, exists := s.sessions[id]
	if exists {
		delete(s.sessions, id)
	}
	s.mu.Unlock()

	if exists {
		return sess.Close()
	}
	return nil
}
