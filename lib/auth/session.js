// FILE: lib/auth/session.js
// Manajemen sesi login (Node runtime / server side).
// Sesi disimpan sebagai cookie httpOnly -> tidak bisa dibaca JavaScript browser,
// sehingga lebih aman dari serangan XSS.

import { cookies } from 'next/headers';
import { getEnv } from '../env.js';
import { getRepository } from '../db/index.js';
import { getCookieName, signSessionToken, verifySessionToken } from './jwt.js';

const TOKEN_HOURS = 12;

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, // JS browser tidak bisa baca cookie ini
    secure: isProd, // hanya dikirim lewat HTTPS saat production
    sameSite: 'lax', // lindungi dari serangan CSRF
    path: '/',
  };
}

// Buat token untuk user lalu simpan ke cookie
export async function createSession(user) {
  const env = getEnv();
  const hours = env.sessionHours || TOKEN_HOURS;
  const token = await signSessionToken(
    { sub: user.id, role: user.role, pv: user.passwordVersion },
    hours
  );
  const store = await cookies();
  store.set(getCookieName(), token, cookieOptions());
}

export async function destroySession() {
  const store = await cookies();
  store.delete(getCookieName());
}

export function getSessionToken(store) {
  return store.get(getCookieName())?.value;
}

// Ambil user yang sedang login BERDASARKAN database, bukan sekadar trust JWT.
// - token harus valid (tanda tangan + belum kedaluwarsa)
// - user harus masih ada, masih aktif, dan password belum di-reset
//   (password_version di token harus sama dengan di DB)
export async function getSessionUser() {
  const store = await cookies();
  const token = getSessionToken(store);
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const repo = getRepository();
  const user = await repo.findById(Number(payload.sub));
  if (!user) return null;
  if (!user.active) return null;
  if (user.passwordVersion !== Number(payload.pv)) return null;

  return user;
}