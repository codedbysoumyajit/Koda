import { SettingsAPI, EditorSettings } from '../services/api';

interface SettingField {
  key: keyof EditorSettings;
  title: string;
  category: string;
  categoryName: string;
  description: string;
  type: 'select' | 'number' | 'text' | 'boolean';
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  note?: string;
}

const SETTING_DEFINITIONS: SettingField[] = [
  // Commonly Used
  {
    key: 'theme',
    title: 'Workbench: Color Theme',
    category: 'commonly-used',
    categoryName: 'Commonly Used',
    description: 'Specifies the color theme used in the workbench.',
    type: 'select',
    options: [
      { value: 'vs-dark', label: 'Dark+ (default dark)' },
      { value: 'vs-light', label: 'Light+ (default light)' }
    ]
  },
  {
    key: 'fontSize',
    title: 'Editor: Font Size',
    category: 'commonly-used',
    categoryName: 'Commonly Used',
    description: 'Controls the font size in pixels.',
    type: 'number',
    min: 8,
    max: 48
  },
  {
    key: 'fontFamily',
    title: 'Editor: Font Family',
    category: 'commonly-used',
    categoryName: 'Commonly Used',
    description: 'Controls the font family.',
    type: 'text'
  },
  {
    key: 'tabSize',
    title: 'Editor: Tab Size',
    category: 'commonly-used',
    categoryName: 'Commonly Used',
    description: 'The number of spaces a tab is equal to.',
    type: 'select',
    options: [
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' }
    ]
  },
  {
    key: 'wordWrap',
    title: 'Editor: Word Wrap',
    category: 'commonly-used',
    categoryName: 'Commonly Used',
    description: 'Controls how lines should wrap.',
    type: 'select',
    options: [
      { value: 'off', label: 'off (Lines will never wrap)' },
      { value: 'on', label: 'on (Lines will wrap at viewport width)' },
      { value: 'wordWrapColumn', label: 'wordWrapColumn (Lines wrap at editor column)' }
    ]
  },
  // Text Editor - Font
  {
    key: 'fontSize',
    title: 'Editor › Font: Size',
    category: 'editor-font',
    categoryName: 'Font',
    description: 'Controls the font size in pixels for all open text editors.',
    type: 'number',
    min: 8,
    max: 48
  },
  {
    key: 'fontFamily',
    title: 'Editor › Font: Family',
    category: 'editor-font',
    categoryName: 'Font',
    description: 'Controls the font family for all open text editors.',
    type: 'text'
  },
  // Text Editor - Formatting
  {
    key: 'tabSize',
    title: 'Editor › Formatting: Tab Size',
    category: 'editor-formatting',
    categoryName: 'Formatting',
    description: 'The number of spaces a tab is equal to. This setting is overridden based on the file contents when Detect Indentation is on.',
    type: 'select',
    options: [
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' }
    ]
  },
  {
    key: 'formatOnSave',
    title: 'Editor › Formatting: Format On Save',
    category: 'editor-formatting',
    categoryName: 'Formatting',
    description: 'Format a file on save. A formatter must be available, and the editor will format before saving.',
    type: 'boolean'
  },
  // Text Editor - Display
  {
    key: 'wordWrap',
    title: 'Editor › Display: Word Wrap',
    category: 'editor-display',
    categoryName: 'Display',
    description: 'Controls how lines should wrap in the code editor.',
    type: 'select',
    options: [
      { value: 'off', label: 'off' },
      { value: 'on', label: 'on' },
      { value: 'wordWrapColumn', label: 'wordWrapColumn' }
    ]
  },
  {
    key: 'minimap',
    title: 'Editor › Display: Minimap Enabled',
    category: 'editor-display',
    categoryName: 'Display',
    description: 'Controls whether the code overview minimap is shown on the right side.',
    type: 'boolean'
  },
  {
    key: 'lineNumbers',
    title: 'Editor › Display: Line Numbers',
    category: 'editor-display',
    categoryName: 'Display',
    description: 'Controls the display of line numbers in the gutter.',
    type: 'select',
    options: [
      { value: 'on', label: 'on (Render normal line numbers)' },
      { value: 'off', label: 'off (Do not render line numbers)' },
      { value: 'relative', label: 'relative (Render line numbers relative to cursor)' }
    ]
  },
  // Workbench - Appearance
  {
    key: 'theme',
    title: 'Workbench › Appearance: Color Theme',
    category: 'workbench-appearance',
    categoryName: 'Appearance',
    description: 'Specifies the color theme used in the workbench and code editors.',
    type: 'select',
    options: [
      { value: 'vs-dark', label: 'Dark+ (default dark)' },
      { value: 'vs-light', label: 'Light+ (default light)' }
    ]
  },
  // Files - Auto Save
  {
    key: 'autoSave',
    title: 'Files: Auto Save',
    category: 'files',
    categoryName: 'Files',
    description: 'Controls auto save of dirty editors. Can be configured to save after a delay or when switching tabs.',
    type: 'select',
    options: [
      { value: 'off', label: 'off (Never auto-save dirty files)' },
      { value: 'afterDelay', label: 'afterDelay (Auto-save after 1000ms delay)' },
      { value: 'onFocusChange', label: 'onFocusChange (Auto-save when editor loses focus)' },
      { value: 'onWindowChange', label: 'onWindowChange (Auto-save when Koda window loses focus)' }
    ]
  },
  // Window & Display
  {
    key: 'gdkBackend',
    title: 'Window › Display: Backend (Linux)',
    category: 'window-display',
    categoryName: 'Display & Titlebar',
    description: 'Controls whether Koda uses Wayland native window decorations or X11/XWayland custom title bar.',
    type: 'select',
    options: [
      { value: 'auto', label: 'Auto (Native bar on Wayland, Koda bar on X11)' },
      { value: 'wayland', label: 'Wayland (Always use native Wayland title bar)' },
      { value: 'x11', label: 'X11 / XWayland (Always use Koda custom title bar)' }
    ],
    note: 'Requires restarting Koda to take effect.'
  },
  // Terminal
  {
    key: 'terminalFontSize',
    title: 'Terminal › Integrated: Font Size',
    category: 'terminal',
    categoryName: 'Terminal',
    description: 'Controls the font size in pixels of the integrated terminal.',
    type: 'number',
    min: 8,
    max: 48
  },
  {
    key: 'terminalFontFamily',
    title: 'Terminal › Integrated: Font Family',
    category: 'terminal',
    categoryName: 'Terminal',
    description: 'Controls the font family of the integrated terminal.',
    type: 'text'
  },
  {
    key: 'terminalCursorBlink',
    title: 'Terminal › Integrated: Cursor Blinking',
    category: 'terminal',
    categoryName: 'Terminal',
    description: 'Controls whether the terminal cursor blinks.',
    type: 'boolean'
  }
];

export class SettingsManager {
  private currentSettings!: EditorSettings;
  private onSettingsChangeCallback?: (settings: EditorSettings) => void;
  private onOpenSettingsJSONCallback?: () => void;
  private activeCategory: string = 'commonly-used';
  private searchQuery: string = '';

  constructor(private container: HTMLElement) {}

  public onSettingsChange(cb: (settings: EditorSettings) => void) {
    this.onSettingsChangeCallback = cb;
  }

  public onOpenSettingsJSON(cb: () => void) {
    this.onOpenSettingsJSONCallback = cb;
  }

  public async init() {
    this.currentSettings = await SettingsAPI.getSettings();
    this.render();
  }

  public getSettings(): EditorSettings {
    return this.currentSettings;
  }

  private async updateSetting<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    this.currentSettings[key] = value;
    await SettingsAPI.saveSettings(this.currentSettings);
    if (this.onSettingsChangeCallback) {
      this.onSettingsChangeCallback(this.currentSettings);
    }
  }

  public render() {
    const s = this.currentSettings;
    if (!s) return;

    this.container.innerHTML = `
      <div class="settings-header">
        <div class="settings-search-container">
          <div class="settings-search-box">
            <i class="codicon codicon-search search-icon"></i>
            <input
              type="text"
              id="settings-search-input"
              class="settings-search-input"
              placeholder="Search settings"
              value="${this.escapeHtml(this.searchQuery)}"
              spellcheck="false"
              autocomplete="off"
            />
            <button id="settings-search-clear" class="settings-search-clear" title="Clear Search" style="display: ${this.searchQuery ? 'flex' : 'none'};">
              <i class="codicon codicon-close"></i>
            </button>
          </div>
          <div class="settings-header-actions">
            <button class="settings-action-btn" id="btn-settings-open-json" title="Open settings.json in Editor">
              <i class="codicon codicon-json"></i>
              <span>Open Settings (JSON)</span>
            </button>
          </div>
        </div>
        <div class="settings-tabs-bar">
          <button class="settings-tab-btn active">User</button>
          <button class="settings-tab-btn">Workspace</button>
        </div>
      </div>

      <div class="settings-container-body">
        <!-- Left Category TOC -->
        <div class="settings-toc">
          <div class="settings-toc-title">SETTINGS</div>
          <div class="settings-toc-item ${this.activeCategory === 'commonly-used' ? 'active' : ''}" data-cat="commonly-used">Commonly Used</div>
          <div class="settings-toc-group-title">Text Editor</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'editor-font' ? 'active' : ''}" data-cat="editor-font">Font</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'editor-formatting' ? 'active' : ''}" data-cat="editor-formatting">Formatting</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'editor-display' ? 'active' : ''}" data-cat="editor-display">Display</div>
          <div class="settings-toc-group-title">Workbench</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'workbench-appearance' ? 'active' : ''}" data-cat="workbench-appearance">Appearance</div>
          <div class="settings-toc-group-title">Files</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'files' ? 'active' : ''}" data-cat="files">Files</div>
          <div class="settings-toc-group-title">Window</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'window-display' ? 'active' : ''}" data-cat="window-display">Display & Titlebar</div>
          <div class="settings-toc-group-title">Features</div>
          <div class="settings-toc-item sub ${this.activeCategory === 'terminal' ? 'active' : ''}" data-cat="terminal">Terminal</div>
        </div>

        <!-- Right Settings Main Pane -->
        <div class="settings-main-pane" id="settings-main-pane">
          ${this.renderSettingsRows()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderSettingsRows(): string {
    const s = this.currentSettings;
    const query = this.searchQuery.trim().toLowerCase();

    // Filter items
    let filtered = SETTING_DEFINITIONS;
    if (query) {
      filtered = SETTING_DEFINITIONS.filter((def) => {
        return (
          def.title.toLowerCase().includes(query) ||
          def.description.toLowerCase().includes(query) ||
          def.categoryName.toLowerCase().includes(query) ||
          def.key.toLowerCase().includes(query)
        );
      });
    } else {
      filtered = SETTING_DEFINITIONS.filter((def) => def.category === this.activeCategory);
    }

    if (filtered.length === 0) {
      return `
        <div class="settings-empty">
          <i class="codicon codicon-search"></i>
          <div>No settings found matching "${this.escapeHtml(this.searchQuery)}"</div>
        </div>
      `;
    }

    // Group items by category if searching, else single section
    const groups = new Map<string, SettingField[]>();
    for (const item of filtered) {
      const groupName = query ? item.categoryName : (this.getCategoryTitle(this.activeCategory));
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(item);
    }

    let html = '';
    for (const [groupTitle, items] of groups.entries()) {
      html += `<div class="settings-group-header">${groupTitle}</div>`;
      for (const item of items) {
        html += this.renderSingleSetting(item, s);
      }
    }

    return html;
  }

  private renderSingleSetting(def: SettingField, s: EditorSettings): string {
    const val = s[def.key];
    const elementId = `setting-ctrl-${def.key}-${def.category}`;

    let controlHtml = '';

    if (def.type === 'select' && def.options) {
      controlHtml = `
        <select id="${elementId}" class="settings-select" data-key="${def.key}">
          ${def.options
            .map(
              (opt) => `
            <option value="${opt.value}" ${String(val) === String(opt.value) ? 'selected' : ''}>
              ${opt.label}
            </option>`
            )
            .join('')}
        </select>
      `;
    } else if (def.type === 'number') {
      controlHtml = `
        <input
          type="number"
          id="${elementId}"
          class="settings-input-number"
          data-key="${def.key}"
          value="${val ?? 14}"
          min="${def.min ?? 8}"
          max="${def.max ?? 48}"
        />
      `;
    } else if (def.type === 'text') {
      controlHtml = `
        <input
          type="text"
          id="${elementId}"
          class="settings-input-text"
          data-key="${def.key}"
          value="${this.escapeHtml(String(val ?? ''))}"
        />
      `;
    } else if (def.type === 'boolean') {
      controlHtml = `
        <label class="settings-checkbox-label">
          <input
            type="checkbox"
            id="${elementId}"
            class="settings-checkbox"
            data-key="${def.key}"
            ${val ? 'checked' : ''}
          />
          <span>${val ? 'Enabled' : 'Disabled'}</span>
        </label>
      `;
    }

    const noteHtml = def.note
      ? `<div class="setting-row-note"><i class="codicon codicon-info"></i> ${def.note}</div>`
      : '';

    return `
      <div class="setting-row" data-setting-key="${def.key}">
        <div class="setting-row-title">${def.title}</div>
        <div class="setting-row-description">${def.description}</div>
        <div class="setting-control">${controlHtml}</div>
        ${noteHtml}
      </div>
    `;
  }

  private bindEvents() {
    // Search input
    const searchInput = this.container.querySelector('#settings-search-input') as HTMLInputElement;
    const clearBtn = this.container.querySelector('#settings-search-clear') as HTMLElement;
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value;
        if (clearBtn) clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
        const pane = this.container.querySelector('#settings-main-pane');
        if (pane) {
          pane.innerHTML = this.renderSettingsRows();
          pane.scrollTop = 0;
        }
        this.bindSettingControls();
      };

      searchInput.onkeydown = (e) => {
        if (e.key === 'Escape') {
          this.searchQuery = '';
          searchInput.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          const pane = this.container.querySelector('#settings-main-pane');
          if (pane) {
            pane.innerHTML = this.renderSettingsRows();
            pane.scrollTop = 0;
          }
          this.bindSettingControls();
        }
      };
    }

    if (clearBtn && searchInput) {
      clearBtn.onclick = () => {
        this.searchQuery = '';
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
        const pane = this.container.querySelector('#settings-main-pane');
        if (pane) {
          pane.innerHTML = this.renderSettingsRows();
          pane.scrollTop = 0;
        }
        this.bindSettingControls();
      };
    }

    // Open settings.json button
    const openJsonBtn = this.container.querySelector('#btn-settings-open-json') as HTMLElement;
    if (openJsonBtn) {
      openJsonBtn.onclick = () => {
        if (this.onOpenSettingsJSONCallback) {
          this.onOpenSettingsJSONCallback();
        }
      };
    }

    // Category navigation
    const tocItems = this.container.querySelectorAll('.settings-toc-item[data-cat]');
    tocItems.forEach((item) => {
      item.addEventListener('click', () => {
        tocItems.forEach((ti) => ti.classList.remove('active'));
        item.classList.add('active');
        this.activeCategory = item.getAttribute('data-cat') || 'commonly-used';
        this.searchQuery = '';
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        const pane = this.container.querySelector('#settings-main-pane');
        if (pane) {
          pane.innerHTML = this.renderSettingsRows();
          pane.scrollTop = 0;
        }
        this.bindSettingControls();
      });
    });

    this.bindSettingControls();
  }

  private bindSettingControls() {
    const pane = this.container.querySelector('#settings-main-pane');
    if (!pane) return;

    // Select dropdowns
    pane.querySelectorAll('select.settings-select[data-key]').forEach((sel) => {
      (sel as HTMLSelectElement).onchange = () => {
        const key = sel.getAttribute('data-key') as keyof EditorSettings;
        let value: any = (sel as HTMLSelectElement).value;
        if (key === 'tabSize') value = parseInt(value, 10);
        this.updateSetting(key, value);
      };
    });

    // Number inputs
    pane.querySelectorAll('input.settings-input-number[data-key]').forEach((inp) => {
      (inp as HTMLInputElement).onchange = () => {
        const key = inp.getAttribute('data-key') as keyof EditorSettings;
        const val = parseInt((inp as HTMLInputElement).value, 10);
        if (!isNaN(val)) {
          this.updateSetting(key, val as any);
        }
      };
    });

    // Text inputs
    pane.querySelectorAll('input.settings-input-text[data-key]').forEach((inp) => {
      (inp as HTMLInputElement).onchange = () => {
        const key = inp.getAttribute('data-key') as keyof EditorSettings;
        this.updateSetting(key, (inp as HTMLInputElement).value as any);
      };
    });

    // Checkboxes
    pane.querySelectorAll('input.settings-checkbox[data-key]').forEach((chk) => {
      (chk as HTMLInputElement).onchange = () => {
        const key = chk.getAttribute('data-key') as keyof EditorSettings;
        const checked = (chk as HTMLInputElement).checked;
        const labelSpan = (chk as HTMLElement).parentElement?.querySelector('span');
        if (labelSpan) labelSpan.textContent = checked ? 'Enabled' : 'Disabled';
        this.updateSetting(key, checked as any);
      };
    });
  }

  private getCategoryTitle(cat: string): string {
    switch (cat) {
      case 'commonly-used':
        return 'Commonly Used';
      case 'editor-font':
        return 'Text Editor › Font';
      case 'editor-formatting':
        return 'Text Editor › Formatting';
      case 'editor-display':
        return 'Text Editor › Display';
      case 'workbench-appearance':
        return 'Workbench › Appearance';
      case 'files':
        return 'Files';
      case 'window-display':
        return 'Window & Display (Linux)';
      case 'terminal':
        return 'Terminal › Integrated';
      default:
        return 'Settings';
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
