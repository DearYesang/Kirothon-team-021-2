#!/usr/bin/env node
// Scans the repository for secrets before they get committed (used by .kiro/hooks/secret-guard.json).
// Prints only file names and the kind of secret, never the secret itself. Exit code 1 when something is found.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv']);
const BINARY = /\.(png|jpe?g|gif|webp|pdf|ico|zip)$/i;
const PATTERNS = [
  { kind: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { kind: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { kind: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { kind: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

function gitFiles() {
  try {
    const out = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return null; // not a git repo yet
  }
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(relative(ROOT, full));
  }
  return acc;
}

const files = gitFiles() ?? walk(ROOT);
const findings = [];
for (const file of files) {
  const name = basename(file);
  if (/^\.env(\..*)?$/.test(name) && name !== '.env.example') {
    findings.push(`${file}: .env 파일은 커밋하면 안 됩니다`);
    continue;
  }
  if (BINARY.test(file)) continue;
  let text;
  try {
    text = readFileSync(join(ROOT, file), 'utf8');
  } catch {
    continue;
  }
  for (const { kind, re } of PATTERNS) {
    if (re.test(text)) findings.push(`${file}: ${kind} 의심 문자열`);
  }
}

if (findings.length) {
  console.error('비밀정보 검사 실패:\n' + findings.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`비밀정보 검사 통과 (${files.length}개 파일)`);
