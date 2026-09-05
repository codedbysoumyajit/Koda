export interface QuickItem {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
}

export class QuickOpenManager {
  private backdropEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private listEl: HTMLElement;
  private items: QuickItem[] = [];
  private filteredItems: QuickItem[] = [];
  private selectedIndex: number = 0;
  private isCommandMode: boolean = false;
  private isLineMode: boolean = false;
  private allCommands: QuickItem[] = [];
  private allFiles: { name: string; path: string }[] = [];
  private onOpenFileCallback?: (path: string) => void;
  private onGoToLineCallback?: (line: number) => void;

  constructor() {
    this.backdropEl = document.getElementById('modal-backdrop')!;
    this.inputEl = document.getElementById('quick-input') as HTMLInputElement;
    this.listEl = document.getElementById('quick-items-list')!;
    this.setupListeners();
  }

  public onOpenFile(cb: (path: string) => void) {
    this.onOpenFileCallback = cb;
  }

  public onGoToLine(cb: (line: number) => void) {
    this.onGoToLineCallback = cb;
  }

  public registerCommands(commands: QuickItem[]) {
    this.allCommands = commands;
  }

  public getAllCommands(): QuickItem[] {
    return this.allCommands;
  }

  public setFiles(files: { name: string; path: string }[]) {
    this.allFiles = files;
  }

  public showQuickOpen() {
    this.isCommandMode = false;
    this.isLineMode = false;
    this.inputEl.value = '';
    this.inputEl.placeholder = 'Type file name to open...';
    this.buildFileItems();
    this.filteredItems = this.items.slice(0, 50);
    this.selectedIndex = 0;
    this.open();
    this.renderList();
  }

  public showCommandPalette() {
    this.isCommandMode = true;
    this.isLineMode = false;
    this.inputEl.value = '>';
    this.inputEl.placeholder = 'Type a command to run...';
    this.items = this.allCommands;
    this.filterItems('');
    this.open();
    this.inputEl.setSelectionRange(1, 1);
  }

  public showGoToLine() {
    this.isCommandMode = false;
    this.isLineMode = true;
    this.inputEl.value = ':';
    this.inputEl.placeholder = 'Type a line number to navigate to...';
    this.filteredItems = [];
    this.open();
    this.inputEl.setSelectionRange(1, 1);
    this.renderList();
  }

  public showCustomPalette(placeholder: string, items: QuickItem[]) {
    this.isCommandMode = false;
    this.isLineMode = false;
    this.inputEl.value = '';
    this.inputEl.placeholder = placeholder;
    this.items = items;
    this.filterItems('');
    this.open();
  }

  private open() {
    this.backdropEl.style.display = 'flex';
    this.inputEl.focus();
  }

  public close() {
    this.backdropEl.style.display = 'none';
    this.inputEl.value = '';
  }

  private setupListeners() {
    this.backdropEl.onclick = (e) => {
      if (e.target === this.backdropEl) {
        this.close();
      }
    };

    this.inputEl.oninput = () => {
      const val = this.inputEl.value;
      if (val.startsWith('>')) {
        this.isCommandMode = true;
        this.isLineMode = false;
        this.items = this.allCommands;
        this.filterItems(val.substring(1).trim());
      } else if (val.startsWith(':')) {
        this.isCommandMode = false;
        this.isLineMode = true;
        const lineStr = val.substring(1).trim();
        if (lineStr && !isNaN(parseInt(lineStr, 10))) {
          const lineNum = parseInt(lineStr, 10);
          this.filteredItems = [
            {
              id: 'goto-line',
              label: `Go to line ${lineNum}`,
              icon: 'codicon-go-to-file',
              action: () => {
                if (this.onGoToLineCallback) this.onGoToLineCallback(lineNum);
              }
            }
          ];
        } else {
          this.filteredItems = [];
        }
        this.selectedIndex = 0;
        this.renderList();
      } else {
        this.isCommandMode = false;
        this.isLineMode = false;
        this.buildFileItems();
        this.filterItems(val.trim());
      }
    };

    this.inputEl.onkeydown = (e) => {
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.filteredItems.length);
        this.renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % Math.max(1, this.filteredItems.length);
        this.renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isLineMode) {
          const lineNum = parseInt(this.inputEl.value.replace(':', '').trim(), 10);
          if (!isNaN(lineNum) && this.onGoToLineCallback) {
            this.close();
            this.onGoToLineCallback(lineNum);
            return;
          }
        }
        if (this.filteredItems[this.selectedIndex]) {
          const item = this.filteredItems[this.selectedIndex];
          this.close();
          item.action();
        }
      }
    };
  }

  private buildFileItems() {
    this.items = this.allFiles.map((f) => ({
      id: f.path,
      label: f.name,
      detail: f.path,
      icon: this.getFileCodicon(f.name),
      action: () => {
        if (this.onOpenFileCallback) {
          this.onOpenFileCallback(f.path);
        }
      }
    }));
  }

  private filterItems(query: string) {
    if (!query) {
      this.filteredItems = this.items.slice(0, 50);
    } else {
      const q = query.toLowerCase();
      this.filteredItems = this.items
        .filter((item) => {
          const lbl = item.label.toLowerCase();
          const dtl = item.detail ? item.detail.toLowerCase() : '';
          return lbl.includes(q) || dtl.includes(q);
        })
        .slice(0, 50);
    }
    this.selectedIndex = 0;
    this.renderList();
  }

  private renderList() {
    this.listEl.innerHTML = '';
    if (this.filteredItems.length === 0) {
      this.listEl.innerHTML = '<div class="quick-item empty" style="cursor:default;opacity:0.6;padding:10px 14px;">No matching results</div>';
      return;
    }

    this.filteredItems.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `quick-item ${index === this.selectedIndex ? 'active' : ''}`;

      const left = document.createElement('div');
      left.className = 'quick-item-label';

      if (item.icon) {
        const icon = document.createElement('i');
        icon.className = `codicon ${item.icon}`;
        left.appendChild(icon);
      }

      const label = document.createElement('span');
      label.className = 'quick-item-name';
      label.textContent = item.label;
      left.appendChild(label);

      if (item.detail && item.detail !== item.label) {
        const detail = document.createElement('span');
        detail.className = 'quick-item-detail';
        detail.textContent = item.detail;
        left.appendChild(detail);
      }

      el.appendChild(left);

      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'quick-item-shortcut';
        sc.textContent = item.shortcut;
        el.appendChild(sc);
      }

      el.onclick = () => {
        this.close();
        item.action();
      };

      this.listEl.appendChild(el);
    });

    const activeEl = this.listEl.children[this.selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  private getFileCodicon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
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
