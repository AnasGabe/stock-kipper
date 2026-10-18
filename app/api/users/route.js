// FILE: app/api/users/route.js
// Manajemen user (KHUSUS ADMIN): daftar user (GET) & tambah user (POST).
// Membuat user = mendaftarkan user baru secara internal (tidak ada registrasi publik).

import { getRepository } from '@/lib/db';
import { createUserSchema } from '@/lib/validations/auth';
import { hashPassword } from '@/lib/auth/password';
import { isUniqueViolation } from '@/lib/utils';
import { requireAuth, requireRole, checkSameOrigin, jsonOk, jsonError, publicUser } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/users — daftar semua user
export async function GET() {
  const result = await requireAuth();
  if (result.error) return result.error;
  const roleCheck = requireRole(result.user, ['admin']);
  if (roleCheck.error) return roleCheck.error;

  try {
    const users = await getRepository().listUsers();
    return jsonOk({ data: users.map(publicUser) });
  } catch {
    return jsonError('Gagal memuat data user.', 500);
  }
}

// POST /api/users — buat user baru (role admin/staff)
export async function POST(request) {
  const originCheck = checkSameOrigin(request);
  if (!originCheck.ok) return originCheck.error;

  const result = await requireAuth();
  if (result.error) return result.error;
  const roleCheck = requireRole(result.user, ['admin']);
  if (roleCheck.error) return roleCheck.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Format data tidak valid.', 400);
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0].message, 400);
  }

  const repo = getRepository();

  // cegah email ganda
  const existing = await repo.findByEmail(parsed.data.email);
  if (existing) {
    return jsonError('Email sudah terdaftar.', 409);
  }

  try {
    // password selalu di-hash dulu sebelum disimpan
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await repo.createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    });
    return jsonOk({ data: publicUser(user), message: 'User berhasil dibuat.' }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError('Email sudah terdaftar.', 409);
    return jsonError('Gagal membuat user.', 500);
  }
}