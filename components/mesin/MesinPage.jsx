'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { useRealtimeSWR } from '@/hooks/useRealtimeSWR';
import { swrFetcher, apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import { Field, inputClass } from '@/components/ui/Field';

function MesinFormModal({ machine, onClose, onSaved }) {
  const toast = useToast();
  const [code,   setCode]   = useState(machine?.code || '');
  const [name,   setName]   = useState(machine?.name || '');
  const [active, setActive] = useState(machine?.active ?? true);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { setErr('Kode dan nama wajib diisi.'); return; }
    setBusy(true); setErr('');
    try {
      if (machine) {
        await apiFetch(`/api/machines/${machine.id}`, { method: 'PUT', body: { code, name, active } });
        toast('Mesin berhasil diperbarui.');
      } else {
        await apiFetch('/api/machines', { body: { code, name } });
        toast('Mesin berhasil ditambahkan.');
      }
      mutate((k) => typeof k === 'string' && k.startsWith('/api/machines'));
      onSaved?.();
      onClose();
    } catch (error) {
      setErr(error.message || 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          {machine ? 'Edit Mesin' : 'Tambah Mesin'}
        </h2>

        {err && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Kode Mesin">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="HTF-200"
              className={inputClass(false)}
            />
            <p className="mt-1 text-xs text-slate-400">Huruf kapital, contoh: HTF-200, INJ-1</p>
          </Field>

          <Field label="Nama Mesin">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HTF 200"
              className={inputClass(false)}
            />
          </Field>

          {machine && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-slate-700 dark:text-slate-300">Aktif (muncul di dropdown form BKB)</span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Batal
            </button>
            <button type="submit" disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {busy && <Spinner className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MesinPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting]     = useState(null);

  const { data, isLoading } = useRealtimeSWR(
    '/api/machines',
    swrFetcher,
    { subscribeTables: ['machines'] },
  );
  const machines = data?.data || [];

  async function handleDelete(m) {
    if (!confirm(`Hapus mesin "${m.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(m.id);
    try {
      await apiFetch(`/api/machines/${m.id}`, { method: 'DELETE' });
      toast('Mesin berhasil dihapus.');
      mutate((k) => typeof k === 'string' && k.startsWith('/api/machines'));
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {(modalOpen || editTarget) && (
        <MesinFormModal
          machine={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSaved={() => { setModalOpen(false); setEditTarget(null); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Master Mesin</h1>
          <p className="mt-1 text-sm text-slate-500">Daftar mesin yang tersedia untuk form BKB (tujuan INJ).</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Tambah Mesin
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      )}

      {!isLoading && machines.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500 dark:border-slate-700">
          <p className="text-sm">Belum ada mesin. Klik tombol Tambah Mesin untuk menambahkan.</p>
        </div>
      )}

      {machines.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-100">{m.code}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {m.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditTarget(m)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m)}
                        disabled={deleting === m.id}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-900/30"
                      >
                        {deleting === m.id ? <Spinner className="h-3 w-3" /> : 'Hapus'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}