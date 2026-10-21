import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, requireRole, handleApiError, jsonOk, jsonError } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const roleErr = requireRole(user, ['admin']);
    if (roleErr) return roleErr;

    const id = Number(params.id);
    const body = await request.json();
    if (!body.code?.trim() || !body.name?.trim()) {
      return jsonError('Kode dan nama mesin wajib diisi.', 400);
    }
    const repo = getRepository();
    const machine = await repo.updateMachine(id, body);
    return jsonOk({ machine });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const roleErr = requireRole(user, ['admin']);
    if (roleErr) return roleErr;

    const id = Number(params.id);
    const repo = getRepository();
    await repo.deleteMachine(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
