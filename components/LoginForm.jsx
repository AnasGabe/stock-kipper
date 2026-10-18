'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import Spinner from './ui/Spinner';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setBusy(true);
    try {
      const result = await apiFetch('/api/login', { body: { email, password } });
      // langkah selesai: arahkan ke halaman tujuan (default dashboard)
      const next = searchParams.get('next') || '/';
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err.message || 'Login gagal. Periksa kembali email dan password Anda.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-brand-600 to-violet-700 px-4 py-10">
      <div className="w-full max-w-md">
        {/* logo / brand */}
        <div className="mb-6 flex flex-col items-center gap-3 text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Stok Hub</h1>
            <p className="text-sm text-indigo-100">Manajemen stok barang yang realtime dan aman</p>
          </div>
        </div>

        {/* kartu form */}
        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Masuk ke akun Anda</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hanya pengguna yang terdaftar oleh admin yang bisa masuk.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@perusahaan.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 pr-11 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.5 3.5M7.5 7.5A9.8 9.8 0 002 12a9.9 9.9 0 007 6 9.7 9.7 0 003.6 0M15.6 15.6A9.8 9.8 0 0022 12a9.9 9.9 0 00-7-6" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.5 12a9.8 9.8 0 0119.5 0 9.8 9.8 0 01-19.5 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Spinner className="h-4 w-4" />}
              {busy ? 'Memeriksa...' : 'Masuk'}
            </button>
          </form>

          {/* <p className="mt-5 text-center text-xs text-slate-400">
            Akun admin pertama dibuat lewat <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">npm run seed</code>
          </p> */}
        </div>
      </div>
    </div>
  );
}