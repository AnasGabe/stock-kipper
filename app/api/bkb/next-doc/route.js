// FILE: app/api/bkb/next-doc/route.js
// GET /api/bkb/next-doc?jenis=PB&kategori=4&date=2026-09-13
// → { docNo: "PB410-26I00001" }

import { getRepository } from '@/lib/db';
import { requireAuth, jsonOk, jsonError, handleApiError } from '@/lib/auth/guards';
import { JENIS_VALUES, CATEGORY_CODES, buildDocNoPrefix, buildDocNo } from '@/lib/constants/bkb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const url      = new URL(request.url);
  const jenis    = url.searchParams.get('jenis')?.trim().toUpperCase()    || '';
  const kategori = url.searchParams.get('kategori')?.trim()               || '';
  const date     = url.searchParams.get('date')?.trim()                   || '';

  if (!JENIS_VALUES.includes(jenis))    return jsonError('Jenis tidak valid.', 400);
  if (!CATEGORY_CODES.includes(kategori)) return jsonError('Kategori tidak valid.', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError('Tanggal harus YYYY-MM-DD.', 400);

  try {
    const prefix = buildDocNoPrefix(jenis, kategori, date);
    const urut   = await getRepository().nextDocSeq(prefix);
    return jsonOk({ docNo: buildDocNo(jenis, kategori, date, urut), urut });
  } catch (err) {
    return handleApiError(err, 'Gagal membuat nomor dokumen.');
  }
}
