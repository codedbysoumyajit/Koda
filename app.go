package main

import (
	"context"

	"astrocode/internal/editorsvc"
	"astrocode/internal/gitsvc"
	"astrocode/internal/searchsvc"
	"astrocode/internal/settingssvc"
	"astrocode/internal/termsvc"
)

// App struct
type App struct {
	ctx         context.Context
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
) *App {
	return &App{
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
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return "Welcome to AstroCode, " + name + "!"
}
