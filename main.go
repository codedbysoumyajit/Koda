package main

import (
	"embed"

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
		Frameless:         false,
		StartHidden:       false,
		HideWindowOnClose: false,
		BackgroundColour:  &options.RGBA{R: 30, G: 30, B: 30, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:        app.startup,
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
			TitleBar:             mac.TitleBarDefault(),
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
