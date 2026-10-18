# Stok Hub — Digitalisasi Bukti Keluar Barang (BKB)

Next.js 15 (App Router, JavaScript) · Supabase PostgreSQL + Realtime · SWR · Zod · Tailwind.
Mengganti form BKB fisik (tulisan tangan) dengan input digital yang tervalidasi, saldo stok
yang selalu konsisten, dan riwayat mutasi lengkap.

## Role
| Role | Hak |
|---|---|
| **Admin (Data Entry)** | Input BKB, kelola master barang, lihat daftar BKB & riwayat, kelola pengguna |
| **Staff (Stock Keeper)** | Hanya **melihat** daftar BKB, master & saldo, riwayat. API menolak (403) semua tulis |

## Halaman
- `/` Dashboard — jumlah barang per kategori, BKB hari ini, transaksi terbaru, saldo terendah (realtime)
- `/stok` — tab **Input BKB** (Admin) · **Daftar BKB** · **Master & Saldo Stok**
- `/aktivitas` — `transactions_log`: waktu, jenis, no dokumen, keterangan, mesin, barang, saldo sebelum→sesudah, aktor
- `/user` — manajemen pengguna (Admin)

## Aturan bisnis (ditegakkan di UI, Zod/server, **dan** database)
- Kategori `1` = Raw Material → lokasi `100`; `4` = Barang Olahan → lokasi `800` (otomatis).
- Jenis: PB, PR, RP, BTL, TRM. PB/BTL mengurangi saldo; lainnya menambah.
- **Mesin hanya boleh diisi jika Keterangan INJ** (dropdown Keterangan + teks tambahan, mis. `BIP/AND/1`).
- QTY > 0, dan untuk PB/BTL tidak boleh melebihi **Saldo KS** → stok tidak pernah minus.
  Pengecekan akhir ada di fungsi SQL `create_bkb` (baris barang dikunci `FOR UPDATE`), jadi dua admin
  yang input bersamaan tetap aman.
- Dept Proses default `P1` (bisa diubah). Satu barang tidak boleh dobel dalam satu BKB.

## Alur entri cepat (form BKB)
Kursor di **Kode Barang** → scan barcode (scanner mode keyboard + Enter) → barang terisi otomatis →
`Enter` ke QTY → Dept Pemakai → Dept Proses → baris baru. `Ctrl+Enter` = Simpan.

## Realtime
Trigger database mengirim sinyal ringan via **Realtime Broadcast** (topik `stok-hub`) saat
`items`/`bkb`/`transactions_log` berubah; `hooks/useRealtimeSWR.js` memuat ulang data semua layar.
Detail & alasan memilih Broadcast: lihat `MIGRASI_SUPABASE.md`.

## Menjalankan
Ikuti **`MIGRASI_SUPABASE.md`** (jalankan `supabase/schema.sql`, isi `.env.local`), lalu:
```bash
npm install && npm run seed && npm run dev
```
