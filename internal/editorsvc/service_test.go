package editorsvc

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEditorService(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "astrocode_test_editor")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	svc := NewEditorService()
	svc.SetWorkspace(tempDir)

	if svc.GetCurrentWorkspace() != tempDir {
		t.Errorf("expected workspace %s, got %s", tempDir, svc.GetCurrentWorkspace())
	}

	// Create file & folder
	subFolder := filepath.Join(tempDir, "src")
	if err := svc.CreateFolder(subFolder); err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}

	testFile := filepath.Join(subFolder, "main.go")
	if err := svc.CreateFile(testFile); err != nil {
		t.Fatalf("failed to create file: %v", err)
	}

	// Save content
	content := "package main\n\nfunc main() {}\n"
	if err := svc.SaveFile(testFile, content); err != nil {
		t.Fatalf("failed to save file: %v", err)
	}

	// Read content
	readRes, err := svc.ReadFile(testFile)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}
	if readRes.Content != content {
		t.Errorf("expected file content %q, got %q", content, readRes.Content)
	}

	// Test directory tree
	tree, err := svc.GetDirectoryTree(tempDir)
	if err != nil {
		t.Fatalf("failed to get directory tree: %v", err)
	}
	if len(tree.Children) == 0 || tree.Children[0].Name != "src" {
		t.Errorf("expected src child in tree, got %+v", tree.Children)
	}

	// Rename file
	renamedFile := filepath.Join(subFolder, "app.go")
	if err := svc.RenamePath(testFile, renamedFile); err != nil {
		t.Fatalf("failed to rename file: %v", err)
	}

	// Delete file
	if err := svc.DeletePath(renamedFile); err != nil {
		t.Fatalf("failed to delete file: %v", err)
	}
}
