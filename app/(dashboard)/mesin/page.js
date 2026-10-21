import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import MesinPage from '@/components/mesin/MesinPage';

export const metadata = { title: 'Master Mesin — Stok Hub' };

export default async function MesinPageServer() {
    const user = await getSessionUser();
    if (!user) redirect('/login');
    if (user.role !== 'admin') redirect('/');

    return <MesinPage />;
}