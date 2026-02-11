const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.DS_Store']);
const EXTENSIONS = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript React',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript React',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.css': 'CSS',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.html': 'HTML',
  '.sh': 'Shell'
};

const metrics = {
  files: 0,
  loc: {},
  languages: {},
  artifacts: []
};

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (e) {
    return 0;
  }
}

function scanDir(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    if (IGNORE_DIRS.has(item)) continue;

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else {
      metrics.files++;
      const ext = path.extname(item);
      const lang = EXTENSIONS[ext] || 'Other';

      const lines = countLines(fullPath);

      metrics.loc[lang] = (metrics.loc[lang] || 0) + lines;
      metrics.languages[lang] = (metrics.languages[lang] || 0) + 1;

      // Top level artifacts check
      if (dir === '.') {
        metrics.artifacts.push(item);
      }
    }
  }
}

scanDir('.');

console.log(JSON.stringify(metrics, null, 2));
