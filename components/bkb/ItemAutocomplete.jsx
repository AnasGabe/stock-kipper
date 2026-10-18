'use client';

import { useEffect, useRef, useState } from 'react';
import { swrFetcher } from '@/lib/api-client';
import { CATEGORIES } from '@/lib/constants/bkb';
import { formatNumber } from '@/lib/utils';
import { inputClass } from '@/components/ui/Field';
import CameraScanner from '@/components/ui/CameraScanner';

export default function ItemAutocomplete({ rowKey, selected, onSelect, onClear, onPicked, hasError, autoFocus }) {
  const [text,      setText]      = useState('');
  const [options,   setOptions]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [active,    setActive]    = useState(0);
  const [busy,      setBusy]      = useState(false);
  const [notice,    setNotice]    = useState('');
  const [camOpen,   setCamOpen]   = useState(false);
  const reqId    = useRef(0);
  const timer    = useRef(null);
  const navigated = useRef(false);
  const inputRef  = useRef(null);

  // Autocomplete saat ketik (debounce 150ms)
  useEffect(() => {
    clearTimeout(timer.current);
    const q = text.trim();
    if (selected || q.length < 1) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const res = await swrFetcher(`/api/items/search?q=${encodeURIComponent(q)}`);
        if (id !== reqId.current) return;
        setOptions(res.data || []);
        setActive(0);
        navigated.current = false;
        setOpen(true);
      } catch { if (id === reqId.current) setOptions([]); }
    }, 150);
    return () => clearTimeout(timer.current);
  }, [text, selected]);

  function pick(item) {
    reqId.current += 1;
    clearTimeout(timer.current);
    setText(''); setOptions([]); setOpen(false); setNotice('');
    onSelect(item);
    onPicked?.(item);
  }

  // Dipanggil saat Enter (keyboard scanner atau user tekan Enter)
  async function handleEnter() {
    const code = text.trim();
    if (!code) return;
    clearTimeout(timer.current);

    // Sudah ada saran dipilih dengan panah
    if (open && options.length > 0 && navigated.current) {
      pick(options[active]); return;
    }

    const id = ++reqId.current;
    setBusy(true); setNotice('');
    try {
      // 1) Coba exact match barcode / item_code
      const exact = await swrFetcher(`/api/items/search?code=${encodeURIComponent(code)}`);
      if (id !== reqId.current) return;
      if (exact.data) { pick(exact.data); return; }

      // 2) Coba saran fuzzy
      const list = await swrFetcher(`/api/items/search?q=${encodeURIComponent(code)}`);
      if (id !== reqId.current) return;
      const found = list.data || [];
      if (found.length === 1) { pick(found[0]); }
      else if (found.length > 1) { setOptions(found); setActive(0); setOpen(true); setNotice('Beberapa barang cocok — pilih salah satu.'); }
      else { setNotice(`"${code}" tidak ada di master barang.`); }
    } catch (err) {
      if (id === reqId.current) setNotice(err.message || 'Gagal mencari barang.');
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  // Dipanggil saat kamera berhasil scan
  async function handleCamDetected(value) {
    setCamOpen(false);
    setText(value);
    // Langsung cari seperti Enter
    const id = ++reqId.current;
    setBusy(true); setNotice('');
    try {
      const exact = await swrFetcher(`/api/items/search?code=${encodeURIComponent(value)}`);
      if (id !== reqId.current) return;
      if (exact.data) { pick(exact.data); return; }
      const list = await swrFetcher(`/api/items/search?q=${encodeURIComponent(value)}`);
      if (id !== reqId.current) return;
      const found = list.data || [];
      if (found.length === 1) { pick(found[0]); }
      else if (found.length > 1) { setOptions(found); setActive(0); setOpen(true); setNotice('Beberapa barang cocok — pilih salah satu.'); }
      else { setNotice(`Barcode "${value}" tidak ditemukan di master. Tambahkan barcode di master barang.`); }
    } catch (err) {
      if (id === reqId.current) setNotice(err.message || 'Gagal mencari barang.');
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selected) { onPicked?.(selected); return; }
      handleEnter();
    } else if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault(); navigated.current = true; setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault(); navigated.current = true;
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <>
      {/* Modal kamera scan */}
      <CameraScanner open={camOpen} onDetected={handleCamDetected} onClose={() => setCamOpen(false)} />

      <div className="relative flex gap-1">
        {/* Input utama */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            data-row={rowKey}
            data-field="item"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            value={selected ? selected.itemCode : text}
            onChange={(e) => {
              if (selected) onClear();
              setNotice('');
              setText(e.target.value);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => options.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 130)}
            placeholder="Ketik kode / nama, atau scan"
            role="combobox"
            aria-expanded={open}
            aria-controls={`ac-${rowKey}`}
            aria-autocomplete="list"
            className={`${inputClass(hasError || Boolean(notice), true)} font-mono ${selected ? 'font-semibold pr-6' : ''} w-full`}
          />
          {/* Spinner saat fetch */}
          {busy && (
            <span className="absolute right-2 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          )}
          {/* Tanda barang sudah dipilih */}
          {selected && !busy && (
            <button type="button" tabIndex={-1} onClick={() => { onClear(); setText(''); setTimeout(() => inputRef.current?.focus(), 30); }}
              title="Hapus pilihan"
              className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:text-rose-500">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Tombol kamera scan */}
        <button
          type="button"
          onClick={() => setCamOpen(true)}
          title="Scan barcode via kamera"
          className="flex-shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-slate-500 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 00-1 1v3"/>
            <rect x="8" y="8" width="8" height="8" rx="1" strokeWidth="1.8"/>
          </svg>
        </button>
      </div>

      {notice && <p className="mt-1 text-xs text-rose-600">{notice}</p>}

      {/* Dropdown saran */}
      {open && options.length > 0 && (
        <ul id={`ac-${rowKey}`} role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-64 min-w-[320px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === active}
              onMouseDown={(e) => { e.preventDefault(); pick(item); }}
              onMouseEnter={() => { navigated.current = true; setActive(index); }}
              className={`cursor-pointer border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-800 ${index === active ? 'bg-brand-50 dark:bg-slate-800' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{item.itemCode}</span>
                <span className="shrink-0 text-xs text-slate-400">Saldo {formatNumber(item.quantity)} {item.unit}</span>
              </div>
              <p className="truncate text-xs text-slate-500">
                {item.name} · {CATEGORIES[item.categoryCode]?.label} (Lok. {item.locationCode})
                {item.barcode && <span className="ml-1 text-slate-400">· BC: {item.barcode}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
