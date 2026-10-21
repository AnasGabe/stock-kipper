import { getRepository } from '@/lib/db';
import { requireAuth, handleApiError, jsonOk, jsonError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const itemId = Number(searchParams.get('itemId'));
    if (!itemId) return jsonError('itemId wajib.', 400);

    const repo = getRepository();
    const result = await repo.itemRunningSaldo(itemId);
    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}