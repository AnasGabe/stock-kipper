// FILE: app/api/bkb/route.js
// BKB — GET: semua role | POST: Admin DAN Staff (Stock Keeper)
// Perbedaan role: Staff tidak bisa kelola MASTER barang, tapi bisa input BKB.

import { getRepository } from '@/lib/db';
import { bkbSchema, bkbListSchema } from '@/lib/validations/bkb';
import { requireAuth, checkSameOrigin, jsonOk, jsonError, handleApiError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const params = {};
  for (const [k, v] of new URL(request.url).searchParams) if (v !== '') params[k] = v;
  const query = bkbListSchema.safeParse(params);
  if (!query.success) return jsonError(query.error.errors[0].message, 400);

  try {
    const { items, total } = await getRepository().listBkb(query.data);
    return jsonOk({
      data: items,
      meta: { total, page: query.data.page, limit: query.data.limit,
              totalPages: Math.max(1, Math.ceil(total / query.data.limit)) },
    });
  } catch (err) {
    return handleApiError(err, 'Gagal memuat daftar BKB.');
  }
}

export async function POST(request) {
  const originCheck = checkSameOrigin(request);
  if (!originCheck.ok) return originCheck.error;

  const result = await requireAuth();
  if (result.error) return result.error;
  // Staff DAN Admin sama-sama bisa input BKB
  // (yang membedakan hanya akses ke master barang, bukan ke BKB)

  let body;
  try { body = await request.json(); } catch { return jsonError('Format data tidak valid.', 400); }

  const parsed = bkbSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.errors[0].message, 400);

  try {
    const saved = await getRepository().createBkb(parsed.data, result.user);
    return jsonOk({ data: saved, message: `BKB ${saved.docNo} berhasil disimpan.` }, 201);
  } catch (err) {
    return handleApiError(err, 'Gagal menyimpan BKB.');
  }
}
