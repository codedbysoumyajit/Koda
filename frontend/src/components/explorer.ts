import { EditorAPI, Events, FileNode } from '../services/api';

export class ExplorerManager {
  private currentTree: FileNode | null = null;
  private expandedPaths: Set<string> = new Set();
  private activeFilePath: string | null = null;
  private onOpenFileCallback?: (path: string) => void;
  private onContextMenuCallback?: (e: MouseEvent, node: FileNode) => void;

  constructor(
    private treeContainer: HTMLElement,
    private sectionTitleEl: HTMLElement
  ) {
    // Listen for live fsnotify file changes from backend
    Events.on('workspace:fs-change', () => {
      this.refresh();
    });
  }

  public onOpenFile(cb: (path: string) => void) {
    this.onOpenFileCallback = cb;
  }

  public onContextMenu(cb: (e: MouseEvent, node: FileNode) => void) {
    this.onContextMenuCallback = cb;
  }

  public setActiveFile(path: string | null) {
    this.activeFilePath = path;
    this.render();
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

  public render() {
    if (!this.currentTree) {
      this.treeContainer.innerHTML = `
        <div class="empty-workspace-guide">
          <p>You have not yet opened a folder.</p>
          <button class="action-btn" id="btn-open-folder-welcome-inner">Open Folder</button>
        </div>
      `;
      const btn = document.getElementById('btn-open-folder-welcome-inner');
      if (btn) {
        btn.onclick = async () => {
          const selected = await EditorAPI.openFolderDialog();
          if (selected) this.loadWorkspace(selected);
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
    nodeEl.className = `tree-node ${node.path === this.activeFilePath ? 'active' : ''}`;
    nodeEl.style.paddingLeft = `${depth * 14}px`;

    const content = document.createElement('div');
    content.className = 'tree-node-content';

    const icon = document.createElement('i');
    icon.className = 'codicon';

    if (node.isDir) {
      const isExpanded = this.expandedPaths.has(node.path);
      const chevron = document.createElement('i');
      chevron.className = `codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`;
      content.appendChild(chevron);

      icon.className = `codicon ${isExpanded ? 'codicon-folder-opened' : 'codicon-folder'}`;
    } else {
      icon.className = `codicon ${this.getFileCodicon(node.name)}`;
    }

    content.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    content.appendChild(nameSpan);

    nodeEl.appendChild(content);

    // Git badge if modified/added/untracked
    if (node.gitStatus) {
      const badge = document.createElement('span');
      badge.className = `tree-node-badge ${node.gitStatus}`;
      badge.textContent = node.gitStatus;
      nodeEl.appendChild(badge);
    }

    // Node click handlers
    nodeEl.onclick = async (e) => {
      e.stopPropagation();
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
        return 'codicon-code';
      case 'css':
      case 'scss':
        return 'codicon-paintcan';
      case 'go':
      case 'py':
      case 'rs':
      case 'c':
      case 'cpp':
        return 'codicon-file-code';
      case 'md':
        return 'codicon-markdown';
      default:
        return 'codicon-file';
    }
  }
}
