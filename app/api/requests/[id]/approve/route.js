import { getRepository } from '@/lib/db';
import { requireAuth, requireRole, handleApiError, jsonOk } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    // Hanya admin (Data Entry) yang bisa approve final
    const roleErr = requireRole(user, ['admin']);
    if (roleErr) return roleErr;

    const id   = Number(params.id);
    const repo = getRepository();
    const result = await repo.approveRequest(id, user);
    return jsonOk({ ...result, message: `BKB ${result.docNo} berhasil dibuat dari request.` });
  } catch (err) {
    return handleApiError(err);
  }
}