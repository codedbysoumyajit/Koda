package gitsvc

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestGitService(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "astrocode_test_git")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	svc := NewGitService()

	if svc.IsGitRepo(tempDir) {
		t.Errorf("temp directory should not be a git repo yet")
	}

	// Initialize git repo
	cmd := exec.Command("git", "init")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("git init failed: %v", err)
	}

	// Configure local user
	c1 := exec.Command("git", "config", "user.name", "TestUser")
	c1.Dir = tempDir
	_ = c1.Run()
	c2 := exec.Command("git", "config", "user.email", "test@astrocode.local")
	c2.Dir = tempDir
	_ = c2.Run()

	if !svc.IsGitRepo(tempDir) {
		t.Errorf("expected tempDir to be a git repo")
	}

	// Create a file
	testFile := filepath.Join(tempDir, "test.txt")
	_ = os.WriteFile(testFile, []byte("line1\n"), 0644)

	status, err := svc.GetStatus(tempDir)
	if err != nil {
		t.Fatalf("failed to get status: %v", err)
	}
	if len(status.UntrackedFiles) != 1 || status.UntrackedFiles[0].Path != "test.txt" {
		t.Errorf("expected 1 untracked file test.txt, got %+v", status.UntrackedFiles)
	}

	// Stage file
	if err := svc.StageFile(tempDir, "test.txt"); err != nil {
		t.Fatalf("failed to stage file: %v", err)
	}

	status, _ = svc.GetStatus(tempDir)
	if len(status.StagedFiles) != 1 || status.StagedFiles[0].Path != "test.txt" {
		t.Errorf("expected 1 staged file test.txt, got %+v", status.StagedFiles)
	}

	// Commit file
	_, err = svc.Commit(tempDir, "Initial commit")
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Modify file
	_ = os.WriteFile(testFile, []byte("line1\nline2\n"), 0644)
	diff, err := svc.GetDiff(tempDir, "test.txt", false)
	if err != nil {
		t.Fatalf("failed to get diff: %v", err)
	}
	if diff.OldContent != "line1\n" || diff.NewContent != "line1\nline2\n" {
		t.Errorf("unexpected diff content: old=%q new=%q", diff.OldContent, diff.NewContent)
	}
}
