// FILE: scripts/seed.js
// Membuat akun ADMIN pertama (dari .env.local) + contoh master barang bila masih kosong:
//   npm run seed
// Prasyarat: supabase/schema.sql sudah dijalankan di Supabase SQL Editor.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnv } from '../lib/env.js';
import { getRepository } from '../lib/db/index.js';
import { hashPassword } from '../lib/auth/password.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadDotEnvLocal();
  const env = validateEnv();
  console.log(`\n[seed] Supabase: ${env.supabaseUrl}`);
  const repo = getRepository();

  if (!env.adminEmail || !env.adminPassword) {
    throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di .env.local');
  }

  const existing = await repo.findByEmail(env.adminEmail.toLowerCase());
  if (existing) {
    console.log(`[seed] Admin sudah ada: ${existing.email} (role: ${existing.role}) — dilewati.`);
  } else {
    const admin = await repo.createUser({
      name: env.adminName,
      email: env.adminEmail.toLowerCase(),
      passwordHash: await hashPassword(env.adminPassword),
      role: 'admin',
    });
    console.log(`[seed] Akun admin berhasil dibuat: ${admin.email}`);
  }

  const { total } = await repo.listItems({ limit: 1 });
  if (total === 0) {
    // CONTOH saja untuk uji coba — ganti dengan master barang asli (hapus lewat aplikasi bila perlu)
    const contoh = [
      { categoryCode: '1', itemCode: 'RM-PP001', name: 'Biji Plastik PP Contoh', unit: 'kg', quantity: 5000 },
      { categoryCode: '1', itemCode: 'RM-PE002', name: 'Biji Plastik PE Contoh', unit: 'kg', quantity: 3000 },
      { categoryCode: '4', itemCode: 'BO-BTL01', name: 'Botol Olahan Contoh', unit: 'pcs', quantity: 1200 },
    ];
    for (const item of contoh) await repo.createItem(item, null);
    console.log(`[seed] ${contoh.length} contoh barang ditambahkan.`);
  } else {
    console.log(`[seed] Master barang sudah berisi ${total} barang — dilewati.`);
  }
  console.log('[seed] Selesai.\n');
}

main().catch((e) => {
  console.error('\n[seed] GAGAL:', e.message);
  process.exit(1);
});
