// FILE: lib/auth/jwt.js
// Fungsi murni untuk membuat & memverifikasi token sesi (JWT) memakai `jose`.
// Tidak boleh meng-import modul Node (next/headers/db) supaya aman dipakai
// di middleware (Edge Runtime) yang tidak punya akses database.

import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '../env.js';

const SESSION_COOKIE = 'session';

function secretKey(secret) {
  return new TextEncoder().encode(secret);
}

// isi token: sub (user id), role, pv (password version untuk membatalkan sesi lama)
export function signSessionToken(payload, expiresInHours) {
  return new SignJWT({ role: payload.role, pv: payload.pv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(`${expiresInHours || 8}h`)
    .sign(secretKey(getEnv().authSecret));
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(getEnv().authSecret));
    return payload; // { sub, role, pv, exp, ... }
  } catch {
    return null; // token salah / kedaluwarsa / diutak-atik
  }
}

export function getCookieName() {
  return SESSION_COOKIE;
}