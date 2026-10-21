import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { checkSameOrigin, jsonError } from '@/lib/auth/guards';
import { checkLoginAttempt, recordLoginFailure, recordLoginSuccess, clientIpKey } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const originCheck = checkSameOrigin(request);
  if (!originCheck.ok) return originCheck.error;

  let body;
  try { body = await request.json(); } catch { return jsonError('Format data tidak valid.', 400); }

  const { operatorId, pin } = body;
  if (!operatorId || !pin) return jsonError('Operator dan PIN wajib diisi.', 400);

  const ipKey = clientIpKey(request);
  const attempt = checkLoginAttempt(ipKey);
  if (!attempt.allowed) {
    return jsonError(`Terlalu banyak percobaan. Coba lagi dalam ${attempt.retryAfterSec} detik.`, 429);
  }

  const repo = getRepository();

  // Cari operator by ID lalu verifikasi PIN
  const { findById } = repo;
  const user = typeof repo.findById === 'function' ? await repo.findById(Number(operatorId)) : null;

  if (!user || user.role !== 'operator' || !user.active) {
    recordLoginFailure(ipKey);
    return jsonError('Operator tidak ditemukan atau tidak aktif.', 401);
  }

  // Verifikasi PIN
  const bcrypt = await import('bcryptjs');
  if (!user.passwordHash) {
    // Fallback: cek pin column (di mapUser, pin tidak di-map, perlu query langsung)
    recordLoginFailure(ipKey);
    return jsonError('PIN belum diatur. Hubungi administrator.', 401);
  }

  // PIN disimpan di kolom 'pin' — kita perlu query langsung karena mapUser tidak include pin
  const { createClient } = await import('@supabase/supabase-js');
  const { getEnv } = await import('@/lib/env');
  const env = getEnv();
  const sb = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });
  const { data: raw } = await sb.from('users').select('pin').eq('id', user.id).single();
  if (!raw?.pin) {
    recordLoginFailure(ipKey);
    return jsonError('PIN belum diatur untuk operator ini. Hubungi admin.', 401);
  }

  const match = await bcrypt.default.compare(String(pin), raw.pin);
  if (!match) {
    recordLoginFailure(ipKey);
    return jsonError('PIN salah.', 401);
  }

  recordLoginSuccess(ipKey);
  await createSession(user);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  });
}