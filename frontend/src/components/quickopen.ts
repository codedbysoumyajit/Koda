export interface QuickItem {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
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
  private allCommands: QuickItem[] = [];
  private allFiles: { name: string; path: string }[] = [];

  constructor() {
    this.backdropEl = document.getElementById('modal-backdrop')!;
    this.inputEl = document.getElementById('quick-input') as HTMLInputElement;
    this.listEl = document.getElementById('quick-items-list')!;
    this.setupListeners();
  }

  public registerCommands(commands: QuickItem[]) {
    this.allCommands = commands;
  }

  public setFiles(files: { name: string; path: string }[]) {
    this.allFiles = files;
  }

  public showQuickOpen() {
    this.isCommandMode = false;
    this.inputEl.value = '';
    this.inputEl.placeholder = 'Type file name to open...';
    this.buildFileItems();
    this.open();
  }

  public showCommandPalette() {
    this.isCommandMode = true;
    this.inputEl.value = '>';
    this.inputEl.placeholder = 'Type a command to run...';
    this.items = this.allCommands;
    this.filterItems('');
    this.open();
  }

  private open() {
    this.backdropEl.style.display = 'flex';
    this.inputEl.focus();
    if (this.isCommandMode) {
      this.inputEl.setSelectionRange(1, 1);
    }
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
        this.items = this.allCommands;
        this.filterItems(val.substring(1).trim());
      } else {
        this.isCommandMode = false;
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
      icon: 'codicon-file',
      action: () => {}
    }));
  }

  private filterItems(query: string) {
    if (!query) {
      this.filteredItems = this.items.slice(0, 50);
    } else {
      const q = query.toLowerCase();
      this.filteredItems = this.items
        .filter((item) => item.label.toLowerCase().includes(q) || (item.detail && item.detail.toLowerCase().includes(q)))
        .slice(0, 50);
    }
    this.selectedIndex = 0;
    this.renderList();
  }

  private renderList() {
    this.listEl.innerHTML = '';
    if (this.filteredItems.length === 0) {
      this.listEl.innerHTML = '<div class="quick-item" style="cursor:default;opacity:0.6;">No matching results</div>';
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
      label.textContent = item.label;
      left.appendChild(label);

      el.appendChild(left);

      if (item.detail) {
        const detail = document.createElement('div');
        detail.className = 'quick-item-detail';
        detail.textContent = item.detail;
        el.appendChild(detail);
      }

      el.onclick = () => {
        this.close();
        item.action();
      };

      this.listEl.appendChild(el);
    });

    // Scroll active item into view
    const activeEl = this.listEl.children[this.selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }
}
