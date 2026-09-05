package main

import (
	"embed"
	"encoding/json"
	"os"
	"path/filepath"

	"astrocode/internal/editorsvc"
	"astrocode/internal/gitsvc"
	"astrocode/internal/searchsvc"
	"astrocode/internal/settingssvc"
	"astrocode/internal/termsvc"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

func init() {
	// If the user explicitly set GDK_BACKEND in their shell environment, honor it
	if os.Getenv("GDK_BACKEND") != "" {
		return
	}

	// Read user settings preference from ~/.astrocode/settings.json
	home, err := os.UserHomeDir()
	if err == nil {
		settingsFile := filepath.Join(home, ".astrocode", "settings.json")
		if data, err := os.ReadFile(settingsFile); err == nil {
			var cfg struct {
				GdkBackend string `json:"gdkBackend"`
			}
			if err := json.Unmarshal(data, &cfg); err == nil && cfg.GdkBackend != "" {
				_ = os.Setenv("GDK_BACKEND", cfg.GdkBackend)
				return
			}
		}
	}

	// Default fallback to x11 for clean out-of-the-box frameless behavior on Linux Wayland compositors
	_ = os.Setenv("GDK_BACKEND", "x11")
}

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Initialize backend services
	editorSvc := editorsvc.NewEditorService()
	termSvc := termsvc.NewTerminalService()
	gitSvc := gitsvc.NewGitService()
	searchSvc := searchsvc.NewSearchService()
	settingsSvc := settingssvc.NewSettingsService()

	// Create application instance
	app := NewApp(editorSvc, termSvc, gitSvc, searchSvc, settingsSvc)

	// Create application with options
	err := wails.Run(&options.App{
		Title:             "AstroCode",
		Width:             1280,
		Height:            820,
		MinWidth:          800,
		MinHeight:         600,
		Frameless:         true,
		CSSDragProperty:   "--wails-draggable",
		CSSDragValue:      "drag",
		StartHidden:       false,
		HideWindowOnClose: false,
		BackgroundColour:  &options.RGBA{R: 24, G: 24, B: 24, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
			editorSvc,
			termSvc,
			gitSvc,
			searchSvc,
			settingsSvc,
		},
		Linux: &linux.Options{
			ProgramName: "astrocode",
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			BackdropType:         windows.Auto,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHidden(),
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
