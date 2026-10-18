// FILE: app/(dashboard)/page.js
// Halaman DASHBOARD — server component yang memastikan sesi + menyiapkan data user.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import DashboardView from '@/components/dashboard/DashboardView';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return <DashboardView isAdmin={user.role === 'admin'} />;
}