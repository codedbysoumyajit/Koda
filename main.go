package main

import (
	"embed"
	"os"

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
	// On Linux Wayland sessions (e.g. KDE Plasma, GNOME), GTK3 does not negotiate frameless
	// client-side decorations properly with KWin/Wayland, causing a duplicate native titlebar
	// to appear above the custom titlebar. Setting GDK_BACKEND=x11 routes through XWayland,
	// allowing frameless mode, window dragging, and controls to work seamlessly.
	if os.Getenv("GDK_BACKEND") == "" {
		_ = os.Setenv("GDK_BACKEND", "x11")
	}
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
