import * as monaco from 'monaco-editor';
import { EditorAPI, EditorSettings } from '../services/api';

export interface EditorTab {
  path: string;
  name: string;
  model: monaco.editor.ITextModel;
  viewState?: monaco.editor.ICodeEditorViewState | null;
  isDirty: boolean;
  isDiff?: boolean;
  isUntitled?: boolean;
}

export interface MarkerInfo {
  severity: monaco.MarkerSeverity;
  message: string;
  startLineNumber: number;
  startColumn: number;
  resource: monaco.Uri;
}

export class MonacoManager {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private splitEditorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
  private diffEditor!: monaco.editor.IStandaloneDiffEditor;
  private tabs: Map<string, EditorTab> = new Map();
  private activeTabPath: string | null = null;
  private activeSplitTabPath: string | null = null;
  private isSplit: boolean = false;

  private onTabChangeCallback?: (tab: EditorTab | null, tabs: EditorTab[]) => void;
  private onCursorChangeCallback?: (ln: number, col: number) => void;
  private onMarkersChangeCallback?: (markers: monaco.editor.IMarker[]) => void;
  private onTabContextMenuCallback?: (e: MouseEvent, tab: EditorTab) => void;
  private currentSettings!: EditorSettings;

  constructor(
    private editorHost: HTMLElement,
    private diffHost: HTMLElement,
    private tabsListEl: HTMLElement,
    private welcomeScreenEl: HTMLElement
  ) {}

  public init(settings: EditorSettings) {
    this.currentSettings = settings;

    // Create Main Monaco Code Editor
    this.editor = monaco.editor.create(this.editorHost, {
      theme: settings.theme || 'vs-dark',
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily || "'Fira Code', 'Consolas', monospace",
      tabSize: settings.tabSize || 4,
      wordWrap: (settings.wordWrap as any) || 'on',
      minimap: { enabled: settings.minimap },
      lineNumbers: (settings.lineNumbers as any) || 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true }
    });

    // Create Monaco Diff Editor
    this.diffEditor = monaco.editor.createDiffEditor(this.diffHost, {
      theme: settings.theme || 'vs-dark',
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily || "'Fira Code', 'Consolas', monospace",
      automaticLayout: true,
      readOnly: false,
      renderSideBySide: true
    });

    // Cursor position listener
    this.editor.onDidChangeCursorPosition((e) => {
      if (this.onCursorChangeCallback) {
        this.onCursorChangeCallback(e.position.lineNumber, e.position.column);
      }
    });

    // Content change listener for dirty tracking
    this.editor.onDidChangeModelContent(() => {
      if (this.activeTabPath && this.tabs.has(this.activeTabPath)) {
        const tab = this.tabs.get(this.activeTabPath)!;
        if (!tab.isDirty) {
          tab.isDirty = true;
          this.renderTabs();
        }
      }
    });

    // Listen for syntax markers / diagnostics in real time
    monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({});
      if (this.onMarkersChangeCallback) {
        this.onMarkersChangeCallback(markers);
      }
    });

    // Window resize observer
    window.addEventListener('resize', () => {
      this.editor.layout();
      this.diffEditor.layout();
      this.splitEditorInstance?.layout();
    });
  }

  public applySettings(settings: EditorSettings) {
    this.currentSettings = settings;
    monaco.editor.setTheme(settings.theme || 'vs-dark');
    const opts: monaco.editor.IEditorOptions = {
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      wordWrap: settings.wordWrap as any,
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers as any
    };
    this.editor.updateOptions(opts);
    this.diffEditor.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily
    });
    this.splitEditorInstance?.updateOptions(opts);

    if (settings.tabSize) {
      this.tabs.forEach((tab) => {
        tab.model.updateOptions({ tabSize: settings.tabSize });
      });
    }
  }

  public onTabChange(cb: (tab: EditorTab | null, tabs: EditorTab[]) => void) {
    this.onTabChangeCallback = cb;
  }

  public onCursorChange(cb: (ln: number, col: number) => void) {
    this.onCursorChangeCallback = cb;
  }

  public onMarkersChange(cb: (markers: monaco.editor.IMarker[]) => void) {
    this.onMarkersChangeCallback = cb;
  }

  public onTabContextMenu(cb: (e: MouseEvent, tab: EditorTab) => void) {
    this.onTabContextMenuCallback = cb;
  }

  public async openFile(filePath: string, initialContent?: string) {
    if (this.tabs.has(filePath)) {
      this.setActiveTab(filePath);
      return;
    }

    let content = initialContent;
    let fileName = filePath.split('/').pop() || filePath;
    const isUntitled = filePath.startsWith('Untitled-');

    if (content === undefined && !isUntitled) {
      const fileData = await EditorAPI.readFile(filePath);
      if (!fileData) return;
      content = fileData.content;
      fileName = fileData.name;
    } else if (content === undefined) {
      content = '';
    }

    const language = this.getLanguageByExtension(fileName);
    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      model = monaco.editor.createModel(content, language, uri);
    } else {
      model.setValue(content);
    }

    const tab: EditorTab = {
      path: filePath,
      name: fileName,
      model,
      isDirty: isUntitled && !!content,
      isUntitled
    };

    this.tabs.set(filePath, tab);
    this.setActiveTab(filePath);
  }

  public openDiff(filePath: string, oldContent: string, newContent: string, title?: string) {
    const fileName = (title || filePath.split('/').pop() || filePath) + ' (Working Tree)';
    const diffKey = `diff:${filePath}`;

    const lang = this.getLanguageByExtension(filePath);
    const originalModel = monaco.editor.createModel(oldContent, lang);
    const modifiedModel = monaco.editor.createModel(newContent, lang);

    this.diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel
    });

    const tab: EditorTab = {
      path: diffKey,
      name: fileName,
      model: modifiedModel,
      isDirty: false,
      isDiff: true
    };

    this.tabs.set(diffKey, tab);
    this.setActiveTab(diffKey);
  }

  public setActiveTab(filePath: string) {
    if (!this.tabs.has(filePath)) return;

    // Save viewstate of previous tab
    if (this.activeTabPath && this.tabs.has(this.activeTabPath)) {
      const prevTab = this.tabs.get(this.activeTabPath)!;
      if (!prevTab.isDiff) {
        prevTab.viewState = this.editor.saveViewState();
      }
    }

    this.activeTabPath = filePath;
    const tab = this.tabs.get(filePath)!;

    if (tab.isDiff) {
      this.editorHost.style.display = 'none';
      this.diffHost.style.display = 'block';
      this.welcomeScreenEl.style.display = 'none';
      this.diffEditor.layout();
    } else {
      this.diffHost.style.display = 'none';
      this.editorHost.style.display = 'block';
      this.welcomeScreenEl.style.display = 'none';
      this.editor.setModel(tab.model);
      if (tab.viewState) {
        this.editor.restoreViewState(tab.viewState);
      }
      this.editor.focus();
      this.editor.layout();
    }

    this.renderTabs();
    if (this.onTabChangeCallback) {
      this.onTabChangeCallback(tab, Array.from(this.tabs.values()));
    }
  }

  public toggleSplitEditor() {
    this.isSplit = !this.isSplit;
    let splitHost = document.getElementById('monaco-split-host');

    if (this.isSplit) {
      if (!splitHost) {
        splitHost = document.createElement('div');
        splitHost.id = 'monaco-split-host';
        splitHost.style.width = '50%';
        splitHost.style.height = '100%';
        splitHost.style.float = 'right';
        splitHost.style.borderLeft = '1px solid var(--border-color)';
        this.editorHost.parentElement?.appendChild(splitHost);
      }
      this.editorHost.style.width = '50%';
      this.editorHost.style.float = 'left';
      splitHost.style.display = 'block';

      if (!this.splitEditorInstance) {
        this.splitEditorInstance = monaco.editor.create(splitHost, {
          theme: this.currentSettings.theme || 'vs-dark',
          fontSize: this.currentSettings.fontSize || 14,
          fontFamily: this.currentSettings.fontFamily || "'Fira Code', 'Consolas', monospace",
          tabSize: this.currentSettings.tabSize || 4,
          wordWrap: (this.currentSettings.wordWrap as any) || 'on',
          minimap: { enabled: this.currentSettings.minimap },
          lineNumbers: (this.currentSettings.lineNumbers as any) || 'on',
          automaticLayout: true
        });
      }

      // Load active or secondary tab in split
      const tabsArray = Array.from(this.tabs.values());
      const secondaryTab = tabsArray.find((t) => t.path !== this.activeTabPath) || tabsArray[0];
      if (secondaryTab) {
        this.splitEditorInstance.setModel(secondaryTab.model);
        this.activeSplitTabPath = secondaryTab.path;
      }
      this.editor.layout();
      this.splitEditorInstance.layout();
    } else {
      if (splitHost) {
        splitHost.style.display = 'none';
      }
      this.editorHost.style.width = '100%';
      this.editorHost.style.float = 'none';
      this.editor.layout();
    }
  }

  public async saveActiveFile(): Promise<boolean> {
    if (!this.activeTabPath || !this.tabs.has(this.activeTabPath)) return false;
    const tab = this.tabs.get(this.activeTabPath)!;
    if (tab.isDiff) return false;

    let targetPath = tab.path;

    // If untitled, prompt for location
    if (tab.isUntitled) {
      const suggestedName = tab.name.endsWith('.txt') ? 'untitled.txt' : tab.name;
      const chosen = await EditorAPI.saveFileDialog(suggestedName);
      if (!chosen) {
        const manualName = prompt('Enter filename to save:', suggestedName);
        if (!manualName) return false;
        targetPath = manualName;
      } else {
        targetPath = chosen;
      }
      tab.path = targetPath;
      tab.name = targetPath.split('/').pop() || targetPath;
      tab.isUntitled = false;
    }

    const content = tab.model.getValue();
    await EditorAPI.saveFile(targetPath, content);
    tab.isDirty = false;
    this.renderTabs();
    return true;
  }

  public async saveAllFiles() {
    for (const tab of this.tabs.values()) {
      if (tab.isDirty && !tab.isDiff) {
        if (tab.isUntitled) {
          await this.setActiveTab(tab.path);
          await this.saveActiveFile();
        } else {
          await EditorAPI.saveFile(tab.path, tab.model.getValue());
          tab.isDirty = false;
        }
      }
    }
    this.renderTabs();
  }

  public closeTab(filePath: string) {
    if (!this.tabs.has(filePath)) return;
    const tab = this.tabs.get(filePath)!;
    tab.model.dispose();
    this.tabs.delete(filePath);

    if (this.activeTabPath === filePath) {
      const remainingKeys = Array.from(this.tabs.keys());
      if (remainingKeys.length > 0) {
        this.setActiveTab(remainingKeys[remainingKeys.length - 1]);
      } else {
        this.activeTabPath = null;
        this.editorHost.style.display = 'none';
        this.diffHost.style.display = 'none';
        this.welcomeScreenEl.style.display = 'flex';
        if (this.onTabChangeCallback) {
          this.onTabChangeCallback(null, []);
        }
      }
    }

    this.renderTabs();
  }

  public closeOthers(filePath: string) {
    for (const path of Array.from(this.tabs.keys())) {
      if (path !== filePath) {
        this.closeTab(path);
      }
    }
    this.setActiveTab(filePath);
  }

  public closeToRight(filePath: string) {
    const keys = Array.from(this.tabs.keys());
    const idx = keys.indexOf(filePath);
    if (idx !== -1) {
      for (let i = idx + 1; i < keys.length; i++) {
        this.closeTab(keys[i]);
      }
    }
  }

  public closeAllTabs() {
    for (const [, tab] of this.tabs.entries()) {
      tab.model.dispose();
    }
    this.tabs.clear();
    this.activeTabPath = null;
    this.editorHost.style.display = 'none';
    this.diffHost.style.display = 'none';
    this.welcomeScreenEl.style.display = 'flex';
    this.renderTabs();
    if (this.onTabChangeCallback) {
      this.onTabChangeCallback(null, []);
    }
  }

  public getActiveTab(): EditorTab | null {
    if (this.activeTabPath && this.tabs.has(this.activeTabPath)) {
      return this.tabs.get(this.activeTabPath)!;
    }
    return null;
  }

  public getEditorInstance(): monaco.editor.IStandaloneCodeEditor {
    return this.editor;
  }

  public setLanguage(langId: string) {
    const active = this.getActiveTab();
    if (active) {
      monaco.editor.setModelLanguage(active.model, langId);
    }
  }

  public setTabSize(tabSize: number, insertSpaces: boolean = true) {
    this.editor.getModel()?.updateOptions({
      tabSize,
      insertSpaces
    });
    const active = this.getActiveTab();
    if (active) {
      active.model.updateOptions({ tabSize, insertSpaces });
    }
  }

  public setEOL(eol: monaco.editor.EndOfLineSequence) {
    const active = this.getActiveTab();
    if (active) {
      active.model.setEOL(eol);
    }
  }

  public executeEditorAction(actionId: string) {
    this.editor.focus();
    switch (actionId) {
      case 'editor.action.undo':
        this.editor.trigger('menu', 'undo', null);
        break;
      case 'editor.action.redo':
        this.editor.trigger('menu', 'redo', null);
        break;
      case 'editor.action.find':
        this.editor.getAction('actions.find')?.run();
        break;
      case 'editor.action.replace':
        this.editor.getAction('editor.action.startFindReplaceAction')?.run();
        break;
      case 'editor.action.selectAll':
        this.editor.setSelection(this.editor.getModel()!.getFullModelRange());
        break;
      case 'editor.action.copyLinesDownAction':
        this.editor.getAction('editor.action.copyLinesDownAction')?.run();
        break;
      case 'editor.action.moveLinesDownAction':
        this.editor.getAction('editor.action.moveLinesDownAction')?.run();
        break;
      case 'editor.action.commentLine':
        this.editor.getAction('editor.action.commentLine')?.run();
        break;
      case 'editor.action.formatDocument':
        this.editor.getAction('editor.action.formatDocument')?.run();
        break;
      default:
        this.editor.getAction(actionId)?.run();
        break;
    }
  }

  private renderTabs() {
    this.tabsListEl.innerHTML = '';
    for (const [path, tab] of this.tabs.entries()) {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${path === this.activeTabPath ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`;
      
      const icon = document.createElement('i');
      icon.className = `codicon tab-icon ${this.getFileCodicon(tab.name)}`;
      
      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.name;
      title.title = tab.path;

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = '<i class="codicon codicon-close"></i>';
      closeBtn.title = 'Close (Ctrl+W)';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.closeTab(path);
      };

      tabEl.appendChild(icon);
      tabEl.appendChild(title);
      tabEl.appendChild(closeBtn);

      tabEl.onclick = () => this.setActiveTab(path);

      // Middle click closes tab
      tabEl.onauxclick = (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.closeTab(path);
        }
      };

      // Right click context menu
      tabEl.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onTabContextMenuCallback) {
          this.onTabContextMenuCallback(e, tab);
        }
      };

      this.tabsListEl.appendChild(tabEl);
    }
  }

  public getLanguageByExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      html: 'html',
      htm: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      go: 'go',
      py: 'python',
      rs: 'rust',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      java: 'java',
      php: 'php',
      rb: 'ruby',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      sql: 'sql',
      md: 'markdown',
      dockerfile: 'dockerfile',
      env: 'ini'
    };
    return map[ext || ''] || 'plaintext';
  }

  public getFileCodicon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'codicon-file-code';
      case 'js':
      case 'jsx':
        return 'codicon-file-code';
      case 'json':
        return 'codicon-json';
      case 'html':
      case 'htm':
        return 'codicon-code';
      case 'css':
      case 'scss':
      case 'less':
        return 'codicon-paintcan';
      case 'go':
      case 'py':
      case 'rs':
      case 'c':
      case 'cpp':
      case 'java':
        return 'codicon-file-code';
      case 'md':
        return 'codicon-markdown';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return 'codicon-file-media';
      case 'zip':
      case 'tar':
      case 'gz':
        return 'codicon-file-zip';
      default:
        return 'codicon-file';
    }
  }
}
