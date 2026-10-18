// FILE: middleware.js
// Proteksi halaman & API di level router (berjalan di Edge, tanpa database).
// Lapisan pertama keamanan. Api routes tetap melakukan cek otorisasi sendiri
// (requireAuth/requireRole) sebagai lapisan kedua yang paling penting.

import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/jwt';

// Path yang bisa diakses TANPA login
const PUBLIC_PATHS = ['/login', '/api/login'];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('session')?.value;
  const payload = await verifySessionToken(token);

  const isApi = pathname.startsWith('/api');

  // 1) Wajib login: halaman & API selain yang publik
  if (!isPublicPath(pathname) && !payload) {
    if (isApi) {
      return NextResponse.json({ ok: false, error: 'Tidak terautentikasi.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2) Sudah login tapi membuka halaman login -> kembali ke dashboard
  if (pathname === '/login' && payload) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3) Halaman/API khusus admin (cek role dari token; API juga dicek lagi di handler)
  const isUserPage = pathname.startsWith('/user');
  const isUserApi = pathname.startsWith('/api/users');
  if (payload && (isUserPage || isUserApi) && payload.role !== 'admin') {
    if (isApi) {
      return NextResponse.json({ ok: false, error: 'Anda tidak memiliki akses ke fitur ini.' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // jangan proses aset statis (gambar, font) agar middleware tidak perlu jalan untuk itu
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)',
  ],
};