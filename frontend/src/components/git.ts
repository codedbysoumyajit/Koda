import { GitAPI, GitStatusResult, GitFile } from '../services/api';

export class GitManager {
  private currentRepoPath: string = '';
  private currentStatus: GitStatusResult | null = null;
  private onOpenDiffCallback?: (filePath: string, oldContent: string, newContent: string, staged: boolean) => void;
  private onBranchChangeCallback?: (branch: string, ahead: number, behind: number) => void;

  constructor(
    private commitInput: HTMLTextAreaElement,
    private stagedListEl: HTMLElement,
    private changesListEl: HTMLElement,
    private untrackedListEl: HTMLElement,
    private stagedCountEl: HTMLElement,
    private changesCountEl: HTMLElement,
    private untrackedCountEl: HTMLElement,
    private badgeEl: HTMLElement
  ) {
    this.setupListeners();
  }

  public onOpenDiff(cb: (filePath: string, oldContent: string, newContent: string, staged: boolean) => void) {
    this.onOpenDiffCallback = cb;
  }

  public onBranchChange(cb: (branch: string, ahead: number, behind: number) => void) {
    this.onBranchChangeCallback = cb;
  }

  public async setWorkspace(path: string) {
    this.currentRepoPath = path;
    await this.refresh();
  }

  private setupListeners() {
    const commitBtn = document.getElementById('btn-git-commit');
    if (commitBtn) {
      commitBtn.onclick = () => this.commit();
    }

    this.commitInput.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.commit();
      }
    };

    const refreshBtn = document.getElementById('btn-git-refresh');
    if (refreshBtn) refreshBtn.onclick = () => this.refresh();

    const stageAllBtn = document.getElementById('btn-git-stage-all');
    if (stageAllBtn) {
      stageAllBtn.onclick = async () => {
        if (this.currentRepoPath) {
          await GitAPI.stageAll(this.currentRepoPath);
          await this.refresh();
        }
      };
    }

    const unstageAllBtn = document.getElementById('btn-git-unstage-all');
    if (unstageAllBtn) {
      unstageAllBtn.onclick = async () => {
        if (this.currentRepoPath) {
          await GitAPI.unstageAll(this.currentRepoPath);
          await this.refresh();
        }
      };
    }
  }

  public async refresh() {
    if (!this.currentRepoPath) return;

    const isRepo = await GitAPI.isGitRepo(this.currentRepoPath);
    if (!isRepo) {
      this.currentStatus = null;
      this.badgeEl.style.display = 'none';
      if (this.onBranchChangeCallback) this.onBranchChangeCallback('', 0, 0);
      return;
    }

    const status = await GitAPI.getStatus(this.currentRepoPath);
    this.currentStatus = status;

    const totalChanges =
      status.stagedFiles.length + status.unstagedFiles.length + status.untrackedFiles.length;

    if (totalChanges > 0) {
      this.badgeEl.style.display = 'block';
      this.badgeEl.textContent = String(totalChanges);
    } else {
      this.badgeEl.style.display = 'none';
    }

    if (this.onBranchChangeCallback) {
      this.onBranchChangeCallback(status.branch, status.ahead, status.behind);
    }

    this.render();
  }

  public async commit() {
    const msg = this.commitInput.value.trim();
    if (!msg || !this.currentRepoPath) return;

    try {
      await GitAPI.commit(this.currentRepoPath, msg);
      this.commitInput.value = '';
      await this.refresh();
    } catch (e: any) {
      alert(`Commit error: ${e?.message || e}`);
    }
  }

  private render() {
    if (!this.currentStatus) {
      this.stagedListEl.innerHTML = '';
      this.changesListEl.innerHTML = '';
      this.untrackedListEl.innerHTML = '';
      return;
    }

    // Staged
    this.stagedCountEl.textContent = String(this.currentStatus.stagedFiles.length);
    this.stagedListEl.innerHTML = '';
    for (const file of this.currentStatus.stagedFiles) {
      this.renderFileItem(file, this.stagedListEl, true);
    }

    // Changes (Unstaged)
    this.changesCountEl.textContent = String(this.currentStatus.unstagedFiles.length);
    this.changesListEl.innerHTML = '';
    for (const file of this.currentStatus.unstagedFiles) {
      this.renderFileItem(file, this.changesListEl, false);
    }

    // Untracked
    this.untrackedCountEl.textContent = String(this.currentStatus.untrackedFiles.length);
    this.untrackedListEl.innerHTML = '';
    for (const file of this.currentStatus.untrackedFiles) {
      this.renderFileItem(file, this.untrackedListEl, false);
    }
  }

  private renderFileItem(file: GitFile, container: HTMLElement, staged: boolean) {
    const item = document.createElement('div');
    item.className = 'git-file-item';

    const left = document.createElement('div');
    left.className = 'git-file-left';

    const icon = document.createElement('i');
    icon.className = 'codicon codicon-file';

    const name = document.createElement('span');
    name.textContent = file.path;

    const badge = document.createElement('span');
    badge.className = `tree-node-badge ${file.status}`;
    badge.textContent = file.status;

    left.appendChild(icon);
    left.appendChild(name);
    left.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'git-file-actions';

    if (staged) {
      const unstageBtn = document.createElement('button');
      unstageBtn.className = 'icon-btn';
      unstageBtn.title = 'Unstage Changes';
      unstageBtn.innerHTML = '<i class="codicon codicon-remove"></i>';
      unstageBtn.onclick = async (e) => {
        e.stopPropagation();
        await GitAPI.unstageFile(this.currentRepoPath, file.path);
        await this.refresh();
      };
      actions.appendChild(unstageBtn);
    } else {
      const stageBtn = document.createElement('button');
      stageBtn.className = 'icon-btn';
      stageBtn.title = 'Stage Changes';
      stageBtn.innerHTML = '<i class="codicon codicon-add"></i>';
      stageBtn.onclick = async (e) => {
        e.stopPropagation();
        await GitAPI.stageFile(this.currentRepoPath, file.path);
        await this.refresh();
      };

      const discardBtn = document.createElement('button');
      discardBtn.className = 'icon-btn';
      discardBtn.title = 'Discard Changes';
      discardBtn.innerHTML = '<i class="codicon codicon-discard"></i>';
      discardBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Discard changes to ${file.path}?`)) {
          await GitAPI.discardChanges(this.currentRepoPath, file.path);
          await this.refresh();
        }
      };

      actions.appendChild(stageBtn);
      actions.appendChild(discardBtn);
    }

    item.appendChild(left);
    item.appendChild(actions);

    item.onclick = async () => {
      if (this.onOpenDiffCallback) {
        const diff = await GitAPI.getDiff(this.currentRepoPath, file.path, staged);
        this.onOpenDiffCallback(file.path, diff.oldContent, diff.newContent, staged);
      }
    };

    container.appendChild(item);
  }
}
