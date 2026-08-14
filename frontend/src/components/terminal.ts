import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { TerminalAPI, Events, EditorSettings } from '../services/api';

export class TerminalManager {
  private term!: Terminal;
  private fitAddon!: FitAddon;
  private sessionId: string | null = null;
  private currentCwd: string = '';
  private isInitialized: boolean = false;

  constructor(private container: HTMLElement) {}

  public init(settings: EditorSettings) {
    if (this.isInitialized) return;

    this.term = new Terminal({
      fontSize: settings.terminalFontSize || 14,
      fontFamily: settings.terminalFontFamily || "'Fira Code', 'Consolas', monospace",
      cursorBlink: settings.terminalCursorBlink !== false,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
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

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(new WebLinksAddon());

    this.term.open(this.container);
    this.fitAddon.fit();

    // Key input handler
    this.term.onData((data) => {
      if (this.sessionId) {
        TerminalAPI.writeTerminal(this.sessionId, data);
      }
    });

    // Resize handler
    this.term.onResize(({ cols, rows }) => {
      if (this.sessionId) {
        TerminalAPI.resizeTerminal(this.sessionId, cols, rows);
      }
    });

    window.addEventListener('resize', () => {
      this.fit();
    });

    this.isInitialized = true;
  }

  public async startSession(cwd: string) {
    this.currentCwd = cwd;
    const session = await TerminalAPI.createTerminal(cwd);
    this.sessionId = session.id;

    // Listen for backend data stream
    Events.on(`terminal:data:${session.id}`, (data: string) => {
      this.term.write(data);
    });

    Events.on(`terminal:exit:${session.id}`, () => {
      this.term.writeln('\r\n\x1b[33m[Process completed]\x1b[0m\r\n');
    });

    setTimeout(() => {
      this.fit();
    }, 100);
  }

  public fit() {
    if (this.fitAddon && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
      try {
        this.fitAddon.fit();
        if (this.sessionId && this.term) {
          TerminalAPI.resizeTerminal(this.sessionId, this.term.cols, this.term.rows);
        }
      } catch (e) {
        // ignore layout race
      }
    }
  }

  public clear() {
    this.term?.clear();
  }

  public focus() {
    this.term?.focus();
  }

  public applySettings(settings: EditorSettings) {
    if (!this.term) return;
    this.term.options.fontSize = settings.terminalFontSize || 14;
    this.term.options.fontFamily = settings.terminalFontFamily || "'Fira Code', 'Consolas', monospace";
    this.term.options.cursorBlink = settings.terminalCursorBlink !== false;
    this.fit();
  }

  public kill() {
    if (this.sessionId) {
      TerminalAPI.closeTerminal(this.sessionId);
      this.sessionId = null;
    }
    this.clear();
  }
}
