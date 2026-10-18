// FILE: components/bkb/BkbListPanel.jsx
// Daftar BKB (read-only). Dipakai Staff / Stock Keeper untuk menyiapkan barang,
// dan Admin untuk memeriksa hasil input. Update otomatis lewat Realtime saat Admin menyimpan BKB.

'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { mutate } from 'swr';
import { useRealtimeSWR } from '@/hooks/useRealtimeSWR';
import { swrFetcher } from '@/lib/api-client';
import { SkeletonTable } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { inputClass } from '@/components/ui/Field';
import { JENIS_TRANSAKSI, directionOf } from '@/lib/constants/bkb';
import { formatNumber } from '@/lib/utils';

const formatDate = (d) => (d ? d.split('-').reverse().join('/') : '-');

export default function BkbListPanel() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [jenis, setJenis] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const key = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) p.set('search', search);
    if (jenis) p.set('jenis', jenis);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return `/api/bkb?${p.toString()}`;
  }, [page, search, jenis, startDate, endDate]);

  const { data, isLoading, error } = useRealtimeSWR(key, swrFetcher, { subscribeTables: ['bkb', 'transactions_log'] });
  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Cari No Dokumen / keterangan / mesin..."
          className={`${inputClass(false, true)} lg:col-span-2`}
        />
        <select value={jenis} onChange={(e) => { setJenis(e.target.value); setPage(1); }} className={inputClass(false, true)}>
          <option value="">Semua Jenis</option>
          {JENIS_TRANSAKSI.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className={inputClass(false, true)} aria-label="Tanggal mulai" />
        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className={inputClass(false, true)} aria-label="Tanggal akhir" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{formatNumber(meta.total)} BKB ditemukan</p>
        <button
          onClick={() => mutate(key)}
          className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Segarkan
        </button>
      </div>

      {error ? (
        <EmptyState title="Gagal memuat BKB" description={error.message} />
      ) : isLoading ? (
        <SkeletonTable rows={6} />
      ) : invalidRange ? (
        <EmptyState title="Periksa rentang tanggal" description="Tanggal mulai tidak boleh lebih besar dari tanggal akhir." />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada BKB" description="BKB yang diinput Admin akan muncul di sini secara otomatis." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-3 py-3 font-medium">No Dokumen</th>
                  <th className="px-3 py-3 font-medium">Jenis</th>
                  <th className="px-3 py-3 font-medium">Tanggal</th>
                  <th className="px-3 py-3 font-medium">Sift</th>
                  <th className="px-3 py-3 font-medium">Keterangan</th>
                  <th className="px-3 py-3 font-medium">Mesin</th>
                  <th className="px-3 py-3 text-center font-medium">Item</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900">
                {rows.map((bkb) => {
                  const isOpen = expanded.has(bkb.id);
                  return (
                    <Fragment key={bkb.id}>
                      <tr onClick={() => toggle(bkb.id)} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-3 text-slate-400">{isOpen ? '▾' : '▸'}</td>
                        <td className="px-3 py-3 font-mono font-semibold text-slate-800 dark:text-slate-100">{bkb.docNo}</td>
                        <td className="px-3 py-3"><Badge tone={directionOf(bkb.jenis) === 'out' ? 'amber' : 'green'}>{bkb.jenis}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(bkb.bkbDate)}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{bkb.reference || '—'}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{bkb.keterangan}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{bkb.machine || '—'}</td>
                        <td className="px-3 py-3 text-center text-slate-500">{bkb.items.length}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                          <td />
                          <td colSpan={7} className="px-3 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-400">
                                  <th className="pb-1 font-medium">Kode</th>
                                  <th className="pb-1 font-medium">Nama Barang</th>
                                  <th className="pb-1 text-right font-medium">QTY</th>
                                  <th className="pb-1 pl-4 font-medium">Dept Pemakai</th>
                                  <th className="pb-1 font-medium">Dept Proses</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bkb.items.map((line) => (
                                  <tr key={line.id} className="text-slate-700 dark:text-slate-200">
                                    <td className="py-1 font-mono font-semibold">{line.itemCode}</td>
                                    <td className="py-1">{line.itemName}</td>
                                    <td className="py-1 text-right font-semibold">{formatNumber(line.qty)} <span className="font-normal text-slate-400">{line.unit}</span></td>
                                    <td className="py-1 pl-4">{line.deptPemakai}</td>
                                    <td className="py-1">{line.deptProses}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="mt-2 text-[11px] text-slate-400">Diinput oleh {bkb.createdByName || '—'}</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
