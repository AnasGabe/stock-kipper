import { getRepository } from '@/lib/db';
import { requireAuth, requireRole, handleApiError, jsonOk, jsonError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    // Stock Keeper (staff) dan admin boleh verifikasi
    const roleErr = requireRole(user, ['admin', 'staff']);
    if (roleErr) return roleErr;

    const id   = Number(params.id);
    const body = await request.json();

    const repo = getRepository();
    const updated = await repo.verifyRequest(id, body, user);
    return jsonOk({ request: updated, message: 'Request berhasil diverifikasi.' });
  } catch (err) {
    return handleApiError(err);
  }
}