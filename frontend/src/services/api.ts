// Wails API bridge wrapper with safe fallback support

declare global {
  interface Window {
    go?: {
      main?: {
        App?: any;
      };
      editorsvc?: {
        EditorService?: any;
      };
      termsvc?: {
        TerminalService?: any;
      };
      gitsvc?: {
        GitService?: any;
      };
      searchsvc?: {
        SearchService?: any;
      };
      settingssvc?: {
        SettingsService?: any;
      };
    };
    runtime?: {
      EventsOn: (eventName: string, callback: (...args: any[]) => void) => () => void;
      EventsEmit: (eventName: string, ...args: any[]) => void;
      WindowMinimise?: () => void;
      WindowMaximise?: () => void;
      WindowUnmaximise?: () => void;
      WindowToggleMaximise?: () => void;
      WindowFullscreen?: () => void;
      WindowUnfullscreen?: () => void;
      WindowIsFullscreen?: () => Promise<boolean>;
      WindowIsMaximised?: () => Promise<boolean>;
      WindowClose?: () => void;
      [key: string]: any;
    };
  }
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  size?: number;
  modTime?: number;
  gitStatus?: string;
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  encoding: string;
  size: number;
}

export interface GitFile {
  path: string;
  status: string;
  staged: boolean;
  oldPath?: string;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  stagedFiles: GitFile[];
  unstagedFiles: GitFile[];
  untrackedFiles: GitFile[];
}

export interface GitDiffResult {
  filePath: string;
  oldContent: string;
  newContent: string;
  rawDiff: string;
}

export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  startCol: number;
  endCol: number;
}

export interface FileSearchResult {
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
}

export interface SearchResponse {
  results: FileSearchResult[];
  totalMatches: number;
  totalFiles: number;
  durationMs: number;
}

export interface EditorSettings {
  theme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: string;
  minimap: boolean;
  lineNumbers: string;
  terminalFontSize: number;
  terminalFontFamily: string;
  terminalCursorBlink: boolean;
  formatOnSave: boolean;
  autoSave: string;
  gdkBackend?: 'x11' | 'wayland';
}

// Service proxies
export const EditorAPI = {
  openFolderDialog: async (): Promise<string> => {
    if (window.go?.editorsvc?.EditorService?.OpenFolderDialog) {
      return await window.go.editorsvc.EditorService.OpenFolderDialog();
    }
    return '';
  },
  getCurrentWorkspace: async (): Promise<string> => {
    if (window.go?.editorsvc?.EditorService?.GetCurrentWorkspace) {
      return await window.go.editorsvc.EditorService.GetCurrentWorkspace();
    }
    return '';
  },
  setWorkspace: async (path: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.SetWorkspace) {
      return await window.go.editorsvc.EditorService.SetWorkspace(path);
    }
  },
  getDirectoryTree: async (rootPath: string): Promise<FileNode | null> => {
    if (window.go?.editorsvc?.EditorService?.GetDirectoryTree) {
      return await window.go.editorsvc.EditorService.GetDirectoryTree(rootPath);
    }
    return null;
  },
  getSubTree: async (dirPath: string): Promise<FileNode[]> => {
    if (window.go?.editorsvc?.EditorService?.GetSubTree) {
      return await window.go.editorsvc.EditorService.GetSubTree(dirPath);
    }
    return [];
  },
  readFile: async (path: string): Promise<FileContent | null> => {
    if (window.go?.editorsvc?.EditorService?.ReadFile) {
      return await window.go.editorsvc.EditorService.ReadFile(path);
    }
    return null;
  },
  saveFile: async (path: string, content: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.SaveFile) {
      return await window.go.editorsvc.EditorService.SaveFile(path, content);
    }
  },
  createFile: async (path: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.CreateFile) {
      return await window.go.editorsvc.EditorService.CreateFile(path);
    }
  },
  createFolder: async (path: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.CreateFolder) {
      return await window.go.editorsvc.EditorService.CreateFolder(path);
    }
  },
  deletePath: async (path: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.DeletePath) {
      return await window.go.editorsvc.EditorService.DeletePath(path);
    }
  },
  renamePath: async (oldPath: string, newPath: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.RenamePath) {
      return await window.go.editorsvc.EditorService.RenamePath(oldPath, newPath);
    }
  },
  revealInFileExplorer: async (path: string): Promise<void> => {
    if (window.go?.editorsvc?.EditorService?.RevealInFileExplorer) {
      return await window.go.editorsvc.EditorService.RevealInFileExplorer(path);
    }
  },
  saveFileDialog: async (defaultName: string): Promise<string> => {
    if (window.go?.editorsvc?.EditorService?.SaveFileDialog) {
      return await window.go.editorsvc.EditorService.SaveFileDialog(defaultName);
    }
    return '';
  },
  getAllFiles: async (rootPath: string): Promise<string[]> => {
    if (window.go?.editorsvc?.EditorService?.GetAllFiles) {
      return await window.go.editorsvc.EditorService.GetAllFiles(rootPath);
    }
    return [];
  }
};

export const TerminalAPI = {
  createTerminal: async (cwd: string): Promise<{ id: string; title: string; cwd: string }> => {
    if (window.go?.termsvc?.TerminalService?.CreateTerminal) {
      return await window.go.termsvc.TerminalService.CreateTerminal(cwd);
    }
    return { id: 'mock-term', title: 'bash', cwd };
  },
  writeTerminal: async (id: string, data: string): Promise<void> => {
    if (window.go?.termsvc?.TerminalService?.WriteTerminal) {
      return await window.go.termsvc.TerminalService.WriteTerminal(id, data);
    }
  },
  resizeTerminal: async (id: string, cols: number, rows: number): Promise<void> => {
    if (window.go?.termsvc?.TerminalService?.ResizeTerminal) {
      return await window.go.termsvc.TerminalService.ResizeTerminal(id, cols, rows);
    }
  },
  closeTerminal: async (id: string): Promise<void> => {
    if (window.go?.termsvc?.TerminalService?.CloseTerminal) {
      return await window.go.termsvc.TerminalService.CloseTerminal(id);
    }
  }
};

export const GitAPI = {
  isGitRepo: async (path: string): Promise<boolean> => {
    if (window.go?.gitsvc?.GitService?.IsGitRepo) {
      return await window.go.gitsvc.GitService.IsGitRepo(path);
    }
    return false;
  },
  getStatus: async (path: string): Promise<GitStatusResult> => {
    if (window.go?.gitsvc?.GitService?.GetStatus) {
      return await window.go.gitsvc.GitService.GetStatus(path);
    }
    return { isRepo: false, branch: '', ahead: 0, behind: 0, stagedFiles: [], unstagedFiles: [], untrackedFiles: [] };
  },
  getDiff: async (repoPath: string, filePath: string, staged: boolean): Promise<GitDiffResult> => {
    if (window.go?.gitsvc?.GitService?.GetDiff) {
      return await window.go.gitsvc.GitService.GetDiff(repoPath, filePath, staged);
    }
    return { filePath, oldContent: '', newContent: '', rawDiff: '' };
  },
  stageFile: async (repoPath: string, filePath: string): Promise<void> => {
    if (window.go?.gitsvc?.GitService?.StageFile) {
      return await window.go.gitsvc.GitService.StageFile(repoPath, filePath);
    }
  },
  unstageFile: async (repoPath: string, filePath: string): Promise<void> => {
    if (window.go?.gitsvc?.GitService?.UnstageFile) {
      return await window.go.gitsvc.GitService.UnstageFile(repoPath, filePath);
    }
  },
  stageAll: async (repoPath: string): Promise<void> => {
    if (window.go?.gitsvc?.GitService?.StageAll) {
      return await window.go.gitsvc.GitService.StageAll(repoPath);
    }
  },
  unstageAll: async (repoPath: string): Promise<void> => {
    if (window.go?.gitsvc?.GitService?.UnstageAll) {
      return await window.go.gitsvc.GitService.UnstageAll(repoPath);
    }
  },
  discardChanges: async (repoPath: string, filePath: string): Promise<void> => {
    if (window.go?.gitsvc?.GitService?.DiscardChanges) {
      return await window.go.gitsvc.GitService.DiscardChanges(repoPath, filePath);
    }
  },
  commit: async (repoPath: string, message: string): Promise<string> => {
    if (window.go?.gitsvc?.GitService?.Commit) {
      return await window.go.gitsvc.GitService.Commit(repoPath, message);
    }
    return '';
  },
  getBranches: async (repoPath: string): Promise<any[]> => {
    if (window.go?.gitsvc?.GitService?.GetBranches) {
      return await window.go.gitsvc.GitService.GetBranches(repoPath);
    }
    return [];
  },
  checkoutBranch: async (repoPath: string, branch: string): Promise<string> => {
    if (window.go?.gitsvc?.GitService?.CheckoutBranch) {
      return await window.go.gitsvc.GitService.CheckoutBranch(repoPath, branch);
    }
    return '';
  },
  createBranch: async (repoPath: string, branch: string): Promise<string> => {
    if (window.go?.gitsvc?.GitService?.CreateBranch) {
      return await window.go.gitsvc.GitService.CreateBranch(repoPath, branch);
    }
    return '';
  },
  push: async (repoPath: string): Promise<string> => {
    if (window.go?.gitsvc?.GitService?.Push) {
      return await window.go.gitsvc.GitService.Push(repoPath);
    }
    return '';
  },
  pull: async (repoPath: string): Promise<string> => {
    if (window.go?.gitsvc?.GitService?.Pull) {
      return await window.go.gitsvc.GitService.Pull(repoPath);
    }
    return '';
  }
};

export const SearchAPI = {
  search: async (workspacePath: string, opts: any): Promise<SearchResponse> => {
    if (window.go?.searchsvc?.SearchService?.Search) {
      return await window.go.searchsvc.SearchService.Search(workspacePath, opts);
    }
    return { results: [], totalMatches: 0, totalFiles: 0, durationMs: 0 };
  },
  replaceInFile: async (workspacePath: string, relFilePath: string, query: string, replacement: string, isRegex: boolean, isCaseSensitive: boolean, isWholeWord: boolean): Promise<void> => {
    if (window.go?.searchsvc?.SearchService?.ReplaceInFile) {
      return await window.go.searchsvc.SearchService.ReplaceInFile(workspacePath, relFilePath, query, replacement, isRegex, isCaseSensitive, isWholeWord);
    }
  },
  replaceAll: async (workspacePath: string, query: string, replacement: string, isRegex: boolean, isCaseSensitive: boolean, isWholeWord: boolean, files: string[]): Promise<void> => {
    if (window.go?.searchsvc?.SearchService?.ReplaceAll) {
      return await window.go.searchsvc.SearchService.ReplaceAll(workspacePath, query, replacement, isRegex, isCaseSensitive, isWholeWord, files);
    }
  }
};

export const SettingsAPI = {
  getSettings: async (): Promise<EditorSettings> => {
    if (window.go?.settingssvc?.SettingsService?.GetSettings) {
      return await window.go.settingssvc.SettingsService.GetSettings();
    }
    return {
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: "'Fira Code', 'Consolas', monospace",
      tabSize: 4,
      wordWrap: 'on',
      minimap: true,
      lineNumbers: 'on',
      terminalFontSize: 14,
      terminalFontFamily: "'Fira Code', 'Consolas', monospace",
      terminalCursorBlink: true,
      formatOnSave: false,
      autoSave: 'off'
    };
  },
  saveSettings: async (settings: EditorSettings): Promise<void> => {
    if (window.go?.settingssvc?.SettingsService?.SaveSettings) {
      return await window.go.settingssvc.SettingsService.SaveSettings(settings);
    }
  },
  getSettingsJSON: async (): Promise<string> => {
    if (window.go?.settingssvc?.SettingsService?.GetSettingsJSON) {
      return await window.go.settingssvc.SettingsService.GetSettingsJSON();
    }
    return '{}';
  },
  saveSettingsJSON: async (content: string): Promise<void> => {
    if (window.go?.settingssvc?.SettingsService?.SaveSettingsJSON) {
      return await window.go.settingssvc.SettingsService.SaveSettingsJSON(content);
    }
  },
  getRecentWorkspaces: async (): Promise<string[]> => {
    if (window.go?.settingssvc?.SettingsService?.GetRecentWorkspaces) {
      return await window.go.settingssvc.SettingsService.GetRecentWorkspaces();
    }
    return [];
  },
  addRecentWorkspace: async (path: string): Promise<void> => {
    if (window.go?.settingssvc?.SettingsService?.AddRecentWorkspace) {
      return await window.go.settingssvc.SettingsService.AddRecentWorkspace(path);
    }
  }
};

export const AppAPI = {
  toggleFullscreen: async (): Promise<boolean> => {
    if (window.go?.main?.App?.ToggleFullscreen) {
      return await window.go.main.App.ToggleFullscreen();
    }
    if (window.runtime?.WindowFullscreen && window.runtime?.WindowUnfullscreen && window.runtime?.WindowIsFullscreen) {
      const isFull = await window.runtime.WindowIsFullscreen();
      if (isFull) {
        window.runtime.WindowUnfullscreen();
        return false;
      } else {
        window.runtime.WindowFullscreen();
        return true;
      }
    }
    return false;
  },
  toggleMaximize: async (): Promise<boolean> => {
    if (window.go?.main?.App?.ToggleMaximize) {
      return await window.go.main.App.ToggleMaximize();
    }
    if (window.runtime?.WindowToggleMaximise) {
      window.runtime.WindowToggleMaximise();
      if (window.runtime?.WindowIsMaximised) {
        return await window.runtime.WindowIsMaximised();
      }
    }
    return false;
  },
  minimize: async (): Promise<void> => {
    if (window.go?.main?.App?.Minimize) {
      return await window.go.main.App.Minimize();
    }
    window.runtime?.WindowMinimise?.();
  },
  close: async (): Promise<void> => {
    if (window.go?.main?.App?.Close) {
      return await window.go.main.App.Close();
    }
    window.runtime?.WindowClose?.();
  },
  isFullscreen: async (): Promise<boolean> => {
    if (window.go?.main?.App?.IsFullscreen) {
      return await window.go.main.App.IsFullscreen();
    }
    if (window.runtime?.WindowIsFullscreen) {
      return await window.runtime.WindowIsFullscreen();
    }
    return false;
  },
  isMaximised: async (): Promise<boolean> => {
    if (window.go?.main?.App?.IsMaximised) {
      return await window.go.main.App.IsMaximised();
    }
    if (window.runtime?.WindowIsMaximised) {
      return await window.runtime.WindowIsMaximised();
    }
    return false;
  }
};

export const Events = {
  on: (event: string, callback: (...args: any[]) => void) => {
    if (window.runtime?.EventsOn) {
      return window.runtime.EventsOn(event, callback);
    }
    return () => {};
  },
  emit: (event: string, ...args: any[]) => {
    if (window.runtime?.EventsEmit) {
      window.runtime.EventsEmit(event, ...args);
    }
  }
};
