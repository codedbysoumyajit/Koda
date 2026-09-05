import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { TerminalAPI, Events, EditorSettings } from '../services/api';

export interface TerminalInstance {
  id: string;
  title: string;
  index: number;
  cwd: string;
  term: Terminal;
  fitAddon: FitAddon;
  screenEl: HTMLElement;
  tabEl?: HTMLElement;
  isAlive: boolean;
  splitWithId?: string; // If this terminal is split side-by-side with another
}

export class TerminalManager {
  private sessions: Map<string, TerminalInstance> = new Map();
  private activeSessionId: string | null = null;
  private currentSettings!: EditorSettings;
  private isInitialized: boolean = false;
  private sessionCounter: number = 0;

  private terminalBodyEl!: HTMLElement;
  private terminalTabsListEl!: HTMLElement;
  private terminalSidebarEl!: HTMLElement;

  constructor(private container: HTMLElement) {}

  public init(settings: EditorSettings) {
    if (this.isInitialized) return;
    this.currentSettings = settings;

    // Build modern terminal layout inside container
    this.container.innerHTML = `
      <div class="terminal-layout" id="terminal-layout">
        <div class="terminal-screens-area" id="terminal-screens-area">
          <div class="terminal-empty-state" id="terminal-empty-state" style="display: none;">
            <p>No active terminal sessions.</p>
            <button class="action-btn" id="btn-term-empty-new">
              <i class="codicon codicon-plus"></i> New Terminal
            </button>
          </div>
        </div>
        <div class="terminal-tabs-pane" id="terminal-tabs-pane">
          <div class="terminal-tabs-header">
            <span class="terminal-tabs-header-title">TERMINALS</span>
            <div class="terminal-tabs-header-actions">
              <button class="icon-btn" id="btn-tabpane-new-term" title="New Terminal (Ctrl+Shift+\`)">
                <i class="codicon codicon-plus"></i>
              </button>
              <button class="icon-btn" id="btn-tabpane-split-term" title="Split Terminal">
                <i class="codicon codicon-split-horizontal"></i>
              </button>
            </div>
          </div>
          <div class="terminal-tabs-list" id="terminal-tabs-list"></div>
        </div>
      </div>
    `;

    this.terminalBodyEl = document.getElementById('terminal-screens-area')!;
    this.terminalTabsListEl = document.getElementById('terminal-tabs-list')!;
    this.terminalSidebarEl = document.getElementById('terminal-tabs-pane')!;

    document.getElementById('btn-term-empty-new')?.addEventListener('click', () => {
      this.startSession('');
    });

    document.getElementById('btn-tabpane-new-term')?.addEventListener('click', () => {
      this.startSession('');
    });

    document.getElementById('btn-tabpane-split-term')?.addEventListener('click', () => {
      this.splitActiveSession();
    });

    window.addEventListener('resize', () => {
      this.fit();
    });

    this.isInitialized = true;
  }

  public async startSession(cwd: string = ''): Promise<string> {
    this.sessionCounter++;
    const termNumber = this.sessionCounter;

    // Create session via Wails API
    const sessionInfo = await TerminalAPI.createTerminal(cwd);
    const id = sessionInfo.id;
    const baseTitle = sessionInfo.title || 'bash';

    // Create DOM element for xterm
    const screenEl = document.createElement('div');
    screenEl.className = 'terminal-screen';
    screenEl.id = `term-screen-${id}`;
    this.terminalBodyEl.appendChild(screenEl);

    // Initialize xterm
    const term = new Terminal({
      fontSize: this.currentSettings?.terminalFontSize || 14,
      fontFamily: this.currentSettings?.terminalFontFamily || "'Fira Code', 'Consolas', monospace",
      cursorBlink: this.currentSettings?.terminalCursorBlink !== false,
      theme: {
        background: '#181818',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.25)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(screenEl);

    // Terminal data & resize listeners
    term.onData((data) => {
      TerminalAPI.writeTerminal(id, data);
    });

    term.onResize(({ cols, rows }) => {
      TerminalAPI.resizeTerminal(id, cols, rows);
    });

    // Backend event listeners
    Events.on(`terminal:data:${id}`, (data: string) => {
      term.write(data);
    });

    Events.on(`terminal:exit:${id}`, () => {
      const sess = this.sessions.get(id);
      if (sess) {
        sess.isAlive = false;
        sess.term.writeln('\r\n\x1b[33m[Process completed]\x1b[0m\r\n');
        this.renderTabsList();
      }
    });

    const instance: TerminalInstance = {
      id,
      title: `${termNumber}: ${baseTitle}`,
      index: termNumber,
      cwd,
      term,
      fitAddon,
      screenEl,
      isAlive: true
    };

    this.sessions.set(id, instance);
    this.setActiveSession(id);

    return id;
  }

  public async splitActiveSession(): Promise<string | null> {
    if (!this.activeSessionId) {
      return this.startSession('');
    }

    const currentActive = this.sessions.get(this.activeSessionId);
    if (!currentActive) return null;

    const newId = await this.startSession(currentActive.cwd);
    const newSession = this.sessions.get(newId);
    if (!newSession) return null;

    // Mark as split pair
    currentActive.splitWithId = newId;
    newSession.splitWithId = this.activeSessionId;

    this.layoutSplitScreens(currentActive, newSession);
    return newId;
  }

  private layoutSplitScreens(sess1: TerminalInstance, sess2: TerminalInstance) {
    // Both screens visible side-by-side
    sess1.screenEl.style.display = 'block';
    sess1.screenEl.style.width = '50%';
    sess1.screenEl.style.height = '100%';
    sess1.screenEl.style.float = 'left';
    sess1.screenEl.style.borderRight = '1px solid var(--border-color)';

    sess2.screenEl.style.display = 'block';
    sess2.screenEl.style.width = '50%';
    sess2.screenEl.style.height = '100%';
    sess2.screenEl.style.float = 'left';

    setTimeout(() => {
      sess1.fitAddon.fit();
      sess2.fitAddon.fit();
      sess2.term.focus();
    }, 50);
  }

  public setActiveSession(id: string) {
    if (!this.sessions.has(id)) return;
    this.activeSessionId = id;

    const activeSession = this.sessions.get(id)!;

    // Hide all screens first
    this.sessions.forEach((s) => {
      s.screenEl.style.display = 'none';
      s.screenEl.style.width = '100%';
      s.screenEl.style.height = '100%';
      s.screenEl.style.float = 'none';
      s.screenEl.style.borderRight = 'none';
    });

    // If active session is split with another session, display both side-by-side
    if (activeSession.splitWithId && this.sessions.has(activeSession.splitWithId)) {
      const peer = this.sessions.get(activeSession.splitWithId)!;
      this.layoutSplitScreens(activeSession, peer);
    } else {
      activeSession.screenEl.style.display = 'block';
      activeSession.screenEl.style.width = '100%';
      activeSession.screenEl.style.height = '100%';
      setTimeout(() => {
        activeSession.fitAddon.fit();
        activeSession.term.focus();
      }, 50);
    }

    const emptyState = document.getElementById('terminal-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    this.renderTabsList();
  }

  public killSession(targetId?: string) {
    const idToKill = targetId || this.activeSessionId;
    if (!idToKill || !this.sessions.has(idToKill)) return;

    const sess = this.sessions.get(idToKill)!;
    TerminalAPI.closeTerminal(idToKill);

    // If split, unlink peer
    if (sess.splitWithId && this.sessions.has(sess.splitWithId)) {
      const peer = this.sessions.get(sess.splitWithId)!;
      peer.splitWithId = undefined;
    }

    sess.term.dispose();
    sess.screenEl.remove();
    this.sessions.delete(idToKill);

    if (this.activeSessionId === idToKill) {
      const remaining = Array.from(this.sessions.keys());
      if (remaining.length > 0) {
        this.setActiveSession(remaining[remaining.length - 1]);
      } else {
        this.activeSessionId = null;
        const emptyState = document.getElementById('terminal-empty-state');
        if (emptyState) emptyState.style.display = 'flex';
      }
    }

    this.renderTabsList();
  }

  public kill() {
    this.killSession();
  }

  public clear() {
    if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
      this.sessions.get(this.activeSessionId)!.term.clear();
    }
  }

  public focus() {
    if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
      this.sessions.get(this.activeSessionId)!.term.focus();
    }
  }

  public fit() {
    if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
      const active = this.sessions.get(this.activeSessionId)!;
      try {
        active.fitAddon.fit();
        TerminalAPI.resizeTerminal(active.id, active.term.cols, active.term.rows);
      } catch (e) {
        // ignore layout race
      }

      if (active.splitWithId && this.sessions.has(active.splitWithId)) {
        const peer = this.sessions.get(active.splitWithId)!;
        try {
          peer.fitAddon.fit();
          TerminalAPI.resizeTerminal(peer.id, peer.term.cols, peer.term.rows);
        } catch (e) {
          // ignore layout race
        }
      }
    }
  }

  public applySettings(settings: EditorSettings) {
    this.currentSettings = settings;
    this.sessions.forEach((s) => {
      s.term.options.fontSize = settings.terminalFontSize || 14;
      s.term.options.fontFamily = settings.terminalFontFamily || "'Fira Code', 'Consolas', monospace";
      s.term.options.cursorBlink = settings.terminalCursorBlink !== false;
    });
    this.fit();
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }

  public getActiveSession(): TerminalInstance | null {
    if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
      return this.sessions.get(this.activeSessionId)!;
    }
    return null;
  }

  private renderTabsList() {
    if (!this.terminalTabsListEl) return;
    this.terminalTabsListEl.innerHTML = '';

    const sessionList = Array.from(this.sessions.values());
    sessionList.forEach((sess) => {
      const tabEl = document.createElement('div');
      tabEl.className = `terminal-tab-item ${sess.id === this.activeSessionId ? 'active' : ''} ${!sess.isAlive ? 'exited' : ''}`;

      const icon = document.createElement('i');
      icon.className = `codicon ${sess.isAlive ? 'codicon-terminal' : 'codicon-stop-circle'} terminal-tab-icon`;

      const title = document.createElement('span');
      title.className = 'terminal-tab-title';
      title.textContent = sess.title + (!sess.isAlive ? ' (exited)' : '');

      const actions = document.createElement('div');
      actions.className = 'terminal-tab-actions';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'icon-btn-tiny';
      closeBtn.title = 'Kill Terminal';
      closeBtn.innerHTML = '<i class="codicon codicon-trash"></i>';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.killSession(sess.id);
      };

      actions.appendChild(closeBtn);

      tabEl.appendChild(icon);
      tabEl.appendChild(title);
      tabEl.appendChild(actions);

      tabEl.onclick = () => {
        this.setActiveSession(sess.id);
      };

      this.terminalTabsListEl.appendChild(tabEl);
    });
  }
}
