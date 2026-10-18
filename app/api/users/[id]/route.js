// FILE: app/api/users/[id]/route.js
// Manajemen user (KHUSUS ADMIN): edit (PUT) & hapus (DELETE).

import { getRepository } from '@/lib/db';
import { updateUserSchema } from '@/lib/validations/auth';
import { requireAuth, requireRole, checkSameOrigin, jsonOk, jsonError, publicUser } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PUT /api/users/1 — ubah nama, role, dan status aktif
export async function PUT(request, { params }) {
  const originCheck = checkSameOrigin(request);
  if (!originCheck.ok) return originCheck.error;

  const result = await requireAuth();
  if (result.error) return result.error;
  const roleCheck = requireRole(result.user, ['admin']);
  if (roleCheck.error) return roleCheck.error;

  const { id } = await params;
  const targetId = parseId(id);
  if (!targetId) return jsonError('ID tidak valid.', 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Format data tidak valid.', 400);
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0].message, 400);
  }

  const repo = getRepository();
  const target = await repo.findById(targetId);
  if (!target) return jsonError('User tidak ditemukan.', 404);

  const isSelf = targetId === result.user.id;
  const removingAdminStatus = target.role === 'admin' && parsed.data.role !== 'admin';
  const deactivating = !parsed.data.active;
  const adminCount = await repo.countByRole('admin');

  // keamanan: tidak boleh menonaktifkan/menurunkan role diri sendiri
  if (isSelf && (removingAdminStatus || deactivating)) {
    return jsonError('Anda tidak bisa menonaktifkan atau menurunkan role diri sendiri.', 400);
  }

  // keamanan: harus selalu ada minimal satu admin aktif
  if ((removingAdminStatus || (target.role === 'admin' && deactivating)) && adminCount <= 1) {
    return jsonError('Setidaknya harus ada satu admin yang tetap aktif.', 400);
  }

  try {
    const updated = await repo.updateUser(targetId, parsed.data);
    return jsonOk({ data: publicUser(updated), message: 'Data user berhasil diubah.' });
  } catch {
    return jsonError('Gagal mengubah data user.', 500);
  }
}

// DELETE /api/users/1 — hapus user
export async function DELETE(request, { params }) {
  const originCheck = checkSameOrigin(request);
  if (!originCheck.ok) return originCheck.error;

  const result = await requireAuth();
  if (result.error) return result.error;
  const roleCheck = requireRole(result.user, ['admin']);
  if (roleCheck.error) return roleCheck.error;

  const { id } = await params;
  const targetId = parseId(id);
  if (!targetId) return jsonError('ID tidak valid.', 400);

  const repo = getRepository();

  // tidak boleh menghapus diri sendiri
  if (targetId === result.user.id) {
    return jsonError('Anda tidak bisa menghapus akun sendiri.', 400);
  }

  const target = await repo.findById(targetId);
  if (!target) return jsonError('User tidak ditemukan.', 404);

  // harus ada minimal satu admin tersisa
  if (target.role === 'admin' && (await repo.countByRole('admin')) <= 1) {
    return jsonError('Setidaknya harus ada satu admin yang tetap aktif.', 400);
  }

  try {
    await repo.deleteUser(targetId);
    return jsonOk({ message: 'User berhasil dihapus.' });
  } catch {
    return jsonError('Gagal menghapus user.', 500);
  }
}