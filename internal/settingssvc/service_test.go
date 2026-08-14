package settingssvc

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSettingsService(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "astrocode_test_settings")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	svc := &SettingsService{
		configDir: tempDir,
		settings:  defaultSettings(),
	}
	svc.load()

	settings := svc.GetSettings()
	if settings.Theme != "vs-dark" {
		t.Errorf("expected default theme vs-dark, got %s", settings.Theme)
	}

	settings.FontSize = 16
	settings.Theme = "vs-light"
	if err := svc.SaveSettings(settings); err != nil {
		t.Fatalf("failed to save settings: %v", err)
	}

	svc2 := &SettingsService{
		configDir: tempDir,
		settings:  defaultSettings(),
	}
	svc2.load()
	if svc2.GetSettings().FontSize != 16 {
		t.Errorf("expected font size 16 after reloading, got %d", svc2.GetSettings().FontSize)
	}

	// Test keybindings
	kb, err := svc.GetKeybindings()
	if err != nil || len(kb) == 0 {
		t.Errorf("expected default keybindings, got %v (err: %v)", kb, err)
	}

	// Test recent workspaces
	svc.AddRecentWorkspace(filepath.Join(tempDir, "proj1"))
	svc.AddRecentWorkspace(filepath.Join(tempDir, "proj2"))
	recents := svc.GetRecentWorkspaces()
	if len(recents) != 2 || recents[0] != filepath.Join(tempDir, "proj2") {
		t.Errorf("expected proj2 first in recent workspaces, got %v", recents)
	}
}
