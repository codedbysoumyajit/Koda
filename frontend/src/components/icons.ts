// Comprehensive VS Code-style file and folder icon manager

export interface IconInfo {
  glyphClass: string;
  colorClass: string;
  color?: string;
}

export function getFolderIconInfo(folderName: string, isExpanded: boolean): IconInfo {
  const name = folderName.toLowerCase();
  const glyph = isExpanded ? 'codicon-folder-opened' : 'codicon-folder';

  switch (name) {
    case '.git':
    case '.github':
      return { glyphClass: glyph, colorClass: 'folder-icon-git', color: '#f05032' };
    case 'node_modules':
      return { glyphClass: isExpanded ? 'codicon-folder-opened' : 'codicon-folder-library', colorClass: 'folder-icon-node', color: '#8bc34a' };
    case 'src':
    case 'source':
    case 'sources':
    case 'app':
      return { glyphClass: glyph, colorClass: 'folder-icon-src', color: '#42a5f5' };
    case 'dist':
    case 'build':
    case 'bin':
    case 'out':
    case 'target':
      return { glyphClass: glyph, colorClass: 'folder-icon-build', color: '#ff9800' };
    case 'test':
    case 'tests':
    case '__tests__':
    case 'spec':
    case 'specs':
      return { glyphClass: glyph, colorClass: 'folder-icon-test', color: '#4caf50' };
    case 'public':
    case 'assets':
    case 'static':
    case 'images':
    case 'img':
    case 'media':
      return { glyphClass: glyph, colorClass: 'folder-icon-media', color: '#ab47bc' };
    case '.vscode':
    case '.koda':
    case '.astrocode':
    case '.idea':
      return { glyphClass: glyph, colorClass: 'folder-icon-config', color: '#00acc1' };
    case 'docs':
    case 'doc':
    case 'documentation':
      return { glyphClass: glyph, colorClass: 'folder-icon-docs', color: '#26a69a' };
    case 'components':
      return { glyphClass: glyph, colorClass: 'folder-icon-components', color: '#00bcd4' };
    case 'internal':
    case 'pkg':
      return { glyphClass: glyph, colorClass: 'folder-icon-go', color: '#00add8' };
    default:
      return { glyphClass: glyph, colorClass: 'folder-icon-default', color: '#dcb67a' };
  }
}

export function getFileIconInfo(filename: string): IconInfo {
  const lowerName = filename.toLowerCase();

  // 1. Exact full filename matches
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) {
    return { glyphClass: 'codicon-server', colorClass: 'file-icon-docker', color: '#2496ed' };
  }
  if (lowerName === 'docker-compose.yml' || lowerName === 'docker-compose.yaml') {
    return { glyphClass: 'codicon-server', colorClass: 'file-icon-docker', color: '#2496ed' };
  }
  if (lowerName === 'package.json') {
    return { glyphClass: 'codicon-package', colorClass: 'file-icon-npm', color: '#cb3837' };
  }
  if (
    lowerName === 'package-lock.json' ||
    lowerName === 'pnpm-lock.yaml' ||
    lowerName === 'yarn.lock' ||
    lowerName === 'cargo.lock'
  ) {
    return { glyphClass: 'codicon-lock', colorClass: 'file-icon-lock', color: '#e5c07b' };
  }
  if (lowerName === 'go.mod' || lowerName === 'go.sum' || lowerName === 'go.work') {
    return { glyphClass: 'codicon-package', colorClass: 'file-icon-go', color: '#00add8' };
  }
  if (lowerName === 'cargo.toml') {
    return { glyphClass: 'codicon-package', colorClass: 'file-icon-rust', color: '#dea584' };
  }
  if (
    lowerName === '.gitignore' ||
    lowerName === '.gitattributes' ||
    lowerName === '.gitmodules'
  ) {
    return { glyphClass: 'codicon-git-commit', colorClass: 'file-icon-git', color: '#f34f29' };
  }
  if (
    lowerName === 'makefile' ||
    lowerName === 'gnumakefile' ||
    lowerName === '.editorconfig' ||
    lowerName.startsWith('.env')
  ) {
    return { glyphClass: 'codicon-gear', colorClass: 'file-icon-config', color: '#e5c07b' };
  }
  if (lowerName === 'license' || lowerName === 'license.md' || lowerName === 'license.txt') {
    return { glyphClass: 'codicon-symbol-key', colorClass: 'file-icon-license', color: '#e5c07b' };
  }
  if (lowerName === 'readme.md' || lowerName === 'readme') {
    return { glyphClass: 'codicon-info', colorClass: 'file-icon-readme', color: '#42a5f5' };
  }

  // 2. Extension matches
  const ext = lowerName.split('.').pop() || '';

  switch (ext) {
    // Go
    case 'go':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-go', color: '#00add8' };

    // TypeScript / React
    case 'ts':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-ts', color: '#3178c6' };
    case 'tsx':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-react', color: '#61dafb' };

    // JavaScript / React
    case 'js':
    case 'mjs':
    case 'cjs':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-js', color: '#f7df1e' };
    case 'jsx':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-react', color: '#61dafb' };

    // Python
    case 'py':
    case 'pyw':
    case 'ipynb':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-python', color: '#3572a5' };

    // Rust
    case 'rs':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-rust', color: '#dea584' };

    // Web Frontend
    case 'html':
    case 'htm':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-html', color: '#e34c26' };
    case 'css':
      return { glyphClass: 'codicon-symbol-color', colorClass: 'file-icon-css', color: '#42a5f5' };
    case 'scss':
    case 'sass':
    case 'less':
      return { glyphClass: 'codicon-symbol-color', colorClass: 'file-icon-scss', color: '#c6538c' };
    case 'vue':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-vue', color: '#41b883' };
    case 'svelte':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-svelte', color: '#ff3e00' };

    // Data & Config
    case 'json':
    case 'jsonc':
      return { glyphClass: 'codicon-json', colorClass: 'file-icon-json', color: '#cbcb41' };
    case 'yml':
    case 'yaml':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-yaml', color: '#cb171e' };
    case 'toml':
    case 'ini':
    case 'cfg':
    case 'conf':
      return { glyphClass: 'codicon-gear', colorClass: 'file-icon-config', color: '#e5c07b' };
    case 'xml':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-xml', color: '#e38c00' };

    // Documentation & Markup
    case 'md':
    case 'markdown':
      return { glyphClass: 'codicon-markdown', colorClass: 'file-icon-markdown', color: '#42a5f5' };
    case 'txt':
    case 'log':
      return { glyphClass: 'codicon-file-text', colorClass: 'file-icon-text', color: '#8a9199' };
    case 'pdf':
      return { glyphClass: 'codicon-file-pdf', colorClass: 'file-icon-pdf', color: '#e53935' };

    // Systems & Compiled
    case 'c':
    case 'h':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-c', color: '#555555' };
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cxx':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-cpp', color: '#f34b7d' };
    case 'cs':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-csharp', color: '#178600' };
    case 'java':
    case 'jar':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-java', color: '#b07219' };
    case 'kt':
    case 'kts':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-kotlin', color: '#7f52ff' };
    case 'swift':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-swift', color: '#f05138' };
    case 'php':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-php', color: '#777bb4' };
    case 'rb':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-ruby', color: '#701516' };
    case 'lua':
      return { glyphClass: 'codicon-code', colorClass: 'file-icon-lua', color: '#000080' };

    // Shell & Scripts
    case 'sh':
    case 'bash':
    case 'zsh':
      return { glyphClass: 'codicon-terminal-bash', colorClass: 'file-icon-shell', color: '#89e051' };
    case 'ps1':
    case 'psm1':
      return { glyphClass: 'codicon-terminal-powershell', colorClass: 'file-icon-powershell', color: '#29b6f6' };

    // Database
    case 'sql':
    case 'prisma':
    case 'db':
    case 'sqlite':
      return { glyphClass: 'codicon-database', colorClass: 'file-icon-sql', color: '#e38c00' };

    // Media & Assets
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'bmp':
      return { glyphClass: 'codicon-file-media', colorClass: 'file-icon-image', color: '#a074c4' };
    case 'svg':
      return { glyphClass: 'codicon-file-media', colorClass: 'file-icon-svg', color: '#ff9900' };

    // Archives & Binaries
    case 'zip':
    case 'tar':
    case 'gz':
    case 'tgz':
    case '7z':
    case 'rar':
      return { glyphClass: 'codicon-file-zip', colorClass: 'file-icon-archive', color: '#d19a66' };
    case 'bin':
    case 'exe':
    case 'dll':
    case 'so':
    case 'dylib':
      return { glyphClass: 'codicon-file-binary', colorClass: 'file-icon-binary', color: '#607d8b' };

    // Default Fallback
    default:
      return { glyphClass: 'codicon-file', colorClass: 'file-icon-default', color: '#8a9199' };
  }
}
