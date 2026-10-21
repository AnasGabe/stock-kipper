'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mutate } from 'swr';
import { swrFetcher, apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import { Field, inputClass } from '@/components/ui/Field';
import ItemAutocomplete from '@/components/bkb/ItemAutocomplete';
import MachineAutocomplete from '@/components/bkb/MachineAutocomplete';
import {
  JENIS_TRANSAKSI, BKB_KATEGORI_OPTIONS, SIFT_OPTIONS, TUJUAN_OPTIONS,
  DEPT_PEMAKAI_OPTIONS, DEPT_PROSES_OPTIONS, DEFAULT_DEPT_PROSES,
  isTujuanInj, buildKeteranganExtra, nameToInitial, directionOf,
} from '@/lib/constants/bkb';
import { formatNumber } from '@/lib/utils';

function todayWib() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}
const cx = (...c) => c.filter(Boolean).join(' ');

export default function OperatorRequestForm({ user, onSaved }) {
  const toast   = useToast();
  const keyRef  = useRef(0);
  const newLine = () => ({
    key: `r${++keyRef.current}`, item: null, qty: '',
    deptPemakai: '', deptProses: DEFAULT_DEPT_PROSES,
  });

  const defaultInisial = useMemo(() => nameToInitial(user?.name || ''), [user?.name]);

  const [header, setHeader] = useState({
    jenis: 'PB', bkbKategori: '4', docNo: '', bkbDate: todayWib(),
    reference: '', tujuan: '', inisial: defaultInisial, nomorUrut: 1, machine: '',
  });
  const [lines,  setLines]  = useState(() => [newLine()]);
  const [errors, setErrors] = useState({});
  const [busy,   setBusy]   = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [seqLoading, setSeqLoading] = useState(false);

  const inj      = isTujuanInj(header.tujuan);
  const outbound = directionOf(header.jenis) === 'out';

  const keteranganPreview = header.tujuan
    ? buildKeteranganExtra(header.tujuan, header.inisial, header.nomorUrut) : '—';

  // Auto doc no
  const fetchDocNo = useCallback(async (jenis, kategori, date) => {
    if (!jenis || !kategori || !date) return;
    setDocLoading(true);
    try {
      const r = await swrFetcher(`/api/bkb/next-doc?jenis=${jenis}&kategori=${kategori}&date=${date}`);
      setHeader((prev) => ({ ...prev, docNo: r.docNo }));
    } catch { /* manual */ }
    finally { setDocLoading(false); }
  }, []);

  useEffect(() => {
    fetchDocNo(header.jenis, header.bkbKategori, header.bkbDate);
  }, [header.jenis, header.bkbKategori, header.bkbDate, fetchDocNo]);

  const fetchSeq = useCallback(async (tujuan, inisial) => {
    if (!tujuan || !inisial) return;
    setSeqLoading(true);
    try {
      const r = await swrFetcher(`/api/bkb/next-seq?tujuan=${encodeURIComponent(tujuan)}&inisial=${encodeURIComponent(inisial)}`);
      setHeader((prev) => ({ ...prev, nomorUrut: r.next ?? 1 }));
    } catch { /* manual */ }
    finally { setSeqLoading(false); }
  }, []);

  useEffect(() => {
    if (header.tujuan) fetchSeq(header.tujuan, header.inisial);
  }, [header.tujuan, header.inisial, fetchSeq]);

  const setH = (field, value) => {
    setHeader((prev) => {
      const next = { ...prev, [field]: value };
      if (!isTujuanInj(next.tujuan)) next.machine = '';
      return next;
    });
    setErrors((p) => ({ ...p, [field]: undefined }));
  };
  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const focusCell = (rowKey, field) =>
    setTimeout(() => document.querySelector(`[data-row="${rowKey}"][data-field="${field}"]`)?.focus(), 30);

  function addLine() {
    const line = newLine();
    setLines((prev) => [...prev, line]);
    focusCell(line.key, 'item');
  }
  function removeLine(key) {
    setLines((prev) => (prev.length === 1 ? [newLine()] : prev.filter((l) => l.key !== key)));
  }
  function onCellKey(e, line, index, next) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (next) return focusCell(line.key, next);
    if (index === lines.length - 1) addLine();
    else focusCell(lines[index + 1].key, 'item');
  }

  function validate() {
    const errs = {};
    if (!header.jenis) errs.jenis = 'Wajib.';
    if (!header.bkbKategori) errs.bkbKategori = 'Wajib.';
    if (!header.bkbDate) errs.bkbDate = 'Wajib.';
    if (!header.reference) errs.reference = 'Pilih sift.';
    if (!header.tujuan) errs.tujuan = 'Pilih tujuan.';
    if (!header.inisial) errs.inisial = 'Inisial wajib.';
    if (inj && !header.machine) errs.machine = 'Mesin wajib untuk INJ.';

    const filled = lines.filter((l) => l.item || l.qty || l.deptPemakai);
    const rows = filled.length ? filled : lines;
    rows.forEach((l) => {
      if (!l.item) errs[`items.${l.key}.itemId`] = 'Pilih barang.';
      if (!l.qty || Number(l.qty) <= 0) errs[`items.${l.key}.qty`] = 'QTY wajib > 0.';
      if (!l.deptPemakai) errs[`items.${l.key}.deptPemakai`] = 'Pilih dept.';
    });
    return { errs, rows };
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if (busy) return;
    const { errs, rows } = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Periksa kembali isian yang bertanda merah.');
      return;
    }
    setBusy(true);
    try {
      const keterangan = buildKeteranganExtra(header.tujuan, header.inisial, header.nomorUrut);
      const payload = {
        docNo: header.docNo,
        jenis: header.jenis,
        bkbKategori: header.bkbKategori,
        bkbDate: header.bkbDate,
        reference: header.reference || null,
        keteranganType: header.tujuan,
        keteranganExtra: `${header.inisial}/${header.nomorUrut}`,
        keterangan,
        machine: inj ? header.machine : null,
        items: rows.map((l) => ({
          itemId: l.item.id,
          qty: Number(l.qty),
          deptPemakai: l.deptPemakai,
          deptProses: l.deptProses || DEFAULT_DEPT_PROSES,
        })),
      };
      const res = await apiFetch('/api/requests', { body: payload });
      const warn = res.hasProtectWarning ? ' ⚠️ Ada peringatan saldo protect — Stock Keeper akan dikonfirmasi.' : '';
      toast(`Request ${payload.docNo} berhasil dikirim ke Ruang Tunggu.${warn}`);
      setHeader((prev) => ({ ...prev, docNo: '', tujuan: '', nomorUrut: 1, machine: '' }));
      setLines([newLine()]);
      setErrors({});
      onSaved?.();
      setTimeout(() => fetchDocNo(header.jenis, header.bkbKategori, header.bkbDate), 300);
    } catch (err) {
      toast.error(err.message || 'Gagal mengirim request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Request Barang — akan dikirim ke Ruang Tunggu
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Jenis Transaksi" error={errors.jenis}>
            <select value={header.jenis} onChange={(e) => setH('jenis', e.target.value)} className={inputClass(errors.jenis)}>
              {JENIS_TRANSAKSI.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </Field>

          <Field label="Kategori Barang" error={errors.bkbKategori}>
            <select value={header.bkbKategori} onChange={(e) => setH('bkbKategori', e.target.value)} className={inputClass(errors.bkbKategori)}>
              {BKB_KATEGORI_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </Field>

          <Field label="No Dokumen" hint={docLoading ? 'Membuat...' : 'Otomatis'}>
            <div className="relative">
              <input type="text" value={header.docNo}
                onChange={(e) => setH('docNo', e.target.value.toUpperCase())}
                className={cx(inputClass(false), 'font-mono pr-8')} />
              {docLoading
                ? <span className="absolute right-2.5 top-2.5"><Spinner className="h-4 w-4" /></span>
                : <button type="button" onClick={() => fetchDocNo(header.jenis, header.bkbKategori, header.bkbDate)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-brand-600 text-xs">↻</button>}
            </div>
          </Field>

          <Field label="Tanggal" error={errors.bkbDate}>
            <input type="date" value={header.bkbDate} onChange={(e) => setH('bkbDate', e.target.value)} className={inputClass(errors.bkbDate)} />
          </Field>

          <Field label="Sift" error={errors.reference}>
            <select value={header.reference} onChange={(e) => setH('reference', e.target.value)} className={inputClass(errors.reference)}>
              <option value="">— pilih —</option>
              {SIFT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tujuan" error={errors.tujuan}>
            <select value={header.tujuan} onChange={(e) => setH('tujuan', e.target.value)} className={inputClass(errors.tujuan)}>
              <option value="">— pilih —</option>
              {TUJUAN_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>)}
            </select>
          </Field>

          <Field label="Inisial" error={errors.inisial} hint="3 huruf">
            <input type="text" value={header.inisial}
              onChange={(e) => setH('inisial', e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6} placeholder="AND"
              className={cx(inputClass(errors.inisial), 'font-mono uppercase')} />
          </Field>

          <Field label="Nomor Urut" hint={seqLoading ? 'Mengambil...' : 'Auto'}>
            <div className="relative">
              <input type="text" inputMode="numeric" value={header.nomorUrut}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setH('nomorUrut', v === '' ? '' : parseInt(v, 10) || 1); }}
                className={inputClass(false)} />
              {seqLoading && <span className="absolute right-2.5 top-2.5"><Spinner className="h-4 w-4" /></span>}
            </div>
          </Field>

          <Field label="Keterangan (preview)">
            <div className={cx(inputClass(false), 'bg-slate-50 font-mono font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-300')}>
              {keteranganPreview}
            </div>
          </Field>
        </div>

        {inj && (
          <div className="mt-4 max-w-xs">
            <Field label={`Mesin (wajib — ${header.tujuan})`} error={errors.machine} hint="Ketik kode mesin">
              <MachineAutocomplete value={header.machine} onChange={(v) => setH('machine', v)} hasError={Boolean(errors.machine)} />
            </Field>
          </div>
        )}
      </section>

      {/* Detail Barang */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Detail Barang</h2>
        <div className="overflow-x-auto pb-10">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="w-7 px-1 pb-2">#</th>
                <th className="w-48 px-1 pb-2">Kode Barang</th>
                <th className="px-1 pb-2">Nama</th>
                <th className="w-24 px-1 pb-2 text-right">Saldo</th>
                <th className="w-24 px-1 pb-2">QTY</th>
                <th className="w-44 px-1 pb-2">Dept Pemakai</th>
                <th className="w-36 px-1 pb-2">Dept Proses</th>
                <th className="w-7 px-1 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const eItem = errors[`items.${line.key}.itemId`];
                const eQty  = errors[`items.${line.key}.qty`];
                const eDept = errors[`items.${line.key}.deptPemakai`];
                return (
                  <tr key={line.key} className="align-top">
                    <td className="px-1 py-1.5 pt-3 text-xs text-slate-400">{index + 1}</td>
                    <td className="px-1 py-1.5">
                      <ItemAutocomplete
                        rowKey={line.key}
                        selected={line.item}
                        hasError={Boolean(eItem)}
                        categoryCode={header.bkbKategori}
                        onSelect={(item) => { setLine(line.key, { item }); setErrors((p) => ({ ...p, [`items.${line.key}.itemId`]: undefined })); }}
                        onClear={() => setLine(line.key, { item: null })}
                        onPicked={() => focusCell(line.key, 'qty')}
                      />
                      {eItem && <p className="mt-1 text-xs text-rose-600">{eItem}</p>}
                    </td>
                    <td className="px-1 py-1.5">
                      <input readOnly tabIndex={-1} value={line.item?.name || ''} placeholder="Terisi otomatis"
                        className={cx(inputClass(false, true), 'bg-slate-50 dark:bg-slate-800/60')} />
                    </td>
                    <td className="px-1 py-1.5 pt-3 text-right text-xs text-slate-500">
                      {line.item ? `${formatNumber(line.item.quantity)} ${line.item.unit}` : '—'}
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        data-row={line.key} data-field="qty"
                        type="number" inputMode="decimal" min="0" step="any"
                        value={line.qty}
                        onChange={(e) => { setLine(line.key, { qty: e.target.value }); setErrors((p) => ({ ...p, [`items.${line.key}.qty`]: undefined })); }}
                        onKeyDown={(e) => onCellKey(e, line, index, 'dept')}
                        className={inputClass(Boolean(eQty), true)}
                      />
                      {eQty && <p className="mt-1 text-xs text-rose-600">{eQty}</p>}
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        data-row={line.key} data-field="dept"
                        value={line.deptPemakai}
                        onChange={(e) => { setLine(line.key, { deptPemakai: e.target.value }); setErrors((p) => ({ ...p, [`items.${line.key}.deptPemakai`]: undefined })); }}
                        onKeyDown={(e) => onCellKey(e, line, index, 'proses')}
                        className={inputClass(Boolean(eDept), true)}
                      >
                        <option value="">— pilih —</option>
                        {DEPT_PEMAKAI_OPTIONS.map((d) => (
                          <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                        ))}
                      </select>
                      {eDept && <p className="mt-1 text-xs text-rose-600">{eDept}</p>}
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        data-row={line.key} data-field="proses"
                        value={line.deptProses}
                        onChange={(e) => setLine(line.key, { deptProses: e.target.value })}
                        onKeyDown={(e) => onCellKey(e, line, index, null)}
                        className={inputClass(false, true)}
                      >
                        {DEPT_PROSES_OPTIONS.map((d) => (
                          <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1.5 pt-2.5">
                      <button type="button" tabIndex={-1} onClick={() => removeLine(line.key)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addLine}
          className="mt-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-brand-500 hover:text-brand-600 dark:border-slate-700">
          + Tambah Baris
        </button>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
          {busy && <Spinner className="h-4 w-4" />}
          {busy ? 'Mengirim...' : 'Kirim ke Ruang Tunggu'}
        </button>
      </div>
    </form>
  );
}