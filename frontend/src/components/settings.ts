import { SettingsAPI, EditorSettings } from '../services/api';

export class SettingsManager {
  private currentSettings!: EditorSettings;
  private onSettingsChangeCallback?: (settings: EditorSettings) => void;
  private onOpenSettingsJSONCallback?: () => void;

  constructor(private container: HTMLElement) {
    this.setupListeners();
  }

  public onSettingsChange(cb: (settings: EditorSettings) => void) {
    this.onSettingsChangeCallback = cb;
  }

  public onOpenSettingsJSON(cb: () => void) {
    this.onOpenSettingsJSONCallback = cb;
  }

  private setupListeners() {
    const openJsonBtn = document.getElementById('btn-open-settings-json');
    if (openJsonBtn) {
      openJsonBtn.onclick = () => {
        if (this.onOpenSettingsJSONCallback) {
          this.onOpenSettingsJSONCallback();
        }
      };
    }
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
    this.container.innerHTML = `
      <div class="settings-section">
        <h4>Appearance</h4>
        <div class="setting-item">
          <label>Color Theme</label>
          <select id="setting-theme">
            <option value="vs-dark" ${s.theme === 'vs-dark' ? 'selected' : ''}>Dark+ (default dark)</option>
            <option value="vs-light" ${s.theme === 'vs-light' ? 'selected' : ''}>Light+ (default light)</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h4>Editor</h4>
        <div class="setting-item">
          <label>Font Size (px)</label>
          <input type="number" id="setting-fontsize" value="${s.fontSize}" min="8" max="40" />
        </div>

        <div class="setting-item">
          <label>Font Family</label>
          <input type="text" id="setting-fontfamily" value="${s.fontFamily}" />
        </div>

        <div class="setting-item">
          <label>Tab Size</label>
          <select id="setting-tabsize">
            <option value="2" ${s.tabSize === 2 ? 'selected' : ''}>2 Spaces</option>
            <option value="4" ${s.tabSize === 4 ? 'selected' : ''}>4 Spaces</option>
            <option value="8" ${s.tabSize === 8 ? 'selected' : ''}>8 Spaces</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Word Wrap</label>
          <select id="setting-wordwrap">
            <option value="on" ${s.wordWrap === 'on' ? 'selected' : ''}>on</option>
            <option value="off" ${s.wordWrap === 'off' ? 'selected' : ''}>off</option>
            <option value="wordWrapColumn" ${s.wordWrap === 'wordWrapColumn' ? 'selected' : ''}>wordWrapColumn</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Minimap</label>
          <select id="setting-minimap">
            <option value="true" ${s.minimap ? 'selected' : ''}>Enabled</option>
            <option value="false" ${!s.minimap ? 'selected' : ''}>Disabled</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Line Numbers</label>
          <select id="setting-linenumbers">
            <option value="on" ${s.lineNumbers === 'on' ? 'selected' : ''}>on</option>
            <option value="off" ${s.lineNumbers === 'off' ? 'selected' : ''}>off</option>
            <option value="relative" ${s.lineNumbers === 'relative' ? 'selected' : ''}>relative</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h4>Terminal</h4>
        <div class="setting-item">
          <label>Terminal Font Size (px)</label>
          <input type="number" id="setting-term-fontsize" value="${s.terminalFontSize}" min="8" max="40" />
        </div>

        <div class="setting-item">
          <label>Terminal Font Family</label>
          <input type="text" id="setting-term-fontfamily" value="${s.terminalFontFamily}" />
        </div>
      </div>

      <div class="settings-section">
        <h4>Window & Display (Linux)</h4>
        <div class="setting-item">
          <label>Display Backend</label>
          <select id="setting-gdk-backend">
            <option value="auto" ${s.gdkBackend === 'auto' || !s.gdkBackend ? 'selected' : ''}>Auto (Native bar on Wayland, AstroCode bar on X11)</option>
            <option value="wayland" ${s.gdkBackend === 'wayland' ? 'selected' : ''}>Wayland (Native window bar)</option>
            <option value="x11" ${s.gdkBackend === 'x11' ? 'selected' : ''}>X11 / XWayland (AstroCode custom title bar)</option>
          </select>
        </div>
        <div style="font-size: 11px; color: var(--fg-description); margin-top: 4px; line-height: 1.4;">
          Requires restarting AstroCode to take effect.
        </div>
      </div>

      <div class="settings-section">
        <button class="action-btn" id="btn-edit-settings-json">
          <i class="codicon codicon-json"></i> Edit in settings.json
        </button>
      </div>
    `;

    // Bind inputs
    const themeSelect = document.getElementById('setting-theme') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.onchange = () => this.updateSetting('theme', themeSelect.value);
    }

    const fontSizeInput = document.getElementById('setting-fontsize') as HTMLInputElement;
    if (fontSizeInput) {
      fontSizeInput.onchange = () => this.updateSetting('fontSize', parseInt(fontSizeInput.value, 10));
    }

    const fontFamilyInput = document.getElementById('setting-fontfamily') as HTMLInputElement;
    if (fontFamilyInput) {
      fontFamilyInput.onchange = () => this.updateSetting('fontFamily', fontFamilyInput.value);
    }

    const tabSizeSelect = document.getElementById('setting-tabsize') as HTMLSelectElement;
    if (tabSizeSelect) {
      tabSizeSelect.onchange = () => this.updateSetting('tabSize', parseInt(tabSizeSelect.value, 10));
    }

    const wordWrapSelect = document.getElementById('setting-wordwrap') as HTMLSelectElement;
    if (wordWrapSelect) {
      wordWrapSelect.onchange = () => this.updateSetting('wordWrap', wordWrapSelect.value);
    }

    const minimapSelect = document.getElementById('setting-minimap') as HTMLSelectElement;
    if (minimapSelect) {
      minimapSelect.onchange = () => this.updateSetting('minimap', minimapSelect.value === 'true');
    }

    const lineNumbersSelect = document.getElementById('setting-linenumbers') as HTMLSelectElement;
    if (lineNumbersSelect) {
      lineNumbersSelect.onchange = () => this.updateSetting('lineNumbers', lineNumbersSelect.value);
    }

    const termFontSizeInput = document.getElementById('setting-term-fontsize') as HTMLInputElement;
    if (termFontSizeInput) {
      termFontSizeInput.onchange = () => this.updateSetting('terminalFontSize', parseInt(termFontSizeInput.value, 10));
    }

    const termFontFamilyInput = document.getElementById('setting-term-fontfamily') as HTMLInputElement;
    if (termFontFamilyInput) {
      termFontFamilyInput.onchange = () => this.updateSetting('terminalFontFamily', termFontFamilyInput.value);
    }

    const gdkBackendSelect = document.getElementById('setting-gdk-backend') as HTMLSelectElement;
    if (gdkBackendSelect) {
      gdkBackendSelect.onchange = () => this.updateSetting('gdkBackend', gdkBackendSelect.value as any);
    }

    const editJsonBtn = document.getElementById('btn-edit-settings-json');
    if (editJsonBtn) {
      editJsonBtn.onclick = () => {
        if (this.onOpenSettingsJSONCallback) this.onOpenSettingsJSONCallback();
      };
    }
  }
}
