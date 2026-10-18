// FILE: app/(dashboard)/user/page.js
// Halaman PENGELOLAAN USER — hanya bisa dibuka oleh admin.
// Dicek dua lapis: middleware (dari JWT) + di sini dari database.

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import UserPage from '@/components/users/UserPage';

export const metadata = { title: 'Pengguna' };

export default async function UserPageRoute() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // bukan admin? consent langsung ke dashboard (bukan sekadar sembunyikan menu)
  if (user.role !== 'admin') redirect('/');

  return <UserPage currentUser={user} />;
}