/**
 * Round 2 (audit #35): convert remaining console.error in app/api to logger.
 * Shapes:
 *  C1/C2: console.error(TAG, err); before a hand-rolled 500 response
 *          → logger.error(TAG, { error })  [response already generic — safe]
 *  B:      .catch((e) => console.error(TAG, e)) → .catch((e) => logger.warn(...))
 *  B2:     .catch(console.error) → .catch((e) => logger.warn(...))
 *  A:      email fire-and-forget failures → logger.warn
 * Adds the logger import when missing. Dry run by default.
 * Run: node scripts/codemods/console-to-logger.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const WRITE = process.argv.includes('--write');
const files = execSync('grep -rln "console.error" app/api --include="*.ts"', {
  encoding: 'utf8',
}).split('\n').filter(Boolean);

const LOGGER_IMPORT = "import { logger } from '@/lib/utils/logger';";
let changed = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const orig = src;
  const needsLogger =
    src.includes('console.error') && !src.includes(LOGGER_IMPORT);

  // B2: .catch(console.error) → structured warn. Tag from file path.
  const tag = f.replace('app/api/', '').replace('/route.ts', '');
  src = src.replace(
    /\.catch\(console\.error\)/g,
    `.catch((e: unknown) => logger.warn('[${tag}] background task failed', { error: e instanceof Error ? e.message : String(e) }))`
  );

  // B: .catch((e) => console.error(TAG, e)) → logger.warn (secondary writes)
  src = src.replace(
    /\.catch\(\((\w+)\) => console\.error\(([^)]+)\)\)/g,
    (_m, v, args) => {
      const comma = args.indexOf(',');
      const tagArg = (comma >= 0 ? args.slice(0, comma) : args).trim();
      return `.catch((${v}: unknown) => logger.warn(${tagArg}, { error: ${v} instanceof Error ? ${v}.message : String(${v}) }))`;
    }
  );

  // C1/C2 + A: console.error(TAG, err); → logger.error/warn
  // Email failures (fire-and-forget, non-fatal) → warn; everything else → error.
  src = src.replace(
    /^(\s*)console\.error\(([^;]+)\);\s*$/gm,
    (_m, indent, args) => {
      const parts = args.split(/,(.+)/s);
      const first = (parts[0] ?? '').trim();
      const rest = (parts[1] ?? '').trim();
      const isEmail = /email/i.test(first);
      const level = isEmail ? 'warn' : 'error';
      const errExpr = rest || "'unknown'";
      const norm = /^error$|^err$|^e$|^emailError$/.test(errExpr)
        ? `{ error: ${errExpr} instanceof Error ? ${errExpr}.message : String(${errExpr}) }`
        : `{ error: ${errExpr} }`;
      return `${indent}logger.${level}(${first}, ${norm});`;
    }
  );

  if (needsLogger && src !== orig && src.includes('logger.')) {
    // Insert after the last top-level import.
    const lines = src.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import .+;?$/.test(lines[i])) lastImport = i;
      else if (lines[i].trim() !== '' && !lines[i].startsWith('import') && lastImport >= 0 && i > lastImport + 6) break;
    }
    // Simpler: insert before first non-import, non-empty line after imports.
    let idx = 0;
    while (idx < lines.length && (/^import\b/.test(lines[idx]) || lines[idx].trim() === '')) idx++;
    lines.splice(idx, 0, LOGGER_IMPORT);
    src = lines.join('\n');
  }

  if (src !== orig) {
    changed++;
    if (WRITE) writeFileSync(f, src);
    console.log(`${WRITE ? 'WROTE' : 'WOULD'} ${f}`);
  }
}
console.log(`\n${changed} files ${WRITE ? 'written' : 'would change'} (dry run without --write)`);
