//go:build !windows
// +build !windows

package termsvc

import (
	"os"
	"os/exec"

	"github.com/creack/pty"
)

type ptySession struct {
	ptmx *os.File
	cmd  *exec.Cmd
}

func startPty(cwd string) (*ptySession, error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
		if _, err := os.Stat(shell); err != nil {
			shell = "/bin/sh"
		}
	}

	cmd := exec.Command(shell)
	if cwd != "" {
		cmd.Dir = cwd
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", "COLORTERM=truecolor")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	return &ptySession{
		ptmx: ptmx,
		cmd:  cmd,
	}, nil
}

func (s *ptySession) Read(p []byte) (int, error) {
	return s.ptmx.Read(p)
}

func (s *ptySession) Write(p []byte) (int, error) {
	return s.ptmx.Write(p)
}

func (s *ptySession) Resize(cols, rows int) error {
	return pty.Setsize(s.ptmx, &pty.Winsize{
		Cols: uint16(cols),
		Rows: uint16(rows),
	})
}

func (s *ptySession) Close() error {
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
	if s.ptmx != nil {
		return s.ptmx.Close()
	}
	return nil
}
