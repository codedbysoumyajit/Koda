package main

import (
	"context"
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
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func detectBackend() (string, bool) {
	// 1. If user explicitly set GDK_BACKEND in their shell environment, honor it
	envBackend := os.Getenv("GDK_BACKEND")

	// 2. Read user settings preference from ~/.astrocode/settings.json
	prefBackend := ""
	home, err := os.UserHomeDir()
	if err == nil {
		settingsFile := filepath.Join(home, ".astrocode", "settings.json")
		if data, err := os.ReadFile(settingsFile); err == nil {
			var cfg struct {
				GdkBackend string `json:"gdkBackend"`
			}
			if err := json.Unmarshal(data, &cfg); err == nil {
				prefBackend = cfg.GdkBackend
			}
		}
	}

	target := envBackend
	if target == "" {
		target = prefBackend
	}

	hasWaylandDisplay := os.Getenv("WAYLAND_DISPLAY") != "" || os.Getenv("XDG_SESSION_TYPE") == "wayland"

	if target == "wayland" && hasWaylandDisplay {
		_ = os.Setenv("GDK_BACKEND", "wayland")
		return "wayland", true
	} else if target == "x11" {
		_ = os.Setenv("GDK_BACKEND", "x11")
		return "x11", false
	} else if (target == "auto" || target == "") && hasWaylandDisplay {
		_ = os.Setenv("GDK_BACKEND", "wayland")
		return "wayland", true
	}

	_ = os.Setenv("GDK_BACKEND", "x11")
	return "x11", false
}

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	_, isWayland := detectBackend()

	// Initialize backend services
	editorSvc := editorsvc.NewEditorService()
	termSvc := termsvc.NewTerminalService()
	gitSvc := gitsvc.NewGitService()
	searchSvc := searchsvc.NewSearchService()
	settingsSvc := settingssvc.NewSettingsService()

	editorSvc.SetWayland(isWayland)
	settingsSvc.SetWayland(isWayland)

	winConfig := WindowConfig{
		IsWayland:        isWayland,
		IsNativeTitlebar: isWayland,
	}

	// Create application instance
	app := NewApp(editorSvc, termSvc, gitSvc, searchSvc, settingsSvc, winConfig)

	// Create application with options
	// When using Wayland, Frameless is false so the window relies on the Wayland compositor's native window bar
	// When using X11/XWayland, Frameless is true so AstroCode uses its custom title bar
	err := wails.Run(&options.App{
		Title:             "AstroCode",
		Width:             1280,
		Height:            820,
		MinWidth:          800,
		MinHeight:         600,
		Frameless:         !isWayland,
		CSSDragProperty:   "--wails-draggable",
		CSSDragValue:      "drag",
		StartHidden:       false,
		HideWindowOnClose: false,
		BackgroundColour:  &options.RGBA{R: 24, G: 24, B: 24, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		OnDomReady: func(ctx context.Context) {
			wailsRuntime.EventsEmit(ctx, "window-config", winConfig)
		},
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
