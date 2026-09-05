import { EditorAPI, Events, FileNode } from '../services/api';

export class ExplorerManager {
  private currentTree: FileNode | null = null;
  private expandedPaths: Set<string> = new Set();
  private activeFilePath: string | null = null;
  private selectedPath: string | null = null;
  private isSectionCollapsed: boolean = false;
  private inlineInputActive: boolean = false;

  private onOpenFileCallback?: (path: string) => void;
  private onContextMenuCallback?: (e: MouseEvent, node: FileNode) => void;
  private onOpenFolderCallback?: () => void;
  private onTerminalAtFolderCallback?: (path: string) => void;

  constructor(
    private treeContainer: HTMLElement,
    private sectionTitleEl: HTMLElement
  ) {
    // Listen for live fsnotify file changes from backend
    Events.on('workspace:fs-change', () => {
      this.refresh();
    });

    // Workspace section header click toggles expand/collapse
    this.sectionTitleEl.parentElement?.addEventListener('click', () => {
      this.isSectionCollapsed = !this.isSectionCollapsed;
      const chevron = this.sectionTitleEl.parentElement?.querySelector('.codicon') as HTMLElement;
      if (chevron) {
        chevron.className = `codicon ${this.isSectionCollapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}`;
      }
      this.treeContainer.style.display = this.isSectionCollapsed ? 'none' : 'block';
    });
  }

  public onOpenFile(cb: (path: string) => void) {
    this.onOpenFileCallback = cb;
  }

  public onContextMenu(cb: (e: MouseEvent, node: FileNode) => void) {
    this.onContextMenuCallback = cb;
  }

  public onOpenFolder(cb: () => void) {
    this.onOpenFolderCallback = cb;
  }

  public onTerminalAtFolder(cb: (path: string) => void) {
    this.onTerminalAtFolderCallback = cb;
  }

  public setActiveFile(path: string | null) {
    this.activeFilePath = path;
    this.render();
  }

  public getSelectedPath(): string {
    if (this.selectedPath) return this.selectedPath;
    if (this.currentTree) return this.currentTree.path;
    return '';
  }

  public async loadWorkspace(rootPath: string) {
    const tree = await EditorAPI.getDirectoryTree(rootPath);
    if (!tree) return;
    this.currentTree = tree;
    this.sectionTitleEl.textContent = tree.name.toUpperCase();
    this.expandedPaths.add(tree.path);
    this.render();
  }

  public async refresh() {
    const current = await EditorAPI.getCurrentWorkspace();
    if (current) {
      const tree = await EditorAPI.getDirectoryTree(current);
      if (tree) {
        this.currentTree = tree;
        this.render();
      }
    }
  }

  public collapseAll() {
    if (this.currentTree) {
      this.expandedPaths.clear();
      this.expandedPaths.add(this.currentTree.path);
      this.render();
    }
  }

  public startInlineCreate(isDir: boolean) {
    if (!this.currentTree || this.inlineInputActive) return;
    this.inlineInputActive = true;

    const targetDir = this.selectedPath && this.expandedPaths.has(this.selectedPath)
      ? this.selectedPath
      : this.currentTree.path;

    const promptContainer = document.createElement('div');
    promptContainer.className = 'tree-node inline-input-node';
    promptContainer.style.paddingLeft = '20px';

    const icon = document.createElement('i');
    icon.className = `codicon ${isDir ? 'codicon-folder' : 'codicon-file'}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-input';
    input.placeholder = isDir ? 'Folder name...' : 'File name...';

    promptContainer.appendChild(icon);
    promptContainer.appendChild(input);

    this.treeContainer.insertBefore(promptContainer, this.treeContainer.firstChild);
    input.focus();

    const finish = async (commit: boolean) => {
      if (!this.inlineInputActive) return;
      this.inlineInputActive = false;
      const val = input.value.trim();
      promptContainer.remove();

      if (commit && val) {
        const fullPath = `${targetDir}/${val}`;
        if (isDir) {
          await EditorAPI.createFolder(fullPath);
        } else {
          await EditorAPI.createFile(fullPath);
          if (this.onOpenFileCallback) {
            this.onOpenFileCallback(fullPath);
          }
        }
        await this.refresh();
      }
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        finish(true);
      } else if (e.key === 'Escape') {
        finish(false);
      }
    };

    input.onblur = () => {
      finish(true);
    };
  }

  public render() {
    if (!this.currentTree) {
      this.treeContainer.innerHTML = `
        <div class="empty-workspace-guide">
          <p>You have not yet opened a folder.</p>
          <button class="action-btn" id="btn-open-folder-welcome">
            <i class="codicon codicon-folder-opened"></i> Open Folder
          </button>
        </div>
      `;
      const btn = this.treeContainer.querySelector('#btn-open-folder-welcome') as HTMLElement;
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (this.onOpenFolderCallback) {
            this.onOpenFolderCallback();
          }
        };
      }
      return;
    }

    this.treeContainer.innerHTML = '';
    if (this.currentTree.children) {
      for (const child of this.currentTree.children) {
        this.renderNode(child, this.treeContainer, 1);
      }
    }
  }

  private renderNode(node: FileNode, container: HTMLElement, depth: number) {
    const nodeEl = document.createElement('div');
    const isSelected = node.path === this.selectedPath;
    const isActive = node.path === this.activeFilePath;
    nodeEl.className = `tree-node ${isActive ? 'active' : ''} ${isSelected && !isActive ? 'selected' : ''}`;
    nodeEl.style.paddingLeft = `${depth * 14}px`;

    const content = document.createElement('div');
    content.className = 'tree-node-content';

    const icon = document.createElement('i');
    icon.className = 'codicon';

    if (node.isDir) {
      const isExpanded = this.expandedPaths.has(node.path);
      const chevron = document.createElement('i');
      chevron.className = `codicon tree-chevron ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`;
      content.appendChild(chevron);

      icon.className = `codicon ${isExpanded ? 'codicon-folder-opened' : 'codicon-folder'} folder-icon`;
    } else {
      icon.className = `codicon ${this.getFileCodicon(node.name)} file-icon`;
    }

    content.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-node-name';
    nameSpan.textContent = node.name;
    content.appendChild(nameSpan);

    nodeEl.appendChild(content);

    // Git status badge
    if (node.gitStatus) {
      const badge = document.createElement('span');
      badge.className = `tree-node-badge ${node.gitStatus}`;
      badge.textContent = node.gitStatus;
      nodeEl.appendChild(badge);
    }

    // Node click handlers
    nodeEl.onclick = async (e) => {
      e.stopPropagation();
      this.selectedPath = node.path;

      if (node.isDir) {
        if (this.expandedPaths.has(node.path)) {
          this.expandedPaths.delete(node.path);
        } else {
          this.expandedPaths.add(node.path);
          if (!node.children || node.children.length === 0) {
            const sub = await EditorAPI.getSubTree(node.path);
            node.children = sub;
          }
        }
        this.render();
      } else {
        if (this.onOpenFileCallback) {
          this.onOpenFileCallback(node.path);
        }
      }
    };

    nodeEl.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectedPath = node.path;
      if (this.onContextMenuCallback) {
        this.onContextMenuCallback(e, node);
      }
    };

    container.appendChild(nodeEl);

    // Render children if directory is expanded
    if (node.isDir && this.expandedPaths.has(node.path) && node.children) {
      for (const child of node.children) {
        this.renderNode(child, container, depth + 1);
      }
    }
  }

  public getFileCodicon(filename: string): string {
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
