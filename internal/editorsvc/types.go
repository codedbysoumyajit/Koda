package editorsvc

type FileNode struct {
	Name      string      `json:"name"`
	Path      string      `json:"path"`
	IsDir     bool        `json:"isDir"`
	Children  []*FileNode `json:"children,omitempty"`
	Size      int64       `json:"size"`
	ModTime   int64       `json:"modTime"`
	GitStatus string      `json:"gitStatus,omitempty"` // "M", "A", "U", "D", ""
}

type FileContent struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
	Size     int64  `json:"size"`
}

type WorkspaceInfo struct {
	Path string `json:"path"`
	Name string `json:"name"`
}
