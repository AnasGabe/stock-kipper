'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import Badge, { StockStatusBadge } from '@/components/ui/Badge';
import { swrFetcher } from '@/lib/api-client';
import { CATEGORIES, LOG_LABEL } from '@/lib/constants/bkb';
import { formatDateTime, formatNumber } from '@/lib/utils';

export default function StockDetailModal({ open, onClose, item }) {
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!open || !item) return undefined;
    let cancelled = false;
    setHistory(null);
    setLoadError('');
    swrFetcher(`/api/items/${item.id}/history`)
      .then((r) => !cancelled && setHistory(r.data))
      .catch((e) => !cancelled && setLoadError(e.message || 'Gagal memuat riwayat.'));
    return () => { cancelled = true; };
  }, [open, item]);

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title={`${item.itemCode} — ${item.name}`} wide>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoBox label="Kategori" value={`${item.categoryCode} · ${CATEGORIES[item.categoryCode]?.label}`} />
        <InfoBox label="Lokasi" value={item.locationCode} />
        <InfoBox label="Saldo KS" value={`${formatNumber(item.quantity)} ${item.unit}`} />
        <InfoBox label="Status" value={<StockStatusBadge quantity={item.quantity} />} />
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-800 dark:text-slate-100">Riwayat Mutasi</h3>
      {loadError ? (
        <p className="text-sm text-rose-600">{loadError}</p>
      ) : !history ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Spinner className="h-4 w-4" /> Memuat riwayat...</div>
      ) : history.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Belum ada mutasi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2 font-medium">Waktu</th>
                <th className="pb-2 font-medium">Jenis</th>
                <th className="pb-2 font-medium">No Dok</th>
                <th className="pb-2 text-right font-medium">Saldo</th>
                <th className="pb-2 pl-3 font-medium">Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((e) => (
                <tr key={e.id} className="text-slate-700 dark:text-slate-200">
                  <td className="whitespace-nowrap py-2 text-slate-400">{formatDateTime(e.createdAt)}</td>
                  <td className="py-2"><Badge tone={e.direction === 'out' ? 'amber' : 'green'}>{e.jenis}</Badge> <span className="text-slate-400">{LOG_LABEL[e.jenis]}</span></td>
                  <td className="py-2 font-mono">{e.docNo || '—'}</td>
                  <td className="whitespace-nowrap py-2 text-right font-semibold">{formatNumber(e.balanceBefore)} → {formatNumber(e.balanceAfter)}</td>
                  <td className="py-2 pl-3">{e.actorName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
