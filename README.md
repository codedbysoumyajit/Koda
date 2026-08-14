# AstroCode 🚀

**AstroCode** is a lightweight, ultra-fast desktop code editor that is visually and behaviorally near-identical to Visual Studio Code, built in **Go using Wails v2** instead of Electron.

> **Elevator Pitch:** *"VS Code's UI and core workflow, Go's footprint."*

---

## ✨ Features

- **Monaco-Powered Editor Core**: Embedded Monaco editor providing rich syntax highlighting, IntelliSense, multi-cursor, bracket pair colorization, code folding, minimap, and diff editing.
- **Integrated Real PTY Terminal**: Spawns platform shells (bash/zsh/sh on Linux/macOS, PowerShell on Windows) via `github.com/creack/pty` streamed over Wails events to `xterm.js`.
- **Live File Explorer**: Full directory tree navigation, file/folder creation, renaming, deletion, reveal in system file manager, and real-time filesystem updates powered by `fsnotify`.
- **Git Integration (Source Control)**: Branch indicator, sync status (ahead/behind), status badges (`M`, `A`, `U`, `D`), side-by-side Monaco diff viewing, staging/unstaging, and commit shortcuts (`Ctrl+Enter`).
- **Global Search & Replace**: High-speed concurrent Go search across workspace files with Regex, Case Sensitive, Whole Word, and Include/Exclude glob filtering.
- **Command Palette & Quick Open**:
  - `Ctrl+P`: Quick Open file fuzzy switcher.
  - `Ctrl+Shift+P`: Command Palette with search across all IDE actions.
- **Settings & Theming**:
  - Pixel-accurate **VS Code Dark+** and **Light+** themes.
  - Visual settings editor and direct `~/.astrocode/settings.json` raw editor.
  - Configurable keybindings via `~/.astrocode/keybindings.json`.
- **Zero Bloat**: Single static binary (~11MB), zero telemetry, instant cold start (<1s), idle RAM well under 150MB.

---

## 🏗️ Architecture

```
astrocode/
├── main.go                      # Wails entrypoint & window configuration
├── app.go                       # Core App lifecycle & service registration
├── wails.json                   # Wails project config
├── internal/
│   ├── editorsvc/               # File I/O, tree traversal, fsnotify live watch
│   ├── termsvc/                 # PTY session management & real-time output stream
│   ├── gitsvc/                  # Shell-out Git operations (status, diff, stage, commit, branch)
│   ├── searchsvc/               # Fast concurrent workspace search & replace
│   └── settingssvc/             # Config loader/saver (~/.astrocode/settings.json, keybindings)
└── frontend/
    ├── src/
    │   ├── main.ts              # App bootstrap & event hub
    │   ├── style.css            # VS Code Dark+ / Light+ design system
    │   ├── services/api.ts      # Wails backend API bridge
    │   └── components/          # Monaco, Terminal, Explorer, Git, Search, QuickOpen, Settings
    ├── index.html
    └── vite.config.ts
```

---

## ⌨️ Keybindings

| Keybinding | Action |
|---|---|
| `Ctrl+P` | Quick Open (fuzzy file search) |
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+S` | Save active file |
| `Ctrl+Shift+S` | Save all files |
| `Ctrl+W` | Close active tab |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+` ` | Toggle Integrated Terminal / Bottom Panel |
| `Ctrl+Shift+` ` | New Terminal Session |
| `Ctrl+Shift+F` | Global Find in Files |
| `Ctrl+Shift+G` | Source Control / Git |
| `Ctrl+Shift+E` | File Explorer |
| `Ctrl+,` | Settings |

---

## 🛠️ Building & Running

### Prerequisites
- Go 1.20+
- Node.js 18+ & npm
- GTK3 and WebKitGTK (on Linux: `sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev` / Fedora: `gtk3-devel webkit2gtk4.1-devel`)

### Quick Build & Run (using Make)
```bash
make
./build/bin/astrocode
```

### Manual Build Steps
1. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. **Run Tests**:
   ```bash
   go test -v ./...
   ```

3. **Build Single Executable Binary**:
   ```bash
   mkdir -p build/bin
   # On Linux (WebKitGTK 4.1):
   go build -tags "desktop,production,webkit2_41" -o build/bin/astrocode .
   
   # On macOS / Windows:
   go build -tags "desktop,production" -o build/bin/astrocode .
   ```

4. **Launch AstroCode**:
   ```bash
   ./build/bin/astrocode
   ```
