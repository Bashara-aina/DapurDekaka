'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ShieldCheck, ShieldOff, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { fetchWithCsrf } from '@/lib/utils/csrf-client';

type Phase = 'loading' | 'disabled' | 'setup' | 'enabled';

interface SetupData {
  qrDataUrl: string;
  manualKey: string;
}

export function TwoFactorCard() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/2fa/status');
      const json = await res.json();
      setPhase(json?.data?.enabled ? 'enabled' : 'disabled');
    } catch {
      setPhase('disabled');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function startSetup() {
    setBusy(true);
    try {
      const res = await fetchWithCsrf('/api/auth/2fa/setup', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Gagal memulai setup 2FA');
      setSetup({ qrDataUrl: json.data.qrDataUrl, manualKey: json.data.manualKey });
      setPhase('setup');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memulai setup 2FA');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetchWithCsrf('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Kode salah atau kedaluwarsa');
      setBackupCodes(json.data.backupCodes as string[]);
      setPhase('enabled');
      setSetup(null);
      setCode('');
      toast.success('2FA berhasil diaktifkan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kode salah atau kedaluwarsa');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const res = await fetchWithCsrf('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Gagal menonaktifkan 2FA');
      setPassword('');
      setShowDisable(false);
      setBackupCodes(null);
      await refreshStatus();
      toast.success('2FA dinonaktifkan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menonaktifkan 2FA');
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes() {
    setBusy(true);
    try {
      const res = await fetchWithCsrf('/api/auth/2fa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Gagal membuat kode baru');
      setBackupCodes(json.data.backupCodes as string[]);
      setPassword('');
      toast.success('Kode cadangan baru dibuat — kode lama tidak berlaku lagi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat kode baru');
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n')).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error('Gagal menyalin')
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
          {phase === 'enabled' ? (
            <ShieldCheck className="w-5 h-5 text-success" />
          ) : (
            <ShieldOff className="w-5 h-5 text-text-secondary" />
          )}
        </div>
        <div>
          <h2 className="font-display font-semibold text-text-primary">
            Autentikasi Dua Faktor (2FA)
          </h2>
          <p className="text-xs text-text-secondary">
            {phase === 'loading'
              ? 'Memuat status…'
              : phase === 'enabled'
                ? 'Aktif — akunmu dilindungi kode authenticator'
                : 'Nonaktif — aktifkan untuk keamanan ekstra'}
          </p>
        </div>
        <span
          className={cn(
            'ml-auto text-xs font-semibold px-2.5 py-1 rounded-full',
            phase === 'enabled' ? 'bg-success-light text-success' : 'bg-brand-cream text-text-secondary'
          )}
        >
          {phase === 'enabled' ? 'AKTIF' : 'NONAKTIF'}
        </span>
      </div>

      {phase === 'disabled' && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Dengan 2FA, setiap login membutuhkan kode 6 digit dari aplikasi authenticator
            (Google/Microsoft Authenticator, Authy) selain password.
          </p>
          <button
            onClick={startSetup}
            disabled={busy}
            className="h-11 px-5 bg-brand-red text-white text-sm font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
          >
            {busy ? 'Memproses…' : 'Aktifkan 2FA'}
          </button>
        </div>
      )}

      {phase === 'setup' && setup && (
        <form onSubmit={confirmSetup} className="space-y-4">
          <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
            <li>Pasang aplikasi authenticator di HP-mu.</li>
            <li>Pindai QR di bawah (atau masukkan kunci manual).</li>
            <li>Masukkan kode 6 digit yang muncul untuk verifikasi.</li>
          </ol>
          <div className="flex flex-col items-center gap-2 bg-brand-cream rounded-lg p-4">
            <Image src={setup.qrDataUrl} alt="QR kode 2FA" width={192} height={192} />
            <code className="text-xs bg-white px-3 py-1.5 rounded border border-brand-cream-dark break-all">
              {setup.manualKey}
            </code>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={12}
            className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 tracking-widest text-center text-lg"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPhase('disabled'); setSetup(null); setCode(''); }}
              className="h-11 px-5 border border-brand-cream-dark text-sm font-medium rounded-button hover:bg-brand-cream transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy || code.replace(/[\s-]/g, '').length < 6}
              className="flex-1 h-11 bg-brand-red text-white text-sm font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
            >
              {busy ? 'Memverifikasi…' : 'Verifikasi & Aktifkan'}
            </button>
          </div>
        </form>
      )}

      {backupCodes && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-amber-800">
              Kode cadangan — simpan sekarang, hanya ditampilkan sekali!
            </p>
            <button
              onClick={copyCodes}
              className="flex items-center gap-1 text-xs text-amber-700 hover:underline"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Disalin' : 'Salin'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-sm">
            {backupCodes.map((c) => (
              <div key={c} className="bg-white px-2 py-1 rounded border border-amber-100 text-center">
                {c}
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-2">
            Setiap kode hanya berlaku sekali — gunakan saat HP authenticator hilang.
          </p>
        </div>
      )}

      {phase === 'enabled' && (
        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowDisable((v) => !v)}
              className="h-10 px-4 border border-error/40 text-error text-sm font-medium rounded-button hover:bg-error-light transition-colors"
            >
              Nonaktifkan 2FA
            </button>
          </div>
          {showDisable ? (
            <div className="space-y-2 p-3 border border-brand-cream-dark rounded-lg">
              <p className="text-xs text-text-secondary">
                Masukkan password untuk konfirmasi. Menonaktifkan 2FA akan mengeluarkan semua sesi aktif.
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password saat ini"
                className="w-full h-10 px-3 border border-brand-cream-dark rounded-lg outline-none focus:border-brand-red text-sm"
              />
              <button
                onClick={disable}
                disabled={busy || !password}
                className="h-10 px-4 bg-error text-white text-sm font-bold rounded-button disabled:opacity-50"
              >
                {busy ? 'Memproses…' : 'Ya, nonaktifkan'}
              </button>
            </div>
          ) : (
            <details className="text-sm">
              <summary className="cursor-pointer text-text-secondary hover:text-text-primary flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Buat ulang kode cadangan
              </summary>
              <div className="mt-2 space-y-2 p-3 border border-brand-cream-dark rounded-lg">
                <p className="text-xs text-text-secondary">
                  Kode lama langsung tidak berlaku. Masukkan password untuk konfirmasi.
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password saat ini"
                  className="w-full h-10 px-3 border border-brand-cream-dark rounded-lg outline-none focus:border-brand-red text-sm"
                />
                <button
                  onClick={regenerateCodes}
                  disabled={busy || !password}
                  className="h-10 px-4 bg-admin-sidebar text-white text-sm font-medium rounded-button disabled:opacity-50"
                >
                  {busy ? 'Memproses…' : 'Buat kode baru'}
                </button>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}