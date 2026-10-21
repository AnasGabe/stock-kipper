import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import RuangTunggu from '@/components/requests/RuangTunggu';

export const metadata = { title: 'Ruang Tunggu — Stok Hub' };

export default async function RuangTungguPage() {
    const user = await getSessionUser();
    if (!user) redirect('/login');

    return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Ruang Tunggu</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.role === 'admin'
            ? 'Review dan approve request dari operator. Request terverifikasi bisa langsung diproses menjadi BKB.'
            : user.role === 'staff'
            ? 'Verifikasi request dari operator. Cek fisik barang sebelum verifikasi.'
            : 'Daftar request barang yang sedang menunggu verifikasi.'}
        </p>
      </div>
      <RuangTunggu user={user} />
    </div>
  );
}