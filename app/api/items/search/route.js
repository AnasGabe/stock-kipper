// FILE: app/api/items/search/route.js
// Backend untuk autocomplete & Barcode Scanner di form BKB.
//   ?q=abc          -> daftar saran (kode/nama mengandung "abc")
//   ?code=XYZ123    -> pencocokan PERSIS kode (hasil scan barcode)
//   ?ids=1,2,3      -> saldo terbaru barang yang sudah dipilih di form

import { getRepository } from '@/lib/db';
import { searchSchema } from '@/lib/validations/items';
import { requireAuth, jsonOk, jsonError, handleApiError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const parsed = searchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError(parsed.error.errors[0].message, 400);
  const { q, code, ids } = parsed.data;

  try {
    const repo = getRepository();
    if (ids) return jsonOk({ data: await repo.findItemsByIds(ids.split(',').map(Number)) });
    if (code) return jsonOk({ data: await repo.findItemByCode(code) });
    return jsonOk({ data: await repo.searchItems(q, 8) });
  } catch (err) {
    return handleApiError(err, 'Gagal mencari barang.');
  }
}
