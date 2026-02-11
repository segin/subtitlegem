const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.DS_Store']);
const SECRETS_PATTERNS = [
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\\-_]{35}/g },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key', regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
  { name: 'Generic Secret', regex: /(api_key|apikey|secret|token|password)['"]?\s*[:=]\s*['"]([a-zA-Z0-9_\-]{8,})['"]/gi }
];

const findings = [];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    SECRETS_PATTERNS.forEach(pattern => {
      // Reset lastIndex for global regexes to ensure we scan the whole file correctly if reused
      // (Though here we recreate regex or don't reuse the object state across files if we defined them outside loop?
      // Actually pattern.regex is global state if defined outside. Let's handle this.)
      pattern.regex.lastIndex = 0;

      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        findings.push({
          type: pattern.name,
          file: filePath,
          line: content.substring(0, match.index).split('\n').length,
          snippet: 'REDACTED',
          confidence: 'High'
        });
      }
    });
  } catch (e) {
    // ignore
  }
}

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (IGNORE_DIRS.has(file)) return;
    const filePath = path.join(dir, file);
    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walk(filePath);
        } else {
          scanFile(filePath);
        }
    } catch (e) {
        // ignore
    }
  });
}

walk('.');
console.log(JSON.stringify(findings, null, 2));
