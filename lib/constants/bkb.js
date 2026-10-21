// FILE: lib/constants/bkb.js

export const CATEGORIES = {
  1: { code: '1', label: 'Raw Material',   location: '100', locCode: '110' },
  4: { code: '4', label: 'Barang Olahan',  location: '800', locCode: '410' },
};
export const CATEGORY_CODES = ['1', '4'];
export const locationForCategory = (code) => CATEGORIES[code]?.location || '';
export const locCodeForKategori  = (code) => CATEGORIES[code]?.locCode  || '110';

// Pilihan header BKB: jenis barang (menentukan 110/410 di No Dokumen)
export const BKB_KATEGORI_OPTIONS = [
  { value: '1', label: '1 — Raw Material',   locCode: '110' },
  { value: '4', label: '4 — Barang Olahan',  locCode: '410' },
];

// ---------- JENIS TRANSAKSI ----------
export const JENIS_TRANSAKSI = [
  { value: 'PB',  label: 'PB — Pemakaian',                direction: 'out' },
  { value: 'PR',  label: 'PR — Hasil Produksi',           direction: 'in'  },
  { value: 'RP',  label: 'RP — Retur Pemakaian',          direction: 'in'  },
  { value: 'BTL', label: 'BTL — Transfer Internal Lokasi',direction: 'out' },
  { value: 'TRM', label: 'TRM — Transfer In',             direction: 'in'  },
];
export const JENIS_VALUES = JENIS_TRANSAKSI.map((j) => j.value);
export const LOG_LABEL = {
  PB:'Pemakaian', PR:'Hasil Produksi', RP:'Retur Pemakaian',
  BTL:'Transfer Keluar', TRM:'Transfer In', SA:'Saldo Awal', ADJ:'Koreksi Saldo',
};
export function directionOf(jenis) {
  return JENIS_TRANSAKSI.find((j) => j.value === jenis)?.direction || 'in';
}

// ---------- REFERENSI SIFT ----------
export const SIFT_OPTIONS = [
  { value: '1', label: 'Sift 1' },
  { value: '2', label: 'Sift 2' },
  { value: '3', label: 'Sift 3' },
];

// ---------- TUJUAN (bagian pertama keterangan) ----------
export const TUJUAN_OPTIONS = [
  { value: 'BIP',        label: 'BIP',          mesin: false, hint: 'Blow Injection / Proses Biasa' },
  { value: 'INJ1',       label: 'INJ 1',        mesin: true,  hint: 'Injection Mesin 1' },
  { value: 'INJ2',       label: 'INJ 2',        mesin: true,  hint: 'Injection Mesin 2' },
  { value: 'INJ3',       label: 'INJ 3',        mesin: true,  hint: 'Injection Mesin 3' },
  { value: 'IHW',        label: 'IHW',          mesin: false, hint: 'In-House Work' },
  { value: 'SA',         label: 'SA',           mesin: false, hint: 'Sub Assy (ke PL005)' },
  { value: 'RETUR',      label: 'RETUR',        mesin: false, hint: 'Retur Pemakaian' },
  { value: 'DISTRIBUSI', label: 'DISTRIBUSI',   mesin: false, hint: 'Distribusi / Penjualan' },
  { value: 'RAKIT',      label: 'RAKIT',        mesin: false, hint: 'Ke bagian perakitan' },
  { value: 'TEMPEL',     label: 'TEMPEL',       mesin: false, hint: 'Proses penempelan' },
  { value: 'PROSES',     label: 'PROSES',       mesin: false, hint: 'Proses produksi' },
  { value: 'HASIL',      label: 'HASIL',        mesin: false, hint: 'Hasil produksi' },
];
export const TUJUAN_VALUES = TUJUAN_OPTIONS.map((t) => t.value);
export const MACHINE_REQUIRED_FOR_INJ = true;
export function isTujuanInj(tujuan) { return /^INJ/i.test(String(tujuan || '')); }
export function isInjKeterangan(tujuan) { return isTujuanInj(tujuan); }

// ---------- DEPT PEMAKAI ----------
export const DEPT_PEMAKAI_OPTIONS = [
  { code: 'PL001', name: 'PPIC PLASTIK' },
  { code: 'PL003', name: 'PRODUKSI PLASTIK' },
  { code: 'PL005', name: 'SUB ASSY' },
  { code: '45',    name: 'PACKING / AP' },
  { code: '52',    name: 'CRUSSER / REJECT' },
  { code: '5501',  name: 'PROSES GUDANG' },
  { code: '240',   name: 'LOKASI DISTRIBUSI / PENJUALAN' },
];
export const deptPemakaiLabel = (code) => {
  const d = DEPT_PEMAKAI_OPTIONS.find((x) => x.code === code);
  return d ? `${d.code} — ${d.name}` : code;
};

// ---------- DEPT PROSES (default list, bisa override dari DB) ----------
export const DEPT_PROSES_OPTIONS = [
  { code: 'P1', name: 'PLASTIK UMUM' },
  { code: 'P2', name: 'PLASTIK FULL' },
  { code: 'P3', name: 'PLASTIK KECIL' },
  { code: 'P4', name: 'PLASTIK FINISHING' },
  { code: 'P5', name: 'PLASTIK ASSEMBLY' },
];
export const DEFAULT_DEPT_PROSES = 'P1';

// ---------- ROLES ----------
export const ROLES = {
  admin:    { label: 'Admin (Data Entry)',  canInputBkb: true,  canVerify: false, canApproveFinal: true  },
  staff:    { label: 'Stock Keeper',        canInputBkb: true,  canVerify: true,  canApproveFinal: false },
  operator: { label: 'Operator',            canInputBkb: false, canVerify: false, canApproveFinal: false },
};

// ---------- STATUS RUANG TUNGGU ----------
export const REQUEST_STATUS = {
  menunggu:       { label: 'Menunggu',      color: 'yellow' },
  terverifikasi:  { label: 'Terverifikasi', color: 'blue'   },
  selesai:        { label: 'Selesai',       color: 'green'  },
};

// ---------- NO DOKUMEN GENERATOR ----------
// Format: PB410-26I00001
// jenis(2-3) + locCode(3) + '-' + tahun2(2) + bulanInisial(1) + urut5(5)
export const BULAN_INISIAL = {
  1:'A', 2:'B', 3:'C', 4:'D', 5:'E', 6:'F',
  7:'G', 8:'H', 9:'I', 10:'J', 11:'K', 12:'L',
};
export function buildDocNoPrefix(jenis, bkbKategori, dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const year2 = String(d.getUTCFullYear()).slice(-2);
  const bulan = BULAN_INISIAL[d.getUTCMonth() + 1] || 'X';
  const locCode = locCodeForKategori(bkbKategori);
  return `${jenis}${locCode}-${year2}${bulan}`;
}
export function buildDocNo(jenis, bkbKategori, dateStr, urut) {
  return `${buildDocNoPrefix(jenis, bkbKategori, dateStr)}${String(urut).padStart(5,'0')}`;
}

// ---------- KETERANGAN ----------
export function buildKeteranganExtra(tujuan, inisial, nomor) {
  const parts = [tujuan];
  if (inisial) parts.push(String(inisial).toUpperCase());
  if (nomor)   parts.push(String(nomor));
  return parts.join('/');
}
export function nameToInitial(name) {
  return (String(name || '').match(/\S+/)?.[0] || '???').slice(0, 3).toUpperCase();
}

export const MAX_QTY = 100000000;
