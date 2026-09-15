/**
 * One-shot codemod (audit #35): delete `console.error(TAG, err);` lines that
 * sit immediately before `return serverError(` — serverError() already emits
 * the single structured log line, so these are pure double-logging.
 * Run: node scripts/codemods/remove-double-log.mjs [--write]
 * Default is --dry (prints diff stats only).
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const WRITE = process.argv.includes('--write');
const files = execSync('grep -rln "console.error" app/api --include="*.ts"', {
  encoding: 'utf8',
}).split('\n').filter(Boolean);

let deleted = 0;
const touched = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const out = [];
  let fileDeleted = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*console\.error\(.*;\s*$/.test(line)) {
      const nxt = (lines[i + 1] ?? '').trim() === '' ? lines[i + 2] ?? '' : lines[i + 1] ?? '';
      if (nxt.includes('return serverError(')) {
        fileDeleted++;
        deleted++;
        continue; // drop the double-log line
      }
    }
    out.push(line);
  }
  if (fileDeleted > 0) {
    touched.push(`${f} (-${fileDeleted})`);
    if (WRITE) writeFileSync(f, out.join('\n'));
  }
}
console.log(`Would delete ${deleted} double-log lines in ${touched.length} files${WRITE ? ' (WRITTEN)' : ' (dry run)'}`);
for (const t of touched) console.log('  ' + t);
