//go:build windows
// +build windows

package termsvc

import (
	"io"
	"os/exec"
)

type ptySession struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
}

func startPty(cwd string) (*ptySession, string, error) {
	cmd := exec.Command("powershell.exe")
	if cwd != "" {
		cmd.Dir = cwd
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, "", err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, "", err
	}
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		return nil, "", err
	}

	return &ptySession{
		cmd:    cmd,
		stdin:  stdin,
		stdout: stdout,
	}, "powershell", nil
}

func (s *ptySession) Read(p []byte) (int, error) {
	return s.stdout.Read(p)
}

func (s *ptySession) Write(p []byte) (int, error) {
	return s.stdin.Write(p)
}

func (s *ptySession) Resize(cols, rows int) error {
	return nil
}

func (s *ptySession) Close() error {
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
	if s.stdin != nil {
		_ = s.stdin.Close()
	}
	if s.stdout != nil {
		_ = s.stdout.Close()
	}
	return nil
}
