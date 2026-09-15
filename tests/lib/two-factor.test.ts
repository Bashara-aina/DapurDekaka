import { describe, it, expect, beforeAll } from 'vitest';
import { generate } from 'otplib';
import {
  encryptTotpSecret,
  decryptTotpSecret,
  newTotpSecret,
  buildOtpauthUrl,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  normalizeBackupCode,
} from '@/lib/auth/two-factor';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-chars-long!';
});

describe('two-factor (otplib v13 TOTP)', () => {
  it('encrypt/decrypt roundtrips the secret', () => {
    const secret = newTotpSecret();
    const enc = encryptTotpSecret(secret);
    expect(enc).not.toContain(secret);
    expect(decryptTotpSecret(enc)).toBe(secret);
  });

  it('encryption is non-deterministic (fresh IV)', () => {
    const secret = newTotpSecret();
    expect(encryptTotpSecret(secret)).not.toBe(encryptTotpSecret(secret));
  });

  it('tampered ciphertext fails closed', () => {
    const enc = encryptTotpSecret(newTotpSecret());
    const [iv, ct, tag] = enc.split('.');
    if (!iv || !ct || !tag) throw new Error('malformed test envelope');
    const tamperedCt = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    expect(() => decryptTotpSecret(`${iv}.${tamperedCt}.${tag}`)).toThrow();
    expect(() => decryptTotpSecret('not-an-envelope')).toThrow();
  });

  it('otpauth URL is well-formed for authenticator apps', () => {
    const url = buildOtpauthUrl('JBSWY3DPEHPK3PXP', 'user@example.com');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('JBSWY3DPEHPK3PXP');
    expect(url).toContain(encodeURIComponent('Dapur Dekaka'));
  });

  it('verifies a genuinely generated token', async () => {
    const secret = newTotpSecret();
    const token = await generate({ secret });
    expect(await verifyTotpCode(secret, token)).toBe(true);
  });

  it('rejects wrong codes and garbage input', async () => {
    const secret = newTotpSecret();
    expect(await verifyTotpCode(secret, '000000')).toBe(false);
    expect(await verifyTotpCode(secret, '')).toBe(false);
    expect(await verifyTotpCode(secret, 'abcdef')).toBe(false);
    expect(await verifyTotpCode(secret, '<script>')).toBe(false);
  });

  it('backup codes: generate → hash → consume once', async () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);

    const hashes = await hashBackupCodes(codes);
    expect(hashes).toHaveLength(10);
    const firstCode = codes[0];
    if (!firstCode || !hashes[0]) throw new Error('empty test fixtures');
    expect(hashes[0]).not.toContain(firstCode.replace('-', ''));

    const first = await consumeBackupCode(hashes, firstCode);
    expect(first.valid).toBe(true);
    expect(first.remaining).toHaveLength(9);

    // Double-spend fails against the remaining set.
    const replay = await consumeBackupCode(first.remaining, codes[0]!);
    expect(replay.valid).toBe(false);

    // Case/format tolerant.
    const secondCode = codes[1];
    if (!secondCode) throw new Error('empty test fixtures');
    const lower = await consumeBackupCode(first.remaining, secondCode.toLowerCase().replace('-', ' '));
    expect(lower.valid).toBe(true);
  });

  it('backup codes: wrong code fails, garbage store fails closed', async () => {
    const hashes = await hashBackupCodes(generateBackupCodes());
    expect((await consumeBackupCode(hashes, 'ZZZZ-9999')).valid).toBe(false);
    expect((await consumeBackupCode('not-an-array', 'ABCDEF12')).valid).toBe(false);
    expect((await consumeBackupCode([], 'ABCDEF12')).valid).toBe(false);
  });

  it('normalizeBackupCode strips separators and uppercases', () => {
    expect(normalizeBackupCode('ab12-cd34')).toBe('AB12CD34');
    expect(normalizeBackupCode('  ab 12 ')).toBe('AB12');
  });
});