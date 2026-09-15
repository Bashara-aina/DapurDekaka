import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify } from 'otplib';

/**
 * TOTP two-factor authentication (otplib v13, RFC 6238).
 *
 * Compatible with Google Authenticator / Microsoft Authenticator / Authy
 * (SHA-1, 6 digits, 30s period — otplib defaults).
 *
 * Storage model (see drizzle/0052_add_two_factor_columns.sql):
 * - `users.twoFactorSecret` — TOTP secret, AES-256-GCM encrypted with a key
 *   derived from AUTH_SECRET. NEVER stored or logged in plaintext.
 * - `users.twoFactorEnabled` — gate checked in the Credentials `authorize()`.
 * - `users.twoFactorBackupCodes` — JSONB array of bcrypt hashes; each code is
 *   consumed (deleted) on first successful use.
 *
 * Clock drift: `epochTolerance: 30` accepts the previous/current/next step.
 */

export const TWO_FACTOR_ISSUER = 'Dapur Dekaka';
export const TWO_FACTOR_EPOCH_TOLERANCE_SEC = 30;
export const BACKUP_CODE_COUNT = 10;

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set (32+ chars) for 2FA secret encryption');
  }
  return crypto.createHash('sha256').update(`2fa-envelope:${secret}`).digest();
}

/**
 * Envelope-encrypt a TOTP secret. Returns `iv.ciphertext.tag` (base64 parts).
 * A fresh random IV per call — identical inputs produce different outputs.
 */
export function encryptTotpSecret(plaintextSecret: string): string {
  if (!plaintextSecret) throw new Error('Cannot encrypt an empty 2FA secret');
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextSecret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${ciphertext.toString('base64')}.${tag.toString('base64')}`;
}

/** Decrypts `encryptTotpSecret` output. Throws on tampering/wrong key. */
export function decryptTotpSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Malformed 2FA secret envelope');
  const [ivB64, ctB64, tagB64] = parts as [string, string, string];
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Fresh Base32 TOTP secret (un-padded — Google Authenticator compatible). */
export function newTotpSecret(): string {
  return generateSecret();
}

/** `otpauth://` URI for QR codes / manual entry. */
export function buildOtpauthUrl(secret: string, email: string): string {
  return generateURI({
    issuer: TWO_FACTOR_ISSUER,
    label: email,
    secret,
  });
}

/**
 * Verify a 6-digit TOTP code. Accepts surrounding whitespace; rejects
 * non-digit input without hitting the crypto path (timing hygiene).
 */
export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  const clean = token.replace(/[\s-]/g, '');
  if (!/^\d{6,8}$/.test(clean)) return false;
  try {
    const result = await verify({
      secret,
      token: clean,
      epochTolerance: TWO_FACTOR_EPOCH_TOLERANCE_SEC,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

function randomBackupCode(): string {
  // 5 random bytes → 8 hex chars, displayed as XXXX-XXXX.
  const raw = crypto.randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Normalize user input for comparison (`abcd-1234`, spaces, case). */
export function normalizeBackupCode(input: string): string {
  return input.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/** Generate fresh human-readable backup codes (display once, hash before store). */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(randomBackupCode());
  return [...codes];
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)));
}

/**
 * Check a backup code against stored hashes. Returns validity plus the
 * remaining hashes (caller persists `remaining` to consume the code).
 */
export async function consumeBackupCode(
  storedHashes: unknown,
  input: string
): Promise<{ valid: boolean; remaining: string[] }> {
  const hashes = Array.isArray(storedHashes)
    ? storedHashes.filter((h): h is string => typeof h === 'string')
    : [];
  const normalized = normalizeBackupCode(input);
  if (!normalized) return { valid: false, remaining: hashes };
  for (const hash of hashes) {
    try {
      if (await bcrypt.compare(normalized, hash)) {
        return { valid: true, remaining: hashes.filter((h) => h !== hash) };
      }
    } catch {
      // Corrupt hash entry — skip rather than fail open.
    }
  }
  return { valid: false, remaining: hashes };
}