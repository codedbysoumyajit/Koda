import * as monaco from 'monaco-editor';
import { EditorAPI, EditorSettings } from '../services/api';

export interface EditorTab {
  path: string;
  name: string;
  model: monaco.editor.ITextModel;
  viewState?: monaco.editor.ICodeEditorViewState | null;
  isDirty: boolean;
  isDiff?: boolean;
}

export class MonacoManager {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private diffEditor!: monaco.editor.IStandaloneDiffEditor;
  private tabs: Map<string, EditorTab> = new Map();
  private activeTabPath: string | null = null;
  private onTabChangeCallback?: (tab: EditorTab | null, tabs: EditorTab[]) => void;
  private onCursorChangeCallback?: (ln: number, col: number) => void;
  private currentSettings!: EditorSettings;

  constructor(
    private editorHost: HTMLElement,
    private diffHost: HTMLElement,
    private tabsListEl: HTMLElement,
    private welcomeScreenEl: HTMLElement
  ) {}

  public init(settings: EditorSettings) {
    this.currentSettings = settings;

    // Create Monaco Code Editor
    this.editor = monaco.editor.create(this.editorHost, {
      theme: settings.theme || 'vs-dark',
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily,
      tabSize: settings.tabSize || 4,
      wordWrap: (settings.wordWrap as any) || 'on',
      minimap: { enabled: settings.minimap },
      lineNumbers: (settings.lineNumbers as any) || 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true }
    });

    // Create Monaco Diff Editor
    this.diffEditor = monaco.editor.createDiffEditor(this.diffHost, {
      theme: settings.theme || 'vs-dark',
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily,
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

    // Window resize observer
    window.addEventListener('resize', () => {
      this.editor.layout();
      this.diffEditor.layout();
    });
  }

  public applySettings(settings: EditorSettings) {
    this.currentSettings = settings;
    monaco.editor.setTheme(settings.theme || 'vs-dark');
    this.editor.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap as any,
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers as any
    });
    this.diffEditor.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily
    });
  }

  public onTabChange(cb: (tab: EditorTab | null, tabs: EditorTab[]) => void) {
    this.onTabChangeCallback = cb;
  }

  public onCursorChange(cb: (ln: number, col: number) => void) {
    this.onCursorChangeCallback = cb;
  }

  public async openFile(filePath: string, initialContent?: string) {
    if (this.tabs.has(filePath)) {
      this.setActiveTab(filePath);
      return;
    }

    let content = initialContent;
    let fileName = filePath.split('/').pop() || filePath;

    if (content === undefined) {
      const fileData = await EditorAPI.readFile(filePath);
      if (!fileData) return;
      content = fileData.content;
      fileName = fileData.name;
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
      isDirty: false
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

  public async saveActiveFile() {
    if (!this.activeTabPath || !this.tabs.has(this.activeTabPath)) return;
    const tab = this.tabs.get(this.activeTabPath)!;
    if (tab.isDiff) return;

    const content = tab.model.getValue();
    await EditorAPI.saveFile(tab.path, content);
    tab.isDirty = false;
    this.renderTabs();
  }

  public async saveAllFiles() {
    for (const tab of this.tabs.values()) {
      if (tab.isDirty && !tab.isDiff) {
        await EditorAPI.saveFile(tab.path, tab.model.getValue());
        tab.isDirty = false;
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

  public closeAllTabs() {
    for (const [path, tab] of this.tabs.entries()) {
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
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.closeTab(path);
      };

      tabEl.appendChild(icon);
      tabEl.appendChild(title);
      tabEl.appendChild(closeBtn);

      tabEl.onclick = () => this.setActiveTab(path);
      this.tabsListEl.appendChild(tabEl);
    }
  }

  private getLanguageByExtension(filename: string): string {
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
