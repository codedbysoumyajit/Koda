package gitsvc

type GitFile struct {
	Path    string `json:"path"`
	Status  string `json:"status"` // "M", "A", "D", "R", "U", "??"
	Staged  bool   `json:"staged"`
	OldPath string `json:"oldPath,omitempty"`
}

type GitStatusResult struct {
	IsRepo         bool      `json:"isRepo"`
	Branch         string    `json:"branch"`
	Ahead          int       `json:"ahead"`
	Behind         int       `json:"behind"`
	StagedFiles    []GitFile `json:"stagedFiles"`
	UnstagedFiles  []GitFile `json:"unstagedFiles"`
	UntrackedFiles []GitFile `json:"untrackedFiles"`
}

type GitDiffResult struct {
	FilePath   string `json:"filePath"`
	OldContent string `json:"oldContent"`
	NewContent string `json:"newContent"`
	RawDiff    string `json:"rawDiff"`
}

type GitBranchInfo struct {
	Name      string `json:"name"`
	IsCurrent bool   `json:"isCurrent"`
	IsRemote  bool   `json:"isRemote"`
}
