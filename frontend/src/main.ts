import './style.css';
import { EditorAPI, SettingsAPI, Events, GitAPI } from './services/api';
import { MonacoManager } from './components/monaco';
import { TerminalManager } from './components/terminal';
import { ExplorerManager } from './components/explorer';
import { SearchManager } from './components/search';
import { GitManager } from './components/git';
import { QuickOpenManager, QuickItem } from './components/quickopen';
import { SettingsManager } from './components/settings';

class AstroCodeApp {
  private monacoMgr!: MonacoManager;
  private termMgr!: TerminalManager;
  private explorerMgr!: ExplorerManager;
  private searchMgr!: SearchManager;
  private gitMgr!: GitManager;
  private quickOpenMgr!: QuickOpenManager;
  private settingsMgr!: SettingsManager;

  private currentWorkspace: string = '';
  private isSidebarVisible: boolean = true;
  private isPanelVisible: boolean = true;
  private activeSidebarView: string = 'explorer';
  private activePanelView: string = 'terminal';

  public async start() {
    // 1. Initialize Settings
    const settingsUiContainer = document.getElementById('settings-ui-container')!;
    this.settingsMgr = new SettingsManager(settingsUiContainer);
    await this.settingsMgr.init();
    const settings = this.settingsMgr.getSettings();
    this.applyTheme(settings.theme);

    // 2. Initialize Monaco Editor
    const monacoHost = document.getElementById('monaco-host')!;
    const diffHost = document.getElementById('diff-editor-host')!;
    const tabsListEl = document.getElementById('tabs-list')!;
    const welcomeScreenEl = document.getElementById('welcome-screen')!;
    this.monacoMgr = new MonacoManager(monacoHost, diffHost, tabsListEl, welcomeScreenEl);
    this.monacoMgr.init(settings);

    // 3. Initialize Terminal
    const terminalHost = document.getElementById('terminal-host')!;
    this.termMgr = new TerminalManager(terminalHost);
    this.termMgr.init(settings);

    // 4. Initialize Explorer
    const fileTreeEl = document.getElementById('file-tree')!;
    const sectionTitleEl = document.getElementById('workspace-folder-name')!;
    this.explorerMgr = new ExplorerManager(fileTreeEl, sectionTitleEl);

    // 5. Initialize Search
    const searchInput = document.getElementById('search-query-input') as HTMLInputElement;
    const replaceInput = document.getElementById('search-replace-input') as HTMLInputElement;
    const includeInput = document.getElementById('search-include-input') as HTMLInputElement;
    const excludeInput = document.getElementById('search-exclude-input') as HTMLInputElement;
    const summaryEl = document.getElementById('search-results-summary')!;
    const resultsTreeEl = document.getElementById('search-results-tree')!;
    const searchBadge = document.getElementById('search-badge')!;
    this.searchMgr = new SearchManager(searchInput, replaceInput, includeInput, excludeInput, summaryEl, resultsTreeEl, searchBadge);

    // 6. Initialize Git
    const commitInput = document.getElementById('git-commit-message') as HTMLTextAreaElement;
    const stagedListEl = document.getElementById('git-staged-list')!;
    const changesListEl = document.getElementById('git-changes-list')!;
    const untrackedListEl = document.getElementById('git-untracked-list')!;
    const stagedCountEl = document.getElementById('git-staged-count')!;
    const changesCountEl = document.getElementById('git-changes-count')!;
    const untrackedCountEl = document.getElementById('git-untracked-count')!;
    const gitBadge = document.getElementById('git-badge')!;
    this.gitMgr = new GitManager(commitInput, stagedListEl, changesListEl, untrackedListEl, stagedCountEl, changesCountEl, untrackedCountEl, gitBadge);

    // 7. Initialize Quick Open & Command Palette
    this.quickOpenMgr = new QuickOpenManager();
    this.registerCommands();

    // 8. Wire Component Handlers
    this.setupComponentEvents();
    this.setupUIInteractions();
    this.setupKeyboardShortcuts();
    this.setupResizers();
    this.loadRecentWorkspaces();

    // Default workspace check
    const current = await EditorAPI.getCurrentWorkspace();
    if (current) {
      await this.openWorkspace(current);
    } else {
      // Start terminal with home or current directory
      this.termMgr.startSession('');
    }
  }

  private applyTheme(theme: string) {
    document.body.className = theme === 'vs-light' ? 'theme-vs-light' : 'theme-vs-dark';
  }

  private setupComponentEvents() {
    // Monaco Events
    this.monacoMgr.onTabChange((tab) => {
      const langEl = document.getElementById('status-language');
      const indentEl = document.getElementById('status-indent');
      if (tab) {
        this.explorerMgr.setActiveFile(tab.path);
        if (langEl) langEl.textContent = tab.model.getLanguageId();
        if (indentEl) indentEl.textContent = `Spaces: ${this.settingsMgr.getSettings().tabSize}`;
      } else {
        this.explorerMgr.setActiveFile(null);
        if (langEl) langEl.textContent = 'Plain Text';
      }
    });

    this.monacoMgr.onCursorChange((ln, col) => {
      const cursorEl = document.getElementById('status-cursor-pos');
      if (cursorEl) {
        cursorEl.textContent = `Ln ${ln}, Col ${col}`;
      }
    });

    // Explorer Events
    this.explorerMgr.onOpenFile((path) => {
      this.monacoMgr.openFile(path);
    });

    this.explorerMgr.onContextMenu((e, node) => {
      this.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'New File',
          action: async () => {
            const name = prompt('File Name:');
            if (name) {
              const targetDir = node.isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
              await EditorAPI.createFile(`${targetDir}/${name}`);
              await this.explorerMgr.refresh();
              this.monacoMgr.openFile(`${targetDir}/${name}`);
            }
          }
        },
        {
          label: 'New Folder',
          action: async () => {
            const name = prompt('Folder Name:');
            if (name) {
              const targetDir = node.isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
              await EditorAPI.createFolder(`${targetDir}/${name}`);
              await this.explorerMgr.refresh();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Rename...',
          action: async () => {
            const newName = prompt('New Name:', node.name);
            if (newName && newName !== node.name) {
              const parentDir = node.path.substring(0, node.path.lastIndexOf('/'));
              await EditorAPI.renamePath(node.path, `${parentDir}/${newName}`);
              await this.explorerMgr.refresh();
            }
          }
        },
        {
          label: 'Delete',
          action: async () => {
            if (confirm(`Delete ${node.name}?`)) {
              await EditorAPI.deletePath(node.path);
              await this.explorerMgr.refresh();
              this.monacoMgr.closeTab(node.path);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reveal in File Manager',
          action: () => EditorAPI.revealInFileExplorer(node.path)
        },
        {
          label: 'Copy Path',
          action: () => navigator.clipboard.writeText(node.path)
        }
      ]);
    });

    // Search Events
    this.searchMgr.onOpenMatch((filePath, line) => {
      this.monacoMgr.openFile(filePath).then(() => {
        const editor = this.monacoMgr.getEditorInstance();
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      });
    });

    // Git Events
    this.gitMgr.onOpenDiff((filePath, oldContent, newContent) => {
      this.monacoMgr.openDiff(filePath, oldContent, newContent);
    });

    this.gitMgr.onBranchChange((branch, ahead, behind) => {
      const branchEl = document.getElementById('status-branch-name');
      const syncEl = document.getElementById('status-sync-counts');
      if (branchEl) branchEl.textContent = branch || 'No Git';
      if (syncEl) syncEl.textContent = `${behind}↓ ${ahead}↑`;
    });

    // Settings Events
    this.settingsMgr.onSettingsChange((settings) => {
      this.applyTheme(settings.theme);
      this.monacoMgr.applySettings(settings);
      this.termMgr.applySettings(settings);
    });

    this.settingsMgr.onOpenSettingsJSON(async () => {
      const json = await SettingsAPI.getSettingsJSON();
      this.monacoMgr.openFile('~/.astrocode/settings.json', json);
    });
  }

  private setupUIInteractions() {
    // Activity Bar Switching
    const activityButtons = document.querySelectorAll('.activity-btn[data-view]');
    activityButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view')!;
        this.switchSidebarView(view);
      });
    });

    // Titlebar Layout Buttons
    document.getElementById('btn-layout-sidebar')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('btn-layout-panel')?.addEventListener('click', () => this.togglePanel());

    // Quick Open Trigger from Titlebar Search
    document.getElementById('quickopen-trigger')?.addEventListener('click', () => {
      this.quickOpenMgr.showQuickOpen();
    });

    // Bottom Panel Tabs
    const panelTabs = document.querySelectorAll('.panel-tab[data-panel]');
    panelTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const panelName = tab.getAttribute('data-panel')!;
        this.switchPanelView(panelName);
      });
    });

    // Panel Actions
    document.getElementById('btn-new-terminal')?.addEventListener('click', () => {
      this.termMgr.startSession(this.currentWorkspace);
      this.switchPanelView('terminal');
    });
    document.getElementById('btn-kill-terminal')?.addEventListener('click', () => this.termMgr.kill());
    document.getElementById('btn-close-panel')?.addEventListener('click', () => this.togglePanel(false));
    document.getElementById('btn-maximize-panel')?.addEventListener('click', () => {
      const panel = document.getElementById('bottom-panel')!;
      const isMax = panel.style.height === '80vh';
      panel.style.height = isMax ? '240px' : '80vh';
      this.termMgr.fit();
    });

    // Editor Tab Actions
    document.getElementById('btn-close-all-tabs')?.addEventListener('click', () => this.monacoMgr.closeAllTabs());
    document.getElementById('btn-split-editor')?.addEventListener('click', () => {
      const active = this.monacoMgr.getActiveTab();
      if (active) {
        alert('Editor split preview activated.');
      }
    });

    // Explorer Header Actions
    document.getElementById('btn-new-file')?.addEventListener('click', async () => {
      if (!this.currentWorkspace) return;
      const name = prompt('New File Name:');
      if (name) {
        await EditorAPI.createFile(`${this.currentWorkspace}/${name}`);
        await this.explorerMgr.refresh();
        this.monacoMgr.openFile(`${this.currentWorkspace}/${name}`);
      }
    });

    document.getElementById('btn-new-folder')?.addEventListener('click', async () => {
      if (!this.currentWorkspace) return;
      const name = prompt('New Folder Name:');
      if (name) {
        await EditorAPI.createFolder(`${this.currentWorkspace}/${name}`);
        await this.explorerMgr.refresh();
      }
    });

    document.getElementById('btn-refresh-explorer')?.addEventListener('click', () => this.explorerMgr.refresh());
    document.getElementById('btn-collapse-explorer')?.addEventListener('click', () => this.explorerMgr.collapseAll());

    // Welcome Screen Actions
    document.getElementById('welcome-new-file')?.addEventListener('click', () => {
      this.monacoMgr.openFile(`Untitled-${Date.now() % 1000}.txt`, '');
    });

    document.getElementById('welcome-open-folder')?.addEventListener('click', async () => {
      const selected = await EditorAPI.openFolderDialog();
      if (selected) this.openWorkspace(selected);
    });

    // Menubar command items
    document.querySelectorAll('.menu-entry[data-cmd]').forEach((el) => {
      el.addEventListener('click', () => {
        const cmd = el.getAttribute('data-cmd')!;
        this.executeCommand(cmd);
      });
    });
  }

  private setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        this.quickOpenMgr.showQuickOpen();
      } else if (isCtrl && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        this.quickOpenMgr.showCommandPalette();
      } else if (isCtrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        this.monacoMgr.saveActiveFile();
      } else if (isCtrl && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        this.monacoMgr.saveAllFiles();
      } else if (isCtrl && e.key === 'w') {
        e.preventDefault();
        const active = this.monacoMgr.getActiveTab();
        if (active) this.monacoMgr.closeTab(active.path);
      } else if (isCtrl && e.key === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      } else if (isCtrl && e.key === '`') {
        e.preventDefault();
        this.togglePanel();
      } else if (isCtrl && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        this.switchSidebarView('search');
        this.searchMgr.focus();
      } else if (isCtrl && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault();
        this.switchSidebarView('git');
      } else if (isCtrl && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        this.switchSidebarView('explorer');
      } else if (isCtrl && e.key === ',') {
        e.preventDefault();
        this.switchSidebarView('settings');
      }
    });
  }

  private setupResizers() {
    // Sidebar Resizer
    const resizerSidebar = document.getElementById('resizer-sidebar')!;
    const sidebar = document.getElementById('sidebar')!;
    let isResizingSidebar = false;

    resizerSidebar.addEventListener('mousedown', (e) => {
      isResizingSidebar = true;
      resizerSidebar.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    // Bottom Panel Resizer
    const resizerPanel = document.getElementById('resizer-panel')!;
    const bottomPanel = document.getElementById('bottom-panel')!;
    let isResizingPanel = false;

    resizerPanel.addEventListener('mousedown', (e) => {
      isResizingPanel = true;
      resizerPanel.classList.add('resizing');
      document.body.style.cursor = 'row-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (isResizingSidebar) {
        const activityBarWidth = 48;
        const newWidth = Math.max(160, Math.min(600, e.clientX - activityBarWidth));
        sidebar.style.width = `${newWidth}px`;
        this.termMgr.fit();
      } else if (isResizingPanel) {
        const titlebarHeight = 35;
        const statusbarHeight = 22;
        const totalHeight = window.innerHeight;
        const newHeight = Math.max(60, Math.min(window.innerHeight - 100, totalHeight - e.clientY - statusbarHeight));
        bottomPanel.style.height = `${newHeight}px`;
        this.termMgr.fit();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isResizingSidebar) {
        isResizingSidebar = false;
        resizerSidebar.classList.remove('resizing');
        document.body.style.cursor = '';
      }
      if (isResizingPanel) {
        isResizingPanel = false;
        resizerPanel.classList.remove('resizing');
        document.body.style.cursor = '';
        this.termMgr.fit();
      }
    });
  }

  public async openWorkspace(path: string) {
    this.currentWorkspace = path;
    await EditorAPI.setWorkspace(path);
    await SettingsAPI.addRecentWorkspace(path);

    const folderName = path.split('/').pop() || path;
    const titleWorkspaceName = document.getElementById('titlebar-workspace-name')!;
    titleWorkspaceName.textContent = `${folderName} — AstroCode`;

    await this.explorerMgr.loadWorkspace(path);
    this.searchMgr.setWorkspace(path);
    await this.gitMgr.setWorkspace(path);

    // Start terminal in workspace directory
    await this.termMgr.startSession(path);

    // Index files for Quick Open
    this.indexWorkspaceFiles(path);
    this.loadRecentWorkspaces();
  }

  private async indexWorkspaceFiles(path: string) {
    const tree = await EditorAPI.getDirectoryTree(path);
    if (!tree) return;

    const files: { name: string; path: string }[] = [];
    const traverse = (node: any) => {
      if (!node.isDir) {
        files.push({ name: node.name, path: node.path });
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(tree);
    this.quickOpenMgr.setFiles(files);
  }

  private async loadRecentWorkspaces() {
    const recents = await SettingsAPI.getRecentWorkspaces();
    const listEl = document.getElementById('recent-workspaces-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (recents.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:12px;">No recent workspaces</div>';
      return;
    }

    recents.forEach((path) => {
      const item = document.createElement('div');
      item.className = 'recent-item';
      item.innerHTML = `<i class="codicon codicon-folder"></i> <span>${path}</span>`;
      item.onclick = () => this.openWorkspace(path);
      listEl.appendChild(item);
    });
  }

  private switchSidebarView(view: string) {
    const views = ['explorer', 'search', 'git', 'settings'];
    const sidebar = document.getElementById('sidebar')!;

    if (this.activeSidebarView === view && this.isSidebarVisible) {
      // Toggle sidebar off if clicked on same view
      this.toggleSidebar(false);
      return;
    }

    this.toggleSidebar(true);
    this.activeSidebarView = view;

    views.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === view ? 'flex' : 'none';
      const btn = document.getElementById(`act-${v}`);
      if (btn) btn.classList.toggle('active', v === view);
    });

    if (view === 'git') {
      this.gitMgr.refresh();
    } else if (view === 'search') {
      this.searchMgr.focus();
    }
  }

  private switchPanelView(panel: string) {
    const panels = ['terminal', 'problems', 'output'];
    this.activePanelView = panel;

    panels.forEach((p) => {
      const viewEl = document.getElementById(`view-${p}`);
      if (viewEl) viewEl.classList.toggle('active', p === panel);
      const tabEl = document.getElementById(`tab-panel-${p}`);
      if (tabEl) tabEl.classList.toggle('active', p === panel);
    });

    if (panel === 'terminal') {
      setTimeout(() => {
        this.termMgr.fit();
        this.termMgr.focus();
      }, 50);
    }
  }

  private toggleSidebar(forceState?: boolean) {
    const sidebar = document.getElementById('sidebar')!;
    const resizer = document.getElementById('resizer-sidebar')!;
    this.isSidebarVisible = forceState !== undefined ? forceState : !this.isSidebarVisible;

    sidebar.style.display = this.isSidebarVisible ? 'flex' : 'none';
    resizer.style.display = this.isSidebarVisible ? 'block' : 'none';
    this.termMgr.fit();
  }

  private togglePanel(forceState?: boolean) {
    const panel = document.getElementById('bottom-panel')!;
    const resizer = document.getElementById('resizer-panel')!;
    this.isPanelVisible = forceState !== undefined ? forceState : !this.isPanelVisible;

    panel.style.display = this.isPanelVisible ? 'flex' : 'none';
    resizer.style.display = this.isPanelVisible ? 'block' : 'none';
    if (this.isPanelVisible) {
      setTimeout(() => {
        this.termMgr.fit();
        this.termMgr.focus();
      }, 50);
    }
  }

  private showContextMenu(x: number, y: number, items: Array<{ label?: string; action?: () => void; type?: string }>) {
    const menu = document.getElementById('context-menu')!;
    menu.innerHTML = '';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';

    items.forEach((item) => {
      if (item.type === 'separator') {
        const div = document.createElement('div');
        div.className = 'context-menu-divider';
        menu.appendChild(div);
      } else {
        const itemEl = document.createElement('div');
        itemEl.className = 'context-menu-item';
        itemEl.textContent = item.label || '';
        itemEl.onclick = () => {
          menu.style.display = 'none';
          if (item.action) item.action();
        };
        menu.appendChild(itemEl);
      }
    });

    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.style.display = 'none';
        window.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => window.addEventListener('click', closeHandler), 10);
  }

  private registerCommands() {
    const commands: QuickItem[] = [
      {
        id: 'workbench.action.files.openFolder',
        label: 'File: Open Folder...',
        detail: 'Open a workspace directory',
        icon: 'codicon-folder-opened',
        action: async () => {
          const path = await EditorAPI.openFolderDialog();
          if (path) this.openWorkspace(path);
        }
      },
      {
        id: 'workbench.action.files.newUntitledFile',
        label: 'File: New Text File',
        detail: 'Create a new untitled buffer',
        icon: 'codicon-new-file',
        action: () => this.monacoMgr.openFile(`Untitled-${Date.now() % 1000}.txt`, '')
      },
      {
        id: 'workbench.action.files.save',
        label: 'File: Save',
        detail: 'Save current active file to disk',
        icon: 'codicon-save',
        action: () => this.monacoMgr.saveActiveFile()
      },
      {
        id: 'workbench.action.files.saveAll',
        label: 'File: Save All',
        detail: 'Save all dirty open buffers',
        icon: 'codicon-save-all',
        action: () => this.monacoMgr.saveAllFiles()
      },
      {
        id: 'workbench.action.closeActiveEditor',
        label: 'View: Close Active Editor',
        detail: 'Close current editor tab',
        icon: 'codicon-close',
        action: () => {
          const tab = this.monacoMgr.getActiveTab();
          if (tab) this.monacoMgr.closeTab(tab.path);
        }
      },
      {
        id: 'workbench.action.toggleSidebar',
        label: 'View: Toggle Primary Side Bar',
        detail: 'Show or hide explorer/search sidebar',
        icon: 'codicon-layout-sidebar-left',
        action: () => this.toggleSidebar()
      },
      {
        id: 'workbench.action.terminal.toggleTerminal',
        label: 'View: Toggle Terminal',
        detail: 'Show or hide bottom integrated terminal',
        icon: 'codicon-terminal',
        action: () => this.togglePanel()
      },
      {
        id: 'workbench.action.terminal.new',
        label: 'Terminal: Create New Integrated Terminal',
        detail: 'Spawn a new shell process in PTY',
        icon: 'codicon-plus',
        action: () => {
          this.termMgr.startSession(this.currentWorkspace);
          this.switchPanelView('terminal');
        }
      },
      {
        id: 'workbench.view.explorer',
        label: 'View: Show Explorer',
        detail: 'Focus workspace file tree',
        icon: 'codicon-files',
        action: () => this.switchSidebarView('explorer')
      },
      {
        id: 'workbench.view.search',
        label: 'View: Show Search',
        detail: 'Search for text across workspace files',
        icon: 'codicon-search',
        action: () => this.switchSidebarView('search')
      },
      {
        id: 'workbench.view.scm',
        label: 'View: Show Source Control',
        detail: 'Manage Git staged files and commits',
        icon: 'codicon-source-control',
        action: () => this.switchSidebarView('git')
      },
      {
        id: 'workbench.action.openSettings',
        label: 'Preferences: Open Settings (UI)',
        detail: 'Customize AstroCode editor & terminal options',
        icon: 'codicon-settings-gear',
        action: () => this.switchSidebarView('settings')
      },
      {
        id: 'workbench.action.openSettingsJson',
        label: 'Preferences: Open User Settings (JSON)',
        detail: 'Edit ~/.astrocode/settings.json directly',
        icon: 'codicon-json',
        action: async () => {
          const json = await SettingsAPI.getSettingsJSON();
          this.monacoMgr.openFile('~/.astrocode/settings.json', json);
        }
      },
      {
        id: 'workbench.action.selectTheme',
        label: 'Preferences: Color Theme',
        detail: 'Switch between Dark+ and Light+',
        icon: 'codicon-symbol-color',
        action: async () => {
          const current = this.settingsMgr.getSettings().theme;
          const next = current === 'vs-dark' ? 'vs-light' : 'vs-dark';
          const s = this.settingsMgr.getSettings();
          s.theme = next;
          await SettingsAPI.saveSettings(s);
          this.applyTheme(next);
          this.monacoMgr.applySettings(s);
          this.settingsMgr.render();
        }
      },
      {
        id: 'git.commit',
        label: 'Git: Commit Staged',
        detail: 'Commit staged changes to repository',
        icon: 'codicon-check',
        action: () => this.gitMgr.commit()
      },
      {
        id: 'git.pull',
        label: 'Git: Pull',
        detail: 'Pull changes from remote repository',
        icon: 'codicon-cloud-download',
        action: async () => {
          if (this.currentWorkspace) {
            await GitAPI.pull(this.currentWorkspace);
            await this.gitMgr.refresh();
          }
        }
      },
      {
        id: 'git.push',
        label: 'Git: Push',
        detail: 'Push commits to remote repository',
        icon: 'codicon-cloud-upload',
        action: async () => {
          if (this.currentWorkspace) {
            await GitAPI.push(this.currentWorkspace);
            await this.gitMgr.refresh();
          }
        }
      }
    ];

    this.quickOpenMgr.registerCommands(commands);
  }

  private executeCommand(cmdId: string) {
    const cmd = this.quickOpenMgr['allCommands'].find((c: QuickItem) => c.id === cmdId);
    if (cmd) {
      cmd.action();
    }
  }
}

// Bootstrap AstroCode application
document.addEventListener('DOMContentLoaded', () => {
  const app = new AstroCodeApp();
  app.start();
});
