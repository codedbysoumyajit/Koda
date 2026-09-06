package settingssvc

type EditorSettings struct {
	Theme             string `json:"theme"`
	FontSize          int    `json:"fontSize"`
	FontFamily        string `json:"fontFamily"`
	TabSize           int    `json:"tabSize"`
	WordWrap          string `json:"wordWrap"`
	Minimap           bool   `json:"minimap"`
	LineNumbers       string `json:"lineNumbers"`
	TerminalFontSize  int    `json:"terminalFontSize"`
	TerminalFontFamily string `json:"terminalFontFamily"`
	TerminalCursorBlink bool `json:"terminalCursorBlink"`
	FormatOnSave      bool   `json:"formatOnSave"`
	AutoSave          string `json:"autoSave"` // "off", "afterDelay", "onFocusChange"
	GdkBackend        string `json:"gdkBackend"` // "auto", "wayland", "x11"
	IsWayland         bool   `json:"isWayland"`
	IsNativeTitlebar  bool   `json:"isNativeTitlebar"`
}

type WindowConfig struct {
	IsWayland        bool `json:"isWayland"`
	IsNativeTitlebar bool `json:"isNativeTitlebar"`
}

type Keybinding struct {
	Key     string `json:"key"`
	Command string `json:"command"`
	When    string `json:"when,omitempty"`
}

type WorkspaceHistory struct {
	RecentPaths []string `json:"recentPaths"`
}
