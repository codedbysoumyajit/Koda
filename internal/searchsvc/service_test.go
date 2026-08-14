package searchsvc

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSearchService(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "astrocode_test_search")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	file1 := filepath.Join(tempDir, "hello.txt")
	file2 := filepath.Join(tempDir, "world.go")
	_ = os.WriteFile(file1, []byte("Hello AstroCode World\nWelcome to fast Go editor"), 0644)
	_ = os.WriteFile(file2, []byte("package main\n\nconst AppName = \"AstroCode\"\n"), 0644)

	svc := NewSearchService()

	// Normal search
	res, err := svc.Search(tempDir, SearchOptions{
		Query:           "AstroCode",
		IsCaseSensitive: true,
	})
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if res.TotalMatches != 2 || res.TotalFiles != 2 {
		t.Errorf("expected 2 matches in 2 files, got %d matches in %d files", res.TotalMatches, res.TotalFiles)
	}

	// Regex search
	resRegex, err := svc.Search(tempDir, SearchOptions{
		Query:   "Astro[A-Za-z]+",
		IsRegex: true,
	})
	if err != nil {
		t.Fatalf("regex search failed: %v", err)
	}
	if resRegex.TotalMatches != 2 {
		t.Errorf("expected 2 regex matches, got %d", resRegex.TotalMatches)
	}

	// Replace in file
	err = svc.ReplaceInFile(tempDir, "hello.txt", "fast Go editor", "blazing fast Go editor", false, true, false)
	if err != nil {
		t.Fatalf("replace in file failed: %v", err)
	}

	data, _ := os.ReadFile(file1)
	if string(data) != "Hello AstroCode World\nWelcome to blazing fast Go editor" {
		t.Errorf("unexpected content after replace: %s", string(data))
	}
}
