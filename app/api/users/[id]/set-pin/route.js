// POST /api/users/[id]/set-pin — set PIN untuk akun operator
// Hanya admin yang bisa set PIN

import { getRepository } from '@/lib/db';
import { requireAuth, requireRole, handleApiError, jsonOk, jsonError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const roleErr = requireRole(user, ['admin']);
    if (roleErr) return roleErr;

    const id   = Number(params.id);
    const body = await request.json();
    const pin  = String(body.pin || '').replace(/\D/g, '');

    if (pin.length !== 4) {
      return jsonError('PIN harus tepat 4 digit angka.', 400);
    }

    const repo = getRepository();
    const target = await repo.findById(id);
    if (!target) return jsonError('User tidak ditemukan.', 404);
    if (target.role !== 'operator') return jsonError('PIN hanya untuk role operator.', 400);

    // Hash PIN
    const bcrypt = await import('bcryptjs');
    const pinHash = await bcrypt.default.hash(pin, 10);

    // Update langsung via Supabase (tambah fungsi kecil)
    const { createClient } = await import('@supabase/supabase-js');
    const { getEnv } = await import('@/lib/env');
    const env = getEnv();
    const sb = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });

    const { error: upErr } = await sb
      .from('users')
      .update({ pin: pinHash, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (upErr) throw new Error(upErr.message);

    return jsonOk({ message: 'PIN berhasil diset.' });
  } catch (err) {
    return handleApiError(err);
  }
}