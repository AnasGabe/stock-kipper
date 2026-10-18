// FILE: components/bkb/BkbForm.jsx
// Form Input BKB — Admin dan Staff. Enter antar kolom, Ctrl+Enter simpan.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mutate } from 'swr';
import { useRealtimeSWR } from '@/hooks/useRealtimeSWR';
import { swrFetcher, apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import { Field, inputClass } from '@/components/ui/Field';
import ItemAutocomplete from './ItemAutocomplete';
import { bkbSchema } from '@/lib/validations/bkb';
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

export default function BkbForm({ user, onSaved }) {
  const toast = useToast();
  const keyRef = useRef(0);
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
  const [serverError, setServerError] = useState('');
  const [busy, setBusy]     = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [seqLoading, setSeqLoading] = useState(false);

  const inj      = isTujuanInj(header.tujuan);
  const outbound = directionOf(header.jenis) === 'out';
  const keteranganPreview = header.tujuan
    ? buildKeteranganExtra(header.tujuan, header.inisial, header.nomorUrut) : '—';

  // saldo live
  const ids = lines.filter((l) => l.item).map((l) => l.item.id).join(',');
  const { data: fresh } = useRealtimeSWR(
    ids ? `/api/items/search?ids=${ids}` : null, swrFetcher, { subscribeTables: ['items'] },
  );
  const freshById = useMemo(
    () => new Map((fresh?.data || []).map((it) => [it.id, it])), [fresh],
  );
  const saldoOf = (line) =>
    line.item ? (freshById.get(line.item.id)?.quantity ?? line.item.quantity) : null;
  const overRows = lines.filter((l) => outbound && l.item && Number(l.qty) > saldoOf(l));

  // Auto-generate No Dokumen saat jenis/kategori/tanggal berubah
  const fetchDocNo = useCallback(async (jenis, kategori, date) => {
    if (!jenis || !kategori || !date) return;
    setDocLoading(true);
    try {
      const r = await swrFetcher(
        `/api/bkb/next-doc?jenis=${jenis}&kategori=${kategori}&date=${date}`,
      );
      setHeader((prev) => ({ ...prev, docNo: r.docNo }));
    } catch { /* biarkan user isi manual */ }
    finally { setDocLoading(false); }
  }, []);

  useEffect(() => {
    fetchDocNo(header.jenis, header.bkbKategori, header.bkbDate);
  }, [header.jenis, header.bkbKategori, header.bkbDate, fetchDocNo]);

  // Auto-fetch nomor urut keterangan saat tujuan/inisial berubah
  const fetchSeq = useCallback(async (tujuan, inisial) => {
    if (!tujuan || !inisial) return;
    setSeqLoading(true);
    try {
      const r = await swrFetcher(
        `/api/bkb/next-seq?tujuan=${encodeURIComponent(tujuan)}&inisial=${encodeURIComponent(inisial)}`,
      );
      setHeader((prev) => ({ ...prev, nomorUrut: r.next ?? 1 }));
    } catch { /* biarkan user isi manual */ }
    finally { setSeqLoading(false); }
  }, []);

  useEffect(() => {
    if (header.tujuan) fetchSeq(header.tujuan, header.inisial);
  }, [header.tujuan, header.inisial, fetchSeq]);

  // ---- util ----
  const setH = (field, value) => {
    setHeader((prev) => {
      const next = { ...prev, [field]: value };
      if (!isTujuanInj(next.tujuan)) next.machine = '';
      return next;
    });
    setErrors((p) => ({ ...p, [field]: undefined }));
    setServerError('');
  };
  const setLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setServerError('');
  };
  const focusCell = (rowKey, field) =>
    setTimeout(() => document.querySelector(`[data-row="${rowKey}"][data-field="${field}"]`)?.focus(), 30);

  function addLine(focus = true) {
    const line = newLine();
    setLines((prev) => [...prev, line]);
    if (focus) focusCell(line.key, 'item');
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

  // ---- validasi + submit ----
  function buildPayload() {
    const filled = lines.filter((l) => l.item || l.qty !== '' || l.deptPemakai.trim());
    const rows = filled.length ? filled : lines;
    return {
      ...header,
      items: rows.map((l) => ({
        itemId: l.item?.id ?? null, qty: l.qty,
        deptPemakai: l.deptPemakai, deptProses: l.deptProses,
      })),
      _rows: rows,
    };
  }

  function validate() {
    const { _rows, ...payload } = buildPayload();
    const parsed = bkbSchema.safeParse(payload);
    const errs = {};
    if (!parsed.success) {
      for (const issue of parsed.error.errors) {
        const path = issue.path
          .map((p, i) => (i === 1 && issue.path[0] === 'items' ? _rows[p]?.key : p))
          .join('.');
        if (!errs[path]) errs[path] = issue.message;
      }
    }
    if (outbound) {
      _rows.forEach((l) => {
        const s = saldoOf(l);
        const k = `items.${l.key}.qty`;
        if (l.item && Number(l.qty) > s && !errs[k])
          errs[k] = `Melebihi Saldo KS (${formatNumber(s)})`;
      });
    }
    return { errs, parsed };
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if (busy) return;
    const { errs, parsed } = validate();
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) {
      toast.error('Periksa kembali isian yang bertanda merah.');
      return;
    }
    setBusy(true);
    setServerError('');
    try {
      const { _rows, ...payload } = buildPayload();
      const res = await apiFetch('/api/bkb', { body: payload });
      toast(res.message || 'BKB tersimpan.');
      setHeader((prev) => ({ ...prev, docNo: '', tujuan: '', nomorUrut: 1, machine: '' }));
      setLines([newLine()]);
      setErrors({});
      mutate((k) => typeof k === 'string' && k.startsWith('/api/'));
      onSaved?.();
      setTimeout(() => fetchDocNo(header.jenis, header.bkbKategori, header.bkbDate), 300);
    } catch (err) {
      setServerError(err.message || 'Gagal menyimpan BKB.');
      toast.error(err.message || 'Gagal menyimpan BKB.');
      mutate((k) => typeof k === 'string' && k.startsWith('/api/items'));
    } finally {
      setBusy(false);
    }
  }

  const selTujuan = TUJUAN_OPTIONS.find((t) => t.value === header.tujuan);

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
        else if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault();
      }}
      className="space-y-5"
    >
      {/* ===== HEADER ===== */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Header BKB</h2>

        {/* Baris 1: Jenis, Kategori, No Dokumen, Tanggal, Sift */}
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

          <Field label="No Dokumen" error={errors.docNo} hint={docLoading ? 'Membuat nomor...' : 'Otomatis, bisa diedit'}>
            <div className="relative">
              <input
                type="text"
                value={header.docNo}
                onChange={(e) => setH('docNo', e.target.value.toUpperCase())}
                placeholder="PB410-26I00001"
                className={cx(inputClass(errors.docNo), 'font-mono pr-8')}
              />
              {docLoading
                ? <span className="absolute right-2.5 top-2.5"><Spinner className="h-4 w-4" /></span>
                : <button type="button" title="Buat ulang nomor"
                    onClick={() => fetchDocNo(header.jenis, header.bkbKategori, header.bkbDate)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-brand-600 text-xs">↻</button>
              }
            </div>
          </Field>

          <Field label="Tanggal BKB" error={errors.bkbDate}>
            <input type="date" value={header.bkbDate} onChange={(e) => setH('bkbDate', e.target.value)} className={inputClass(errors.bkbDate)} />
          </Field>

          <Field label="Referensi (Sift)" error={errors.reference}>
            <select value={header.reference} onChange={(e) => setH('reference', e.target.value)} className={inputClass(errors.reference)}>
              <option value="">— pilih sift —</option>
              {SIFT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Baris 2: Tujuan, Inisial, Nomor, Preview */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Tujuan" error={errors.tujuan}>
            <select value={header.tujuan} onChange={(e) => setH('tujuan', e.target.value)} className={inputClass(errors.tujuan)}>
              <option value="">— pilih —</option>
              {TUJUAN_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {selTujuan && <p className="mt-1 text-xs text-slate-400">{selTujuan.hint}</p>}
          </Field>

          <Field label="Inisial" error={errors.inisial} hint="3 huruf nama petugas">
            <input type="text" value={header.inisial}
              onChange={(e) => setH('inisial', e.target.value.toUpperCase().slice(0,6))}
              maxLength={6} placeholder="AND"
              className={cx(inputClass(errors.inisial), 'font-mono uppercase')} />
          </Field>

          <Field label="Nomor Urut" error={errors.nomorUrut} hint={seqLoading ? 'Mengambil...' : 'Auto, bisa diubah'}>
            <div className="relative">
              <input type="number" min="1" value={header.nomorUrut}
                onChange={(e) => setH('nomorUrut', parseInt(e.target.value,10)||1)}
                className={inputClass(errors.nomorUrut)} />
              {seqLoading && <span className="absolute right-2.5 top-2.5"><Spinner className="h-4 w-4" /></span>}
            </div>
          </Field>

          <Field label="Keterangan (preview)" className="lg:col-span-2">
            <div className={cx(inputClass(false), 'bg-slate-50 font-mono font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-300')}>
              {keteranganPreview}
            </div>
            <p className="mt-1 text-xs text-slate-400">Tujuan / Inisial / Nomor</p>
          </Field>
        </div>

        {/* Mesin — hanya bila INJ */}
        {inj && (
          <div className="mt-4 max-w-xs">
            <Field label={`Mesin (wajib — ${header.tujuan})`} error={errors.machine} hint="contoh: HTF 200, MA 200 W1">
              <input type="text" value={header.machine}
                onChange={(e) => setH('machine', e.target.value)}
                placeholder="HTF 200"
                className={inputClass(errors.machine)} />
            </Field>
          </div>
        )}
      </section>

      {/* ===== DETAIL BARANG ===== */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detail Barang</h2>
          <p className="text-xs text-slate-400">
            Arahkan ke kolom Kode lalu scan barcode.{' '}
            <kbd className="rounded border px-1">Enter</kbd> pindah ·{' '}
            <kbd className="rounded border px-1">Ctrl+Enter</kbd> simpan
          </p>
        </div>

        <div className="overflow-x-auto pb-20">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="w-7 px-1 pb-2">#</th>
                <th className="w-52 px-1 pb-2">Kode / Tipe Barang</th>
                <th className="px-1 pb-2">Nama Barang</th>
                <th className="w-24 px-1 pb-2 text-right">Saldo KS</th>
                <th className="w-28 px-1 pb-2">QTY</th>
                <th className="w-52 px-1 pb-2">Dept Pemakai</th>
                <th className="w-44 px-1 pb-2">Dept Proses</th>
                <th className="w-7 px-1 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const saldo = saldoOf(line);
                const over  = outbound && line.item && Number(line.qty) > saldo;
                const eItem = errors[`items.${line.key}.itemId`];
                const eQty  = errors[`items.${line.key}.qty`];
                const eDept = errors[`items.${line.key}.deptPemakai`];
                return (
                  <tr key={line.key} className="align-top">
                    <td className="px-1 py-1.5 pt-3 text-xs text-slate-400">{index+1}</td>
                    <td className="px-1 py-1.5">
                      <ItemAutocomplete
                        rowKey={line.key} selected={line.item} hasError={Boolean(eItem)}
                        onSelect={(item) => { setLine(line.key,{item}); setErrors((p)=>({...p,[`items.${line.key}.itemId`]:undefined})); }}
                        onClear={() => setLine(line.key,{item:null})}
                        onPicked={() => focusCell(line.key,'qty')}
                      />
                      {eItem && <p className="mt-1 text-xs text-rose-600">{eItem}</p>}
                    </td>
                    <td className="px-1 py-1.5">
                      <input readOnly tabIndex={-1} value={line.item?.name||''} placeholder="Terisi otomatis"
                        className={cx(inputClass(false,true),'bg-slate-50 dark:bg-slate-800/60')} />
                    </td>
                    <td className="px-1 py-1.5 pt-3 text-right">
                      {line.item
                        ? <span className={cx('font-semibold', saldo<=0?'text-rose-600':'text-slate-700 dark:text-slate-200')}>
                            {formatNumber(saldo)} <span className="text-xs font-normal text-slate-400">{line.item.unit}</span>
                          </span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-1 py-1.5">
                      <input data-row={line.key} data-field="qty"
                        type="number" inputMode="decimal" min="0" step="any"
                        value={line.qty}
                        onChange={(e)=>{ setLine(line.key,{qty:e.target.value}); setErrors((p)=>({...p,[`items.${line.key}.qty`]:undefined})); }}
                        onKeyDown={(e)=>onCellKey(e,line,index,'dept')}
                        className={inputClass(Boolean(eQty)||over,true)} />
                      {(over||eQty) && <p className="mt-1 text-xs text-rose-600">{eQty||`Melebihi Saldo KS (${formatNumber(saldo)})`}</p>}
                    </td>
                    {/* Dept Pemakai — dropdown kode + nama */}
                    <td className="px-1 py-1.5">
                      <select data-row={line.key} data-field="dept"
                        value={line.deptPemakai}
                        onChange={(e)=>{ setLine(line.key,{deptPemakai:e.target.value}); setErrors((p)=>({...p,[`items.${line.key}.deptPemakai`]:undefined})); }}
                        onKeyDown={(e)=>onCellKey(e,line,index,'proses')}
                        className={inputClass(Boolean(eDept),true)}>
                        <option value="">— pilih dept —</option>
                        {DEPT_PEMAKAI_OPTIONS.map((d)=>(
                          <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                        ))}
                      </select>
                      {eDept && <p className="mt-1 text-xs text-rose-600">{eDept}</p>}
                    </td>
                    {/* Dept Proses — dropdown, default P1 */}
                    <td className="px-1 py-1.5">
                      <select data-row={line.key} data-field="proses"
                        value={line.deptProses}
                        onChange={(e)=>setLine(line.key,{deptProses:e.target.value})}
                        onKeyDown={(e)=>onCellKey(e,line,index,null)}
                        className={inputClass(false,true)}>
                        {DEPT_PROSES_OPTIONS.map((d)=>(
                          <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                        ))}
                        {/* Opsi bebas: kalau deptProses bukan dari list, tampilkan */}
                        {!DEPT_PROSES_OPTIONS.find((d)=>d.code===line.deptProses) && line.deptProses && (
                          <option value={line.deptProses}>{line.deptProses}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-1 py-1.5 pt-2.5">
                      <button type="button" tabIndex={-1} onClick={()=>removeLine(line.key)}
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
        {errors.items && <p className="text-xs text-rose-600">{errors.items}</p>}
        <button type="button" onClick={()=>addLine()}
          className="mt-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-brand-500 hover:text-brand-600 dark:border-slate-700">
          + Tambah Baris
        </button>
      </section>

      {serverError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {serverError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {outbound ? 'Jenis ini MENGURANGI saldo.' : 'Jenis ini MENAMBAH saldo.'}
          {overRows.length > 0 && <span className="ml-1 font-medium text-rose-600">{overRows.length} baris melebihi saldo.</span>}
        </p>
        <button type="submit" disabled={busy||overRows.length>0}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy && <Spinner className="h-4 w-4" />}
          {busy ? 'Menyimpan...' : 'Simpan BKB'}
        </button>
      </div>
    </form>
  );
}
