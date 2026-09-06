package main

import (
	"context"

	"astrocode/internal/editorsvc"
	"astrocode/internal/gitsvc"
	"astrocode/internal/searchsvc"
	"astrocode/internal/settingssvc"
	"astrocode/internal/termsvc"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// WindowConfig defines the window decoration and backend configuration
type WindowConfig struct {
	IsWayland        bool `json:"isWayland"`
	IsNativeTitlebar bool `json:"isNativeTitlebar"`
}

// App struct
type App struct {
	ctx         context.Context
	winConfig   WindowConfig
	EditorSvc   *editorsvc.EditorService
	TermSvc     *termsvc.TerminalService
	GitSvc      *gitsvc.GitService
	SearchSvc   *searchsvc.SearchService
	SettingsSvc *settingssvc.SettingsService
}

// NewApp creates a new App application struct
func NewApp(
	editorSvc *editorsvc.EditorService,
	termSvc *termsvc.TerminalService,
	gitSvc *gitsvc.GitService,
	searchSvc *searchsvc.SearchService,
	settingsSvc *settingssvc.SettingsService,
	winConfig WindowConfig,
) *App {
	return &App{
		winConfig:   winConfig,
		EditorSvc:   editorSvc,
		TermSvc:     termSvc,
		GitSvc:      gitSvc,
		SearchSvc:   searchSvc,
		SettingsSvc: settingsSvc,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.EditorSvc.Startup(ctx)
	a.TermSvc.Startup(ctx)
	a.GitSvc.Startup(ctx)
	a.SearchSvc.Startup(ctx)
	a.SettingsSvc.Startup(ctx)
	wailsRuntime.EventsEmit(ctx, "window-config", a.winConfig)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return "Welcome to AstroCode, " + name + "!"
}

// ToggleFullscreen toggles fullscreen state
func (a *App) ToggleFullscreen() bool {
	if a.ctx == nil {
		return false
	}
	if wailsRuntime.WindowIsFullscreen(a.ctx) {
		wailsRuntime.WindowUnfullscreen(a.ctx)
		return false
	}
	wailsRuntime.WindowFullscreen(a.ctx)
	return true
}

// ToggleMaximize toggles maximized state
func (a *App) ToggleMaximize() bool {
	if a.ctx == nil {
		return false
	}
	wailsRuntime.WindowToggleMaximise(a.ctx)
	return wailsRuntime.WindowIsMaximised(a.ctx)
}

// IsFullscreen returns whether the window is currently fullscreen
func (a *App) IsFullscreen() bool {
	if a.ctx == nil {
		return false
	}
	return wailsRuntime.WindowIsFullscreen(a.ctx)
}

// IsMaximised returns whether the window is currently maximized
func (a *App) IsMaximised() bool {
	if a.ctx == nil {
		return false
	}
	return wailsRuntime.WindowIsMaximised(a.ctx)
}

// Minimize minimizes the window
func (a *App) Minimize() {
	if a.ctx != nil {
		wailsRuntime.WindowMinimise(a.ctx)
	}
}

// Close closes the window / application
func (a *App) Close() {
	if a.ctx != nil {
		wailsRuntime.Quit(a.ctx)
	}
}

// GetWindowConfig returns current window configuration (Wayland vs X11, native titlebar)
func (a *App) GetWindowConfig() WindowConfig {
	return a.winConfig
}

// SetWindowTitle updates the native window title
func (a *App) SetWindowTitle(title string) {
	if a.ctx != nil {
		wailsRuntime.WindowSetTitle(a.ctx, title)
	}
}
