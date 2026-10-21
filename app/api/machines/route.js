import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, requireRole, handleApiError, jsonOk } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const repo = getRepository();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    if (q) {
      const machines = await repo.searchMachines(q, true);
      return jsonOk({ data: machines });
    }
    const machines = await repo.listMachines();
    return jsonOk({ data: machines });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const roleErr = requireRole(user, ['admin']);
    if (roleErr) return roleErr;

    const body = await request.json();
    if (!body.code?.trim() || !body.name?.trim()) {
      return NextResponse.json({ ok: false, error: 'Kode dan nama mesin wajib diisi.' }, { status: 400 });
    }
    const repo = getRepository();
    const machine = await repo.createMachine(body);
    return jsonOk({ machine }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
