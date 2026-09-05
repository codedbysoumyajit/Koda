package editorsvc

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type EditorService struct {
	ctx          context.Context
	currentPath  string
	watcher      *fsnotify.Watcher
	watcherStop  chan struct{}
	mu           sync.RWMutex
	lastEmitTime time.Time
}

func NewEditorService() *EditorService {
	return &EditorService{
		watcherStop: make(chan struct{}),
	}
}

func (s *EditorService) Startup(ctx context.Context) {
	s.ctx = ctx
}

func (s *EditorService) OpenFolderDialog() (string, error) {
	var selected string
	var err error
	if s.ctx != nil {
		selected, err = wailsRuntime.OpenDirectoryDialog(s.ctx, wailsRuntime.OpenDialogOptions{
			Title: "Open Workspace Folder",
		})
	}
	// Fallback for Linux if selected is empty or error
	if (err != nil || selected == "") && runtime.GOOS == "linux" {
		if _, errZ := exec.LookPath("zenity"); errZ == nil {
			out, errCmd := exec.Command("zenity", "--file-selection", "--directory", "--title=Open Workspace Folder").Output()
			if errCmd == nil && len(out) > 0 {
				selected = strings.TrimSpace(string(out))
				err = nil
			}
		} else if _, errK := exec.LookPath("kdialog"); errK == nil {
			out, errCmd := exec.Command("kdialog", "--getexistingdirectory", ".").Output()
			if errCmd == nil && len(out) > 0 {
				selected = strings.TrimSpace(string(out))
				err = nil
			}
		}
	}
	if err != nil || selected == "" {
		return "", err
	}
	s.SetWorkspace(selected)
	return selected, nil
}

func (s *EditorService) SetWorkspace(path string) {
	s.mu.Lock()
	s.currentPath = path
	s.mu.Unlock()

	s.startWatching(path)
}

func (s *EditorService) SaveFileDialog(defaultName string) (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}
	return wailsRuntime.SaveFileDialog(s.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Save File",
		DefaultFilename: defaultName,
	})
}

func (s *EditorService) GetAllFiles(rootPath string) ([]string, error) {
	if rootPath == "" {
		s.mu.RLock()
		rootPath = s.currentPath
		s.mu.RUnlock()
	}
	if rootPath == "" {
		return []string{}, nil
	}

	var files []string
	maxFiles := 50000
	err := filepath.WalkDir(rootPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			name := d.Name()
			if name == ".git" || name == "node_modules" || name == "dist" || name == "build" || name == ".wails" {
				return filepath.SkipDir
			}
			return nil
		}
		rel, err := filepath.Rel(rootPath, path)
		if err == nil {
			files = append(files, rel)
			if len(files) >= maxFiles {
				return filepath.SkipAll
			}
		}
		return nil
	})
	return files, err
}

func (s *EditorService) GetCurrentWorkspace() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentPath
}

func (s *EditorService) GetDirectoryTree(rootPath string) (*FileNode, error) {
	if rootPath == "" {
		s.mu.RLock()
		rootPath = s.currentPath
		s.mu.RUnlock()
	}
	if rootPath == "" {
		return nil, fmt.Errorf("no workspace path set")
	}

	info, err := os.Stat(rootPath)
	if err != nil {
		return nil, err
	}

	rootNode := &FileNode{
		Name:    filepath.Base(rootPath),
		Path:    rootPath,
		IsDir:   info.IsDir(),
		ModTime: info.ModTime().Unix(),
	}

	if info.IsDir() {
		children, err := s.buildTree(rootPath, 0, 3) // depth limit for initial load
		if err == nil {
			rootNode.Children = children
		}
	}

	return rootNode, nil
}

func (s *EditorService) GetSubTree(dirPath string) ([]*FileNode, error) {
	return s.buildTree(dirPath, 0, 2)
}

func (s *EditorService) buildTree(dirPath string, currentDepth, maxDepth int) ([]*FileNode, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var nodes []*FileNode
	for _, entry := range entries {
		name := entry.Name()
		// skip .git directory internals to keep memory small and fast
		if name == ".git" {
			continue
		}

		fullPath := filepath.Join(dirPath, name)
		info, err := entry.Info()
		var size int64
		var modTime int64
		if err == nil {
			size = info.Size()
			modTime = info.ModTime().Unix()
		}

		node := &FileNode{
			Name:    name,
			Path:    fullPath,
			IsDir:   entry.IsDir(),
			Size:    size,
			ModTime: modTime,
		}

		if entry.IsDir() {
			if currentDepth < maxDepth && name != "node_modules" && name != "dist" && name != ".wails" {
				children, _ := s.buildTree(fullPath, currentDepth+1, maxDepth)
				node.Children = children
			} else {
				node.Children = []*FileNode{} // indicates expandable
			}
		}

		nodes = append(nodes, node)
	}

	// Sort directories first, then alphabetically
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].IsDir != nodes[j].IsDir {
			return nodes[i].IsDir
		}
		return strings.ToLower(nodes[i].Name) < strings.ToLower(nodes[j].Name)
	})

	return nodes, nil
}

func (s *EditorService) ReadFile(filePath string) (*FileContent, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	info, _ := os.Stat(filePath)
	var size int64
	if info != nil {
		size = info.Size()
	}

	return &FileContent{
		Path:     filePath,
		Name:     filepath.Base(filePath),
		Content:  string(data),
		Encoding: "utf-8",
		Size:     size,
	}, nil
}

func (s *EditorService) SaveFile(filePath string, content string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(filePath, []byte(content), 0644)
}

func (s *EditorService) CreateFile(filePath string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return err
	}
	return f.Close()
}

func (s *EditorService) CreateFolder(folderPath string) error {
	return os.MkdirAll(folderPath, 0755)
}

func (s *EditorService) DeletePath(targetPath string) error {
	return os.RemoveAll(targetPath)
}

func (s *EditorService) RenamePath(oldPath, newPath string) error {
	return os.Rename(oldPath, newPath)
}

func (s *EditorService) RevealInFileExplorer(targetPath string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", "/select,", targetPath)
	case "darwin":
		cmd = exec.Command("open", "-R", targetPath)
	default: // linux, bsd, etc.
		fi, err := os.Stat(targetPath)
		if err == nil && !fi.IsDir() {
			targetPath = filepath.Dir(targetPath)
		}
		cmd = exec.Command("xdg-open", targetPath)
	}
	return cmd.Start()
}

func (s *EditorService) startWatching(rootPath string) {
	s.mu.Lock()
	if s.watcher != nil {
		_ = s.watcher.Close()
	}
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		s.mu.Unlock()
		return
	}
	s.watcher = watcher
	s.mu.Unlock()

	_ = filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err == nil && info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" || name == "dist" {
				return filepath.SkipDir
			}
			_ = watcher.Add(path)
		}
		return nil
	})

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				// Debounce events to prevent spamming frontend
				s.mu.Lock()
				now := time.Now()
				if now.Sub(s.lastEmitTime) > 200*time.Millisecond {
					s.lastEmitTime = now
					s.mu.Unlock()
					if s.ctx != nil {
						wailsRuntime.EventsEmit(s.ctx, "workspace:fs-change", map[string]string{
							"op":   event.Op.String(),
							"path": event.Name,
						})
					}
				} else {
					s.mu.Unlock()
				}

				if event.Op&fsnotify.Create == fsnotify.Create {
					fi, err := os.Stat(event.Name)
					if err == nil && fi.IsDir() {
						_ = watcher.Add(event.Name)
					}
				}
			case _, ok := <-watcher.Errors:
				if !ok {
					return
				}
			case <-s.watcherStop:
				return
			}
		}
	}()
}
