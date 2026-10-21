'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { useRealtimeSWR } from '@/hooks/useRealtimeSWR';
import { swrFetcher, apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import { formatNumber } from '@/lib/utils';
import { JENIS_TRANSAKSI, REQUEST_STATUS } from '@/lib/constants/bkb';

const statusColor = {
  menunggu:      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  terverifikasi: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  selesai:       'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

function Badge({ status }) {
  const label = REQUEST_STATUS[status]?.label || status;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[status] || ''}`}>
      {label}
    </span>
  );
}

function RequestCard({ req, user, onRefresh }) {
  const toast   = useToast();
  const [open,  setOpen]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  // Edit mode (SK)
  const [editLines, setEditLines] = useState(null);
  const [notes, setNotes] = useState('');

  function startEdit() {
    setEditLines(req.items.map((it) => ({ ...it, qtyEdit: String(it.qty) })));
    setNotes(req.notes || '');
    setOpen(true);
  }

  async function handleVerify() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/requests/${req.id}/verify`, {
        body: {
          items: (editLines || req.items).map((l) => ({
            id: l.id,
            itemId: l.itemId,
            qty: Number(l.qtyEdit ?? l.qty),
            deptPemakai: l.deptPemakai,
            deptProses: l.deptProses,
          })),
          notes,
        },
      });
      toast('Request berhasil diverifikasi.');
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Gagal memverifikasi.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (busy) return;
    if (!confirm(`Yakin approve request ${req.docNo} dan buat BKB?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/requests/${req.id}/approve`, { body: {} });
      toast(res.message || `BKB ${res.docNo} berhasil dibuat.`);
      mutate((k) => typeof k === 'string' && k.startsWith('/api/'));
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Gagal approve.');
    } finally {
      setBusy(false);
    }
  }

  const canVerify  = ['admin', 'staff'].includes(user?.role) && req.status === 'menunggu';
  const canApprove = user?.role === 'admin' && req.status === 'terverifikasi';

  return (
    <div className={`rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 ${
      req.hasProtectWarning ? 'border-yellow-300 dark:border-yellow-700' : 'border-slate-200'
    }`}>
      {/* Header kartu */}
      <div
        className="flex cursor-pointer flex-wrap items-start justify-between gap-3 p-4"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{req.docNo}</span>
          <Badge status={req.status} />
          {req.hasProtectWarning && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
              ⚠️ Protect Warning
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{req.bkbDate}</span>
          <span>{req.jenis} · {req.keterangan}</span>
          <span>oleh {req.operatorName || '—'}</span>
          <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* Detail */}
      {open && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          {req.machine && (
            <p className="mb-2 text-xs text-slate-500">Mesin: <span className="font-semibold">{req.machine}</span></p>
          )}
          {req.notes && (
            <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Catatan SK: {req.notes}
            </p>
          )}

          {/* Tabel item */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 text-left">Barang</th>
                  <th className="pb-2 text-right">Saldo Saat Input</th>
                  <th className="pb-2 text-right w-28">QTY</th>
                  <th className="pb-2 text-left w-40">Dept Pemakai</th>
                  <th className="pb-2 text-left w-28">Dept Proses</th>
                </tr>
              </thead>
              <tbody>
                {(editLines || req.items).map((line, i) => (
                  <tr key={line.id} className={line.protectWarning ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                    <td className="py-1.5">
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{line.itemCode}</span>
                      <span className="ml-2 text-xs text-slate-500">{line.itemName}</span>
                      {line.protectWarning && <span className="ml-1 text-xs text-yellow-600">⚠️</span>}
                    </td>
                    <td className="py-1.5 text-right text-slate-500 text-xs">
                      {line.balanceAtInput != null ? formatNumber(line.balanceAtInput) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {editLines ? (
                        <input
                          type="number" min="0" step="any"
                          value={line.qtyEdit}
                          onChange={(e) => setEditLines((prev) => prev.map((l, j) => j === i ? { ...l, qtyEdit: e.target.value } : l))}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        <span className="font-semibold">{formatNumber(line.qty)} {line.unit}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-xs">{line.deptPemakai}</td>
                    <td className="py-1.5 text-xs">{line.deptProses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit notes (SK) */}
          {canVerify && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Catatan (opsional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Catatan Stock Keeper..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          {/* Tombol aksi */}
          <div className="mt-4 flex flex-wrap gap-2">
            {canVerify && (
              <>
                {!editLines && (
                  <button type="button" onClick={startEdit}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    Edit Sebelum Verifikasi
                  </button>
                )}
                <button type="button" onClick={handleVerify} disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {busy && <Spinner className="h-4 w-4" />}
                  ✓ Verifikasi
                </button>
              </>
            )}
            {canApprove && (
              <button type="button" onClick={handleApprove} disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {busy && <Spinner className="h-4 w-4" />}
                ✓ Approve & Buat BKB
              </button>
            )}
            {req.status === 'selesai' && req.bkbId && (
              <p className="text-xs text-slate-500 self-center">BKB dibuat: #{req.bkbId} · diapprove oleh {req.approvedByName}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RuangTunggu({ user }) {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, mutate: refresh } = useRealtimeSWR(
    `/api/requests?status=${statusFilter}&limit=50`,
    swrFetcher,
    { subscribeTables: ['bkb_requests'] },
  );

  const requests = data?.items || [];

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {['', 'menunggu', 'terverifikasi', 'selesai'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {s === '' ? 'Semua' : REQUEST_STATUS[s]?.label || s}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      )}

      {!isLoading && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500 dark:border-slate-700">
          <p className="text-sm">Tidak ada request{statusFilter ? ` dengan status "${REQUEST_STATUS[statusFilter]?.label}"` : ''}.</p>
        </div>
      )}

      {requests.map((req) => (
        <RequestCard key={req.id} req={req} user={user} onRefresh={() => refresh()} />
      ))}
    </div>
  );
}