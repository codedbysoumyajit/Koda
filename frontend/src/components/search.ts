import { SearchAPI, SearchResponse, FileSearchResult } from '../services/api';

export class SearchManager {
  private isCaseSensitive: boolean = false;
  private isWholeWord: boolean = false;
  private isRegex: boolean = false;
  private currentWorkspace: string = '';
  private lastResults: SearchResponse | null = null;
  private onOpenMatchCallback?: (filePath: string, line: number) => void;

  constructor(
    private searchInput: HTMLInputElement,
    private replaceInput: HTMLInputElement,
    private includeInput: HTMLInputElement,
    private excludeInput: HTMLInputElement,
    private summaryEl: HTMLElement,
    private resultsTreeEl: HTMLElement,
    private badgeEl: HTMLElement
  ) {
    this.setupListeners();
  }

  public setWorkspace(path: string) {
    this.currentWorkspace = path;
  }

  public onOpenMatch(cb: (filePath: string, line: number) => void) {
    this.onOpenMatchCallback = cb;
  }

  public focus() {
    this.searchInput.focus();
    this.searchInput.select();
  }

  private setupListeners() {
    this.searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        this.runSearch();
      }
    };

    const toggleCaseBtn = document.getElementById('btn-toggle-case');
    if (toggleCaseBtn) {
      toggleCaseBtn.onclick = () => {
        this.isCaseSensitive = !this.isCaseSensitive;
        toggleCaseBtn.classList.toggle('active', this.isCaseSensitive);
        this.runSearch();
      };
    }

    const toggleWordBtn = document.getElementById('btn-toggle-word');
    if (toggleWordBtn) {
      toggleWordBtn.onclick = () => {
        this.isWholeWord = !this.isWholeWord;
        toggleWordBtn.classList.toggle('active', this.isWholeWord);
        this.runSearch();
      };
    }

    const toggleRegexBtn = document.getElementById('btn-toggle-regex');
    if (toggleRegexBtn) {
      toggleRegexBtn.onclick = () => {
        this.isRegex = !this.isRegex;
        toggleRegexBtn.classList.toggle('active', this.isRegex);
        this.runSearch();
      };
    }

    const detailsToggle = document.getElementById('search-details-toggle');
    const detailsPane = document.getElementById('search-details-pane');
    if (detailsToggle && detailsPane) {
      detailsToggle.onclick = () => {
        const isHidden = detailsPane.style.display === 'none';
        detailsPane.style.display = isHidden ? 'block' : 'none';
      };
    }

    const refreshBtn = document.getElementById('btn-refresh-search');
    if (refreshBtn) refreshBtn.onclick = () => this.runSearch();

    const clearBtn = document.getElementById('btn-clear-search');
    if (clearBtn) clearBtn.onclick = () => this.clear();

    const replaceAllBtn = document.getElementById('btn-replace-all');
    if (replaceAllBtn) replaceAllBtn.onclick = () => this.runReplaceAll();
  }

  public async runSearch() {
    const query = this.searchInput.value.trim();
    if (!query || !this.currentWorkspace) {
      this.clear();
      return;
    }

    this.summaryEl.style.display = 'block';
    this.summaryEl.textContent = 'Searching...';

    const resp = await SearchAPI.search(this.currentWorkspace, {
      query,
      isRegex: this.isRegex,
      isCaseSensitive: this.isCaseSensitive,
      isWholeWord: this.isWholeWord,
      filesToInclude: this.includeInput.value.trim(),
      filesToExclude: this.excludeInput.value.trim(),
      maxResults: 2000
    });

    this.lastResults = resp;
    this.renderResults(resp);
  }

  public async runReplaceAll() {
    const query = this.searchInput.value.trim();
    const replacement = this.replaceInput.value;
    if (!query || !this.currentWorkspace || !this.lastResults || this.lastResults.results.length === 0) {
      return;
    }

    const files = this.lastResults.results.map((r) => r.filePath);
    await SearchAPI.replaceAll(
      this.currentWorkspace,
      query,
      replacement,
      this.isRegex,
      this.isCaseSensitive,
      this.isWholeWord,
      files
    );

    this.runSearch();
  }

  public clear() {
    this.searchInput.value = '';
    this.replaceInput.value = '';
    this.summaryEl.style.display = 'none';
    this.resultsTreeEl.innerHTML = '';
    this.badgeEl.style.display = 'none';
    this.lastResults = null;
  }

  private renderResults(resp: SearchResponse) {
    if (resp.totalMatches === 0) {
      this.summaryEl.textContent = 'No results found.';
      this.resultsTreeEl.innerHTML = '';
      this.badgeEl.style.display = 'none';
      return;
    }

    this.summaryEl.textContent = `${resp.totalMatches} results in ${resp.totalFiles} files (${resp.durationMs}ms)`;
    this.badgeEl.style.display = 'block';
    this.badgeEl.textContent = String(resp.totalMatches);

    this.resultsTreeEl.innerHTML = '';
    for (const fileRes of resp.results) {
      const groupEl = document.createElement('div');
      groupEl.className = 'search-file-group';

      const header = document.createElement('div');
      header.className = 'search-file-header';
      header.innerHTML = `
        <i class="codicon codicon-chevron-down"></i>
        <i class="codicon codicon-file"></i>
        <span>${fileRes.fileName}</span>
        <span style="opacity:0.6;font-size:11px;">(${fileRes.matches.length})</span>
      `;

      const matchesContainer = document.createElement('div');
      matchesContainer.className = 'search-matches-list';

      for (const match of fileRes.matches) {
        const matchEl = document.createElement('div');
        matchEl.className = 'search-match-item';
        matchEl.innerHTML = `
          <span class="search-line-num">${match.lineNumber}:</span>
          <span class="search-snippet">${this.escapeHtml(match.lineContent)}</span>
        `;
        matchEl.onclick = () => {
          if (this.onOpenMatchCallback) {
            const fullPath = this.currentWorkspace + '/' + fileRes.filePath;
            this.onOpenMatchCallback(fullPath, match.lineNumber);
          }
        };
        matchesContainer.appendChild(matchEl);
      }

      header.onclick = () => {
        const isHidden = matchesContainer.style.display === 'none';
        matchesContainer.style.display = isHidden ? 'block' : 'none';
        header.querySelector('i.codicon')?.classList.toggle('codicon-chevron-right', !isHidden);
        header.querySelector('i.codicon')?.classList.toggle('codicon-chevron-down', isHidden);
      };

      groupEl.appendChild(header);
      groupEl.appendChild(matchesContainer);
      this.resultsTreeEl.appendChild(groupEl);
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
