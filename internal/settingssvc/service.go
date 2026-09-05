package settingssvc

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type SettingsService struct {
	ctx         context.Context
	configDir   string
	settings    EditorSettings
	mu          sync.RWMutex
}

func NewSettingsService() *SettingsService {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	configDir := filepath.Join(home, ".astrocode")
	_ = os.MkdirAll(configDir, 0755)

	svc := &SettingsService{
		configDir: configDir,
		settings:  defaultSettings(),
	}
	svc.load()
	return svc
}

func defaultSettings() EditorSettings {
	return EditorSettings{
		Theme:               "vs-dark",
		FontSize:            14,
		FontFamily:          "'Fira Code', 'Cascadia Code', 'Consolas', 'Courier New', monospace",
		TabSize:             4,
		WordWrap:            "on",
		Minimap:             true,
		LineNumbers:         "on",
		TerminalFontSize:    14,
		TerminalFontFamily:  "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
		TerminalCursorBlink: true,
		FormatOnSave:        false,
		AutoSave:            "off",
		GdkBackend:          "x11",
	}
}

func (s *SettingsService) Startup(ctx context.Context) {
	s.ctx = ctx
}

func (s *SettingsService) settingsFilePath() string {
	return filepath.Join(s.configDir, "settings.json")
}

func (s *SettingsService) keybindingsFilePath() string {
	return filepath.Join(s.configDir, "keybindings.json")
}

func (s *SettingsService) recentFilePath() string {
	return filepath.Join(s.configDir, "recent.json")
}

func (s *SettingsService) load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.settingsFilePath())
	if err == nil {
		_ = json.Unmarshal(data, &s.settings)
	} else {
		s.saveCurrentSettings()
	}

	if _, err := os.Stat(s.keybindingsFilePath()); os.IsNotExist(err) {
		defaultBindings := []Keybinding{
			{Key: "Ctrl+P", Command: "workbench.action.quickOpen"},
			{Key: "Ctrl+Shift+P", Command: "workbench.action.showCommands"},
			{Key: "Ctrl+S", Command: "workbench.action.files.save"},
			{Key: "Ctrl+Shift+S", Command: "workbench.action.files.saveAll"},
			{Key: "Ctrl+W", Command: "workbench.action.closeActiveEditor"},
			{Key: "Ctrl+`", Command: "workbench.action.terminal.toggleTerminal"},
			{Key: "Ctrl+B", Command: "workbench.action.toggleSidebar"},
			{Key: "Ctrl+Shift+F", Command: "workbench.action.findInFiles"},
			{Key: "Ctrl+Shift+G", Command: "workbench.view.scm"},
			{Key: "Ctrl+Shift+E", Command: "workbench.view.explorer"},
			{Key: "Ctrl+,", Command: "workbench.action.openSettings"},
		}
		bData, _ := json.MarshalIndent(defaultBindings, "", "  ")
		_ = os.WriteFile(s.keybindingsFilePath(), bData, 0644)
	}
}

func (s *SettingsService) saveCurrentSettings() {
	data, err := json.MarshalIndent(s.settings, "", "  ")
	if err == nil {
		_ = os.WriteFile(s.settingsFilePath(), data, 0644)
	}
}

func (s *SettingsService) GetSettings() EditorSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings
}

func (s *SettingsService) SaveSettings(settings EditorSettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings = settings
	s.saveCurrentSettings()
	return nil
}

func (s *SettingsService) GetSettingsJSON() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, err := os.ReadFile(s.settingsFilePath())
	if err != nil {
		return "{}", err
	}
	return string(data), nil
}

func (s *SettingsService) SaveSettingsJSON(content string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var st EditorSettings
	if err := json.Unmarshal([]byte(content), &st); err != nil {
		return err
	}
	s.settings = st
	return os.WriteFile(s.settingsFilePath(), []byte(content), 0644)
}

func (s *SettingsService) GetKeybindings() ([]Keybinding, error) {
	data, err := os.ReadFile(s.keybindingsFilePath())
	if err != nil {
		return []Keybinding{}, err
	}
	var list []Keybinding
	if err := json.Unmarshal(data, &list); err != nil {
		return []Keybinding{}, err
	}
	return list, nil
}

func (s *SettingsService) SaveKeybindings(list []Keybinding) error {
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.keybindingsFilePath(), data, 0644)
}

func (s *SettingsService) GetRecentWorkspaces() []string {
	data, err := os.ReadFile(s.recentFilePath())
	if err != nil {
		return []string{}
	}
	var hist WorkspaceHistory
	_ = json.Unmarshal(data, &hist)
	return hist.RecentPaths
}

func (s *SettingsService) AddRecentWorkspace(path string) {
	recents := s.GetRecentWorkspaces()
	newRecents := []string{path}
	for _, r := range recents {
		if r != path {
			newRecents = append(newRecents, r)
		}
		if len(newRecents) >= 10 {
			break
		}
	}
	data, _ := json.MarshalIndent(WorkspaceHistory{RecentPaths: newRecents}, "", "  ")
	_ = os.WriteFile(s.recentFilePath(), data, 0644)
}
