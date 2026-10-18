// FILE: app/(dashboard)/stok/page.js
// Halaman STOK BARANG — server component tipis, isi utamanya StockPage (client).

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import StockPage from '@/components/items/StockPage';

export const metadata = { title: 'Stok & BKB' };

export default async function StockPageRoute() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return <StockPage user={{ id: user.id, name: user.name, role: user.role }} />;
}