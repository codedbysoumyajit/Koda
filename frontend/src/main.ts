import './style.css';
import { EditorAPI, SettingsAPI, GitAPI, AppAPI, Events } from './services/api';
import { MonacoManager, EditorTab } from './components/monaco';
import { TerminalManager } from './components/terminal';
import { ExplorerManager } from './components/explorer';
import { SearchManager } from './components/search';
import { GitManager } from './components/git';
import { QuickOpenManager, QuickItem } from './components/quickopen';
import { SettingsManager } from './components/settings';
import * as monaco from 'monaco-editor';

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
  private activeMenuDropdown: HTMLElement | null = null;
  private outputLogs: Map<string, string[]> = new Map([
    ['AstroCode', ['[AstroCode] Application core ready. Monaco Editor and Multi-Terminal initialized.']],
    ['Git', ['[Git] Ready.']],
    ['Terminal', ['[Terminal] Ready.']]
  ]);
  private currentOutputChannel: string = 'AstroCode';
  private isOpeningFolder: boolean = false;

  public async start() {
    // 0. Listen for real-time window configuration events from Go backend
    Events.on('window-config', (cfg: any) => {
      this.applyWindowConfig(cfg);
    });

    // 0.1 Query window config from backend
    const winConfig = await AppAPI.getWindowConfig();
    this.applyWindowConfig(winConfig);

    // 1. Initialize Settings
    const settingsUiContainer = document.getElementById('settings-ui-container')!;
    this.settingsMgr = new SettingsManager(settingsUiContainer);
    await this.settingsMgr.init();
    const settings = this.settingsMgr.getSettings();
    this.applyTheme(settings.theme);

    // If settings contained window config, apply it as well
    if (typeof settings.isNativeTitlebar === 'boolean') {
      this.applyWindowConfig({ isWayland: settings.isWayland, isNativeTitlebar: settings.isNativeTitlebar });
    }

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
    this.setupMenubar();
    this.setupKeyboardShortcuts();
    this.setupResizers();
    this.loadRecentWorkspaces();
    this.setupWindowControls();
    this.setupOutputPanel();

    // Default workspace check
    const current = await EditorAPI.getCurrentWorkspace();
    if (current) {
      await this.openWorkspace(current);
    } else {
      // Start terminal with home or current directory
      await this.termMgr.startSession('');
    }
  }

  private applyTheme(theme: string) {
    document.body.className = theme === 'vs-light' ? 'theme-vs-light' : 'theme-vs-dark';
  }

  public log(channel: string, message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${message}`;
    if (!this.outputLogs.has(channel)) {
      this.outputLogs.set(channel, []);
    }
    this.outputLogs.get(channel)!.push(formatted);
    if (this.currentOutputChannel === channel) {
      this.renderOutputConsole();
    }
  }

  private renderOutputConsole() {
    const outputHost = document.getElementById('output-host');
    if (!outputHost) return;
    const logs = this.outputLogs.get(this.currentOutputChannel) || [];
    outputHost.innerHTML = logs.map((l) => `<div class="output-line">${this.escapeHtml(l)}</div>`).join('');
    outputHost.scrollTop = outputHost.scrollHeight;
  }

  private setupOutputPanel() {
    const channelSelect = document.getElementById('output-channel-select') as HTMLSelectElement;
    if (channelSelect) {
      channelSelect.onchange = () => {
        this.currentOutputChannel = channelSelect.value;
        this.renderOutputConsole();
      };
    }

    const clearBtn = document.getElementById('btn-clear-output');
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.outputLogs.set(this.currentOutputChannel, []);
        this.renderOutputConsole();
      };
    }

    this.renderOutputConsole();
  }

  private applyWindowConfig(winConfig: any) {
    const isNative = Boolean(winConfig?.isNativeTitlebar);
    const windowControls = document.querySelector('.titlebar-window-controls') as HTMLElement;
    if (isNative) {
      document.body.classList.add('native-titlebar');
      if (windowControls) {
        windowControls.style.setProperty('display', 'none', 'important');
      }
    } else {
      document.body.classList.remove('native-titlebar');
      if (windowControls) {
        windowControls.style.display = '';
      }
    }
  }

  private setupWindowControls() {
    // Re-verify window configuration to ensure duplicate controls stay hidden under native Wayland
    AppAPI.getWindowConfig().then((cfg) => {
      this.applyWindowConfig(cfg);
    });

    const minBtn = document.getElementById('btn-window-minimize');
    const maxBtn = document.getElementById('btn-window-maximize');
    const closeBtn = document.getElementById('btn-window-close');
    const titlebar = document.getElementById('titlebar');

    minBtn?.addEventListener('click', async () => {
      await AppAPI.minimize();
    });

    maxBtn?.addEventListener('click', async () => {
      const isMax = await AppAPI.toggleMaximize();
      this.updateMaximizeIcon(isMax);
    });

    closeBtn?.addEventListener('click', async () => {
      await AppAPI.close();
    });

    // Double click titlebar to toggle maximize
    titlebar?.addEventListener('dblclick', async (e) => {
      if ((e.target as HTMLElement).closest('button, input, .menu-item, .quickopen-searchbox')) return;
      const isMax = await AppAPI.toggleMaximize();
      this.updateMaximizeIcon(isMax);
    });

    document.getElementById('btn-close-about')?.addEventListener('click', () => {
      this.hideAbout();
    });

    document.getElementById('about-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('about-modal')) {
        this.hideAbout();
      }
    });

    AppAPI.isMaximised().then((isMax) => this.updateMaximizeIcon(isMax));
  }

  private updateMaximizeIcon(isMax: boolean) {
    const maxBtn = document.getElementById('btn-window-maximize');
    if (!maxBtn) return;
    const icon = maxBtn.querySelector('.codicon') as HTMLElement;
    if (icon) {
      icon.className = `codicon ${isMax ? 'codicon-chrome-restore' : 'codicon-chrome-maximize'}`;
    }
    maxBtn.title = isMax ? 'Restore' : 'Maximize';
  }

  private async toggleFullscreen() {
    const isFull = await AppAPI.toggleFullscreen();
    this.log('AstroCode', isFull ? 'Entered full screen' : 'Exited full screen');
  }

  private showAbout() {
    const modal = document.getElementById('about-modal');
    if (modal) modal.style.display = 'flex';
  }

  private hideAbout() {
    const modal = document.getElementById('about-modal');
    if (modal) modal.style.display = 'none';
  }

  private setupComponentEvents() {
    // Monaco Events
    this.monacoMgr.onTabChange((tab) => {
      const langEl = document.getElementById('status-language');
      const indentEl = document.getElementById('status-indent');
      const breadcrumbFile = document.getElementById('breadcrumb-filename');

      if (tab) {
        this.explorerMgr.setActiveFile(tab.path);
        if (langEl) langEl.textContent = tab.model.getLanguageId();
        if (indentEl) indentEl.textContent = `Spaces: ${this.settingsMgr.getSettings().tabSize}`;
        if (breadcrumbFile) breadcrumbFile.textContent = tab.name;
      } else {
        this.explorerMgr.setActiveFile(null);
        if (langEl) langEl.textContent = 'Plain Text';
        if (breadcrumbFile) breadcrumbFile.textContent = 'No file open';
      }
    });

    this.monacoMgr.onCursorChange((ln, col) => {
      const cursorEl = document.getElementById('status-cursor-pos');
      if (cursorEl) {
        cursorEl.textContent = `Ln ${ln}, Col ${col}`;
      }
    });

    // Monaco real-time syntax markers -> Problems panel
    this.monacoMgr.onMarkersChange((markers) => {
      this.updateProblemsPanel(markers);
    });

    // Tab context menu
    this.monacoMgr.onTabContextMenu((e, tab) => {
      this.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'Close (Ctrl+W)',
          action: () => this.monacoMgr.closeTab(tab.path)
        },
        {
          label: 'Close Others',
          action: () => this.monacoMgr.closeOthers(tab.path)
        },
        {
          label: 'Close to the Right',
          action: () => this.monacoMgr.closeToRight(tab.path)
        },
        {
          label: 'Close All',
          action: () => this.monacoMgr.closeAllTabs()
        },
        { type: 'separator' },
        {
          label: 'Copy Path',
          action: () => navigator.clipboard.writeText(tab.path)
        },
        {
          label: 'Copy Relative Path',
          action: () => {
            const rel = tab.path.replace(this.currentWorkspace + '/', '');
            navigator.clipboard.writeText(rel);
          }
        },
        {
          label: 'Reveal in File Explorer',
          action: () => EditorAPI.revealInFileExplorer(tab.path)
        }
      ]);
    });

    // Explorer Events
    this.explorerMgr.onOpenFile((path) => {
      this.monacoMgr.openFile(path);
      this.log('AstroCode', `Opened file: ${path}`);
    });

    this.explorerMgr.onOpenFolder(() => {
      this.triggerOpenFolder();
    });

    this.explorerMgr.onContextMenu((e, node) => {
      this.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'New File',
          action: () => this.explorerMgr.startInlineCreate(false)
        },
        {
          label: 'New Folder',
          action: () => this.explorerMgr.startInlineCreate(true)
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
          label: 'Open in Integrated Terminal',
          action: () => {
            const dir = node.isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
            this.termMgr.startSession(dir);
            this.switchPanelView('terminal');
          }
        },
        {
          label: 'Reveal in File Manager',
          action: () => EditorAPI.revealInFileExplorer(node.path)
        },
        {
          label: 'Copy Path',
          action: () => navigator.clipboard.writeText(node.path)
        },
        {
          label: 'Copy Relative Path',
          action: () => {
            const rel = node.path.replace(this.currentWorkspace + '/', '');
            navigator.clipboard.writeText(rel);
          }
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

    // Quick Open file select & Go to Line
    this.quickOpenMgr.onOpenFile((path) => {
      this.monacoMgr.openFile(path);
    });

    this.quickOpenMgr.onGoToLine((lineNum) => {
      const editor = this.monacoMgr.getEditorInstance();
      editor.revealLineInCenter(lineNum);
      editor.setPosition({ lineNumber: lineNum, column: 1 });
      editor.focus();
    });
  }

  private updateProblemsPanel(markers: monaco.editor.IMarker[]) {
    const problemsCountHeader = document.getElementById('problems-count-header');
    const problemsHost = document.getElementById('problems-host');
    const statusProblems = document.getElementById('status-problems-count');

    let errors = 0;
    let warnings = 0;

    markers.forEach((m) => {
      if (m.severity === monaco.MarkerSeverity.Error) errors++;
      else if (m.severity === monaco.MarkerSeverity.Warning) warnings++;
    });

    if (statusProblems) {
      statusProblems.innerHTML = `<i class="codicon codicon-error"></i> ${errors} <i class="codicon codicon-warning"></i> ${warnings}`;
    }

    if (problemsCountHeader) {
      problemsCountHeader.textContent = `${markers.length} Problem${markers.length === 1 ? '' : 's'}`;
    }

    if (!problemsHost) return;

    if (markers.length === 0) {
      problemsHost.innerHTML = '<div class="empty-message">No problems have been detected in the workspace.</div>';
      return;
    }

    problemsHost.innerHTML = '';
    markers.forEach((marker) => {
      const item = document.createElement('div');
      item.className = 'problem-item';

      const isErr = marker.severity === monaco.MarkerSeverity.Error;
      const icon = document.createElement('i');
      icon.className = `codicon ${isErr ? 'codicon-error problem-icon-error' : 'codicon-warning problem-icon-warning'}`;

      const msg = document.createElement('span');
      msg.className = 'problem-message';
      msg.textContent = marker.message;

      const loc = document.createElement('span');
      loc.className = 'problem-location';
      const fileName = marker.resource.path.split('/').pop() || marker.resource.path;
      loc.textContent = `${fileName} [${marker.startLineNumber}, ${marker.startColumn}]`;

      item.appendChild(icon);
      item.appendChild(msg);
      item.appendChild(loc);

      item.onclick = async () => {
        await this.monacoMgr.openFile(marker.resource.path);
        const editor = this.monacoMgr.getEditorInstance();
        editor.revealLineInCenter(marker.startLineNumber);
        editor.setPosition({ lineNumber: marker.startLineNumber, column: marker.startColumn });
        editor.focus();
      };

      problemsHost.appendChild(item);
    });
  }

  private setupMenubar() {
    const menuItems = document.querySelectorAll('.menu-item[data-menu]');
    
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = item.querySelector('.menu-dropdown') as HTMLElement;
        if (this.activeMenuDropdown === dropdown) {
          this.closeMenubarDropdowns();
        } else {
          this.closeMenubarDropdowns();
          if (dropdown) {
            dropdown.classList.add('show');
            item.classList.add('active');
            this.activeMenuDropdown = dropdown;
          }
        }
      });

      item.addEventListener('mouseenter', () => {
        if (this.activeMenuDropdown) {
          const dropdown = item.querySelector('.menu-dropdown') as HTMLElement;
          this.closeMenubarDropdowns();
          if (dropdown) {
            dropdown.classList.add('show');
            item.classList.add('active');
            this.activeMenuDropdown = dropdown;
          }
        }
      });
    });

    window.addEventListener('click', () => {
      this.closeMenubarDropdowns();
    });

    // Menubar command execution
    document.querySelectorAll('.menu-entry[data-cmd]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenubarDropdowns();
        const cmd = el.getAttribute('data-cmd')!;
        this.executeCommand(cmd);
      });
    });
  }

  private closeMenubarDropdowns() {
    document.querySelectorAll('.menu-dropdown.show').forEach((dd) => dd.classList.remove('show'));
    document.querySelectorAll('.menu-item.active').forEach((mi) => mi.classList.remove('active'));
    this.activeMenuDropdown = null;
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
    document.getElementById('btn-split-terminal')?.addEventListener('click', () => {
      this.termMgr.splitActiveSession();
      this.switchPanelView('terminal');
    });
    document.getElementById('btn-kill-terminal')?.addEventListener('click', () => {
      this.termMgr.killSession();
    });
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
      this.monacoMgr.toggleSplitEditor();
    });

    // Explorer Header Actions
    document.getElementById('btn-new-file')?.addEventListener('click', () => {
      this.explorerMgr.startInlineCreate(false);
    });

    document.getElementById('btn-new-folder')?.addEventListener('click', () => {
      this.explorerMgr.startInlineCreate(true);
    });

    document.getElementById('btn-refresh-explorer')?.addEventListener('click', () => this.explorerMgr.refresh());
    document.getElementById('btn-collapse-explorer')?.addEventListener('click', () => this.explorerMgr.collapseAll());

    // Welcome Screen & Explorer Empty Actions
    document.getElementById('welcome-new-file')?.addEventListener('click', () => {
      this.monacoMgr.openFile(`Untitled-${Date.now() % 1000}.txt`, '');
    });

    document.getElementById('welcome-open-folder')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerOpenFolder();
    });

    // Delegated click on file-tree so any "Open Folder" button in empty guide works dynamically
    document.getElementById('file-tree')?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('#btn-open-folder-welcome, #btn-open-folder-welcome-inner, .empty-workspace-guide .action-btn');
      if (target) {
        e.stopPropagation();
        this.triggerOpenFolder();
      }
    });

    // Status Bar Click Actions
    this.setupStatusBarInteractions();
  }

  private setupStatusBarInteractions() {
    // Git Branch Picker / Creator
    document.getElementById('status-git-branch')?.addEventListener('click', async () => {
      if (!this.currentWorkspace || !this.gitMgr.isRepo()) return;

      const branches = await GitAPI.getBranches(this.currentWorkspace);
      const items: QuickItem[] = [
        {
          id: 'create-branch',
          label: '+ Create New Branch...',
          detail: 'Create and checkout a new git branch',
          icon: 'codicon-git-branch',
          action: async () => {
            const name = prompt('New Branch Name:');
            if (name && name.trim()) {
              await GitAPI.createBranch(this.currentWorkspace, name.trim());
              await this.gitMgr.refresh();
              this.log('Git', `Switched to new branch: ${name.trim()}`);
            }
          }
        },
        ...branches.map((b) => ({
          id: b.name,
          label: b.name,
          detail: b.isCurrent ? 'Current branch' : (b.isRemote ? 'Remote branch' : 'Local branch'),
          icon: 'codicon-git-branch',
          action: async () => {
            await GitAPI.checkoutBranch(this.currentWorkspace, b.name);
            await this.gitMgr.refresh();
            this.log('Git', `Switched to branch: ${b.name}`);
          }
        }))
      ];

      this.quickOpenMgr.showCustomPalette('Select a branch to checkout...', items);
    });

    // Git Sync (Pull & Push)
    document.getElementById('status-git-sync')?.addEventListener('click', async () => {
      if (!this.currentWorkspace || !this.gitMgr.isRepo()) return;
      const syncEl = document.getElementById('status-git-sync');
      syncEl?.classList.add('sync-spinning');
      this.log('Git', 'Syncing changes with remote repository...');

      try {
        await GitAPI.pull(this.currentWorkspace);
        await GitAPI.push(this.currentWorkspace);
        await this.gitMgr.refresh();
        this.log('Git', 'Sync completed successfully.');
      } catch (err: any) {
        this.log('Git', `Sync failed: ${err?.message || err}`);
      } finally {
        syncEl?.classList.remove('sync-spinning');
      }
    });

    // Problems count click -> open problems view
    document.getElementById('status-problems-count')?.addEventListener('click', () => {
      this.togglePanel(true);
      this.switchPanelView('problems');
    });

    // Cursor position -> Go to Line
    document.getElementById('status-cursor-pos')?.addEventListener('click', () => {
      this.quickOpenMgr.showGoToLine();
    });

    // Indentation picker
    document.getElementById('status-indent')?.addEventListener('click', () => {
      const items: QuickItem[] = [
        {
          id: 'indent-2',
          label: 'Indent Using Spaces: 2',
          detail: 'Change tab size to 2 spaces',
          icon: 'codicon-list-flat',
          action: () => {
            this.monacoMgr.setTabSize(2, true);
            const indentEl = document.getElementById('status-indent');
            if (indentEl) indentEl.textContent = 'Spaces: 2';
          }
        },
        {
          id: 'indent-4',
          label: 'Indent Using Spaces: 4',
          detail: 'Change tab size to 4 spaces',
          icon: 'codicon-list-flat',
          action: () => {
            this.monacoMgr.setTabSize(4, true);
            const indentEl = document.getElementById('status-indent');
            if (indentEl) indentEl.textContent = 'Spaces: 4';
          }
        },
        {
          id: 'indent-8',
          label: 'Indent Using Spaces: 8',
          detail: 'Change tab size to 8 spaces',
          icon: 'codicon-list-flat',
          action: () => {
            this.monacoMgr.setTabSize(8, true);
            const indentEl = document.getElementById('status-indent');
            if (indentEl) indentEl.textContent = 'Spaces: 8';
          }
        },
        {
          id: 'indent-tabs',
          label: 'Indent Using Tabs',
          detail: 'Insert tab characters',
          icon: 'codicon-list-flat',
          action: () => {
            this.monacoMgr.setTabSize(4, false);
            const indentEl = document.getElementById('status-indent');
            if (indentEl) indentEl.textContent = 'Tabs';
          }
        }
      ];
      this.quickOpenMgr.showCustomPalette('Select Indentation Setting...', items);
    });

    // EOL Toggle (LF / CRLF)
    document.getElementById('status-eol')?.addEventListener('click', () => {
      const eolEl = document.getElementById('status-eol');
      const isLF = eolEl?.textContent === 'LF';
      const next = isLF ? 'CRLF' : 'LF';
      this.monacoMgr.setEOL(isLF ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
      if (eolEl) eolEl.textContent = next;
    });

    // Language Selector
    document.getElementById('status-language')?.addEventListener('click', () => {
      const languages = [
        'typescript', 'javascript', 'html', 'css', 'json', 'go', 'python',
        'rust', 'cpp', 'c', 'csharp', 'java', 'markdown', 'shell', 'yaml', 'xml', 'sql', 'php'
      ];
      const items: QuickItem[] = languages.map((lang) => ({
        id: lang,
        label: lang,
        detail: `Select language mode for ${lang}`,
        icon: 'codicon-code',
        action: () => {
          this.monacoMgr.setLanguage(lang);
          const langEl = document.getElementById('status-language');
          if (langEl) langEl.textContent = lang;
        }
      }));
      this.quickOpenMgr.showCustomPalette('Select Language Mode...', items);
    });

    // Notification bell -> toggle output panel
    document.getElementById('status-notification')?.addEventListener('click', () => {
      this.togglePanel();
      this.switchPanelView('output');
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
      } else if (isCtrl && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        this.quickOpenMgr.showGoToLine();
      } else if (isCtrl && (e.key === 'o' || e.key === 'O') && !e.shiftKey) {
        e.preventDefault();
        this.triggerOpenFolder();
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
      } else if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
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

  public async triggerOpenFolder() {
    if (this.isOpeningFolder) return;
    this.isOpeningFolder = true;
    try {
      const selected = await EditorAPI.openFolderDialog();
      if (selected) {
        await this.openWorkspace(selected);
      }
    } catch (err) {
      console.error('Failed to open workspace folder:', err);
    } finally {
      setTimeout(() => {
        this.isOpeningFolder = false;
      }, 400);
    }
  }

  public async openWorkspace(path: string) {
    this.currentWorkspace = path;
    await EditorAPI.setWorkspace(path);
    await SettingsAPI.addRecentWorkspace(path);

    const folderName = path.split('/').pop() || path;
    const title = `${folderName} — AstroCode`;
    const titleWorkspaceName = document.getElementById('titlebar-workspace-name')!;
    titleWorkspaceName.textContent = title;
    await AppAPI.setWindowTitle(title);

    const breadcrumbWorkspace = document.getElementById('breadcrumb-workspace');
    if (breadcrumbWorkspace) breadcrumbWorkspace.textContent = folderName;

    await this.explorerMgr.loadWorkspace(path);
    this.searchMgr.setWorkspace(path);
    await this.gitMgr.setWorkspace(path);

    // Start terminal in workspace directory
    await this.termMgr.startSession(path);

    // Fast index files for Quick Open
    this.indexWorkspaceFiles(path);
    this.loadRecentWorkspaces();
    this.log('AstroCode', `Opened workspace: ${path}`);
  }

  private async indexWorkspaceFiles(path: string) {
    const allFiles = await EditorAPI.getAllFiles(path);
    if (allFiles && allFiles.length > 0) {
      const items = allFiles.map((rel) => ({
        name: rel.split('/').pop() || rel,
        path: `${path}/${rel}`
      }));
      this.quickOpenMgr.setFiles(items);
      return;
    }

    // Fallback if GetAllFiles is empty
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

    if (this.activeSidebarView === view && this.isSidebarVisible) {
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
    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
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
        shortcut: 'Ctrl+K Ctrl+O',
        action: () => this.triggerOpenFolder()
      },
      {
        id: 'workbench.action.files.newUntitledFile',
        label: 'File: New Text File',
        detail: 'Create a new untitled buffer',
        icon: 'codicon-new-file',
        shortcut: 'Ctrl+N',
        action: () => this.monacoMgr.openFile(`Untitled-${Date.now() % 1000}.txt`, '')
      },
      {
        id: 'workbench.action.files.save',
        label: 'File: Save',
        detail: 'Save current active file to disk',
        icon: 'codicon-save',
        shortcut: 'Ctrl+S',
        action: () => this.monacoMgr.saveActiveFile()
      },
      {
        id: 'workbench.action.files.saveAll',
        label: 'File: Save All',
        detail: 'Save all dirty open buffers',
        icon: 'codicon-save-all',
        shortcut: 'Ctrl+Shift+S',
        action: () => this.monacoMgr.saveAllFiles()
      },
      {
        id: 'workbench.action.closeActiveEditor',
        label: 'View: Close Active Editor',
        detail: 'Close current editor tab',
        icon: 'codicon-close',
        shortcut: 'Ctrl+W',
        action: () => {
          const tab = this.monacoMgr.getActiveTab();
          if (tab) this.monacoMgr.closeTab(tab.path);
        }
      },
      {
        id: 'editor.action.undo',
        label: 'Edit: Undo',
        detail: 'Undo the last action',
        icon: 'codicon-discard',
        shortcut: 'Ctrl+Z',
        action: () => this.monacoMgr.executeEditorAction('editor.action.undo')
      },
      {
        id: 'editor.action.redo',
        label: 'Edit: Redo',
        detail: 'Redo the last undone action',
        icon: 'codicon-redo',
        shortcut: 'Ctrl+Y',
        action: () => this.monacoMgr.executeEditorAction('editor.action.redo')
      },
      {
        id: 'editor.action.find',
        label: 'Edit: Find',
        detail: 'Find text in current editor',
        icon: 'codicon-search',
        shortcut: 'Ctrl+F',
        action: () => this.monacoMgr.executeEditorAction('editor.action.find')
      },
      {
        id: 'editor.action.replace',
        label: 'Edit: Replace',
        detail: 'Replace text in current editor',
        icon: 'codicon-replace',
        shortcut: 'Ctrl+H',
        action: () => this.monacoMgr.executeEditorAction('editor.action.replace')
      },
      {
        id: 'workbench.action.findInFiles',
        label: 'Edit: Find in Files',
        detail: 'Search for text across workspace files',
        icon: 'codicon-search',
        shortcut: 'Ctrl+Shift+F',
        action: () => {
          this.switchSidebarView('search');
          this.searchMgr.focus();
        }
      },
      {
        id: 'editor.action.selectAll',
        label: 'Selection: Select All',
        detail: 'Select all text in editor',
        icon: 'codicon-selection',
        shortcut: 'Ctrl+A',
        action: () => this.monacoMgr.executeEditorAction('editor.action.selectAll')
      },
      {
        id: 'editor.action.copyLinesDownAction',
        label: 'Selection: Copy Line Down',
        detail: 'Duplicate current line downwards',
        icon: 'codicon-copy',
        shortcut: 'Shift+Alt+Down',
        action: () => this.monacoMgr.executeEditorAction('editor.action.copyLinesDownAction')
      },
      {
        id: 'editor.action.moveLinesDownAction',
        label: 'Selection: Move Line Down',
        detail: 'Move current line downwards',
        icon: 'codicon-arrow-down',
        shortcut: 'Alt+Down',
        action: () => this.monacoMgr.executeEditorAction('editor.action.moveLinesDownAction')
      },
      {
        id: 'workbench.action.showCommands',
        label: 'View: Command Palette...',
        detail: 'Open command palette',
        icon: 'codicon-terminal',
        shortcut: 'Ctrl+Shift+P',
        action: () => this.quickOpenMgr.showCommandPalette()
      },
      {
        id: 'workbench.action.toggleSidebar',
        label: 'View: Toggle Primary Side Bar',
        detail: 'Show or hide explorer/search sidebar',
        icon: 'codicon-layout-sidebar-left',
        shortcut: 'Ctrl+B',
        action: () => this.toggleSidebar()
      },
      {
        id: 'workbench.action.toggleFullScreen',
        label: 'View: Toggle Full Screen',
        detail: 'Toggle full screen mode',
        icon: 'codicon-screen-full',
        shortcut: 'F11',
        action: () => this.toggleFullscreen()
      },
      {
        id: 'workbench.action.terminal.toggleTerminal',
        label: 'View: Toggle Terminal',
        detail: 'Show or hide bottom integrated terminal',
        icon: 'codicon-terminal',
        shortcut: 'Ctrl+`',
        action: () => this.togglePanel()
      },
      {
        id: 'workbench.action.terminal.new',
        label: 'Terminal: Create New Integrated Terminal',
        detail: 'Spawn a new shell process in a new tab',
        icon: 'codicon-plus',
        shortcut: 'Ctrl+Shift+`',
        action: () => {
          this.termMgr.startSession(this.currentWorkspace);
          this.switchPanelView('terminal');
        }
      },
      {
        id: 'workbench.action.terminal.split',
        label: 'Terminal: Split Terminal',
        detail: 'Split terminal side-by-side',
        icon: 'codicon-split-horizontal',
        action: () => {
          this.termMgr.splitActiveSession();
          this.switchPanelView('terminal');
        }
      },
      {
        id: 'workbench.action.terminal.kill',
        label: 'Terminal: Kill Active Terminal',
        detail: 'Terminate the active terminal session',
        icon: 'codicon-trash',
        action: () => this.termMgr.killSession()
      },
      {
        id: 'workbench.view.explorer',
        label: 'View: Show Explorer',
        detail: 'Focus workspace file tree',
        icon: 'codicon-files',
        shortcut: 'Ctrl+Shift+E',
        action: () => this.switchSidebarView('explorer')
      },
      {
        id: 'workbench.view.search',
        label: 'View: Show Search',
        detail: 'Search across files',
        icon: 'codicon-search',
        shortcut: 'Ctrl+Shift+F',
        action: () => this.switchSidebarView('search')
      },
      {
        id: 'workbench.view.scm',
        label: 'View: Show Source Control',
        detail: 'Manage Git staged files and commits',
        icon: 'codicon-source-control',
        shortcut: 'Ctrl+Shift+G',
        action: () => this.switchSidebarView('git')
      },
      {
        id: 'workbench.action.openSettings',
        label: 'Preferences: Open Settings (UI)',
        detail: 'Customize AstroCode editor & terminal options',
        icon: 'codicon-settings-gear',
        shortcut: 'Ctrl+,',
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
        id: 'workbench.action.showAbout',
        label: 'Help: About AstroCode',
        detail: 'Show version and environment details',
        icon: 'codicon-info',
        action: () => this.showAbout()
      },
      {
        id: 'git.commit',
        label: 'Git: Commit Staged',
        detail: 'Commit staged changes to repository',
        icon: 'codicon-check',
        shortcut: 'Ctrl+Enter',
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
        action: () => this.gitMgr.push()
      },
      {
        id: 'git.sync',
        label: 'Git: Sync (Pull and Push)',
        detail: 'Synchronize changes with remote repository',
        icon: 'codicon-sync',
        action: () => this.gitMgr.sync()
      }
    ];

    this.quickOpenMgr.registerCommands(commands);
  }

  private executeCommand(cmdId: string) {
    const cmd = this.quickOpenMgr.getAllCommands().find((c: QuickItem) => c.id === cmdId);
    if (cmd) {
      cmd.action();
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// Bootstrap AstroCode application
document.addEventListener('DOMContentLoaded', () => {
  const app = new AstroCodeApp();
  app.start();
});
