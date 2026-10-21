import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, handleApiError, jsonOk, jsonError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page   = Number(searchParams.get('page') || 1);
    const limit  = Number(searchParams.get('limit') || 20);

    const repo = getRepository();
    const result = await repo.listRequests({ status, page, limit });
    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // Operator, staff, atau admin boleh buat request
    const body = await request.json();

    // Validasi minimal
    if (!body.jenis || !body.bkbKategori || !body.bkbDate || !body.keteranganType) {
      return jsonError('Data header tidak lengkap.', 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return jsonError('Minimal satu barang wajib diisi.', 400);
    }
    for (const line of body.items) {
      if (!line.itemId || !Number(line.qty) || Number(line.qty) <= 0 || !line.deptPemakai) {
        return jsonError('Setiap baris harus memiliki barang, QTY > 0, dan dept pemakai.', 400);
      }
    }

    const repo = getRepository();
    const result = await repo.createRequest(body, user);
    return jsonOk(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}