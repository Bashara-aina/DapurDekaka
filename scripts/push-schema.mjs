#!/usr/bin/env node
/**
 * Non-interactive wrapper for `drizzle-kit push --force`.
 * Auto-confirms rename/create prompts by sending Enter (default = first option).
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = resolve(import.meta.dirname, '..');
const env = { ...process.env };

try {
  const raw = readFileSync(resolve(cwd, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
} catch {
  console.error('Could not read .env');
  process.exit(1);
}

const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
  cwd,
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let pendingConfirm = false;

function maybeConfirm() {
  if (pendingConfirm) return;
  pendingConfirm = true;
  setTimeout(() => {
    child.stdin.write('\n');
    pendingConfirm = false;
  }, 300);
}

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (
    text.includes('created or renamed') ||
    text.includes('❯') ||
    text.includes('Apply changes') ||
    text.includes('Do you want')
  ) {
    maybeConfirm();
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

// Safety: auto-confirm periodically in case prompts were missed
const ticker = setInterval(() => maybeConfirm(), 2000);
child.on('close', () => clearInterval(ticker));

// Stop after 3 minutes
setTimeout(() => {
  clearInterval(ticker);
  child.kill('SIGTERM');
  console.error('push-schema: timed out after 3 minutes');
  process.exit(1);
}, 180_000);
