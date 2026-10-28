// FILE: middleware.js
// Proteksi halaman & API di level router (berjalan di Edge, tanpa database).
// Lapisan pertama keamanan. Api routes tetap melakukan cek otorisasi sendiri
// (requireAuth/requireRole) sebagai lapisan kedua yang paling penting.

import { NextResponse } from 'next/server';
import { renewSessionToken, sessionCookieOptions, verifySessionToken } from '@/lib/auth/jwt';
import { getEnv } from '@/lib/env.js';

// Path yang bisa diakses TANPA login
const PUBLIC_PATHS = ['/login', '/api/login', '/api/operator-login', '/api/operators'];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('session')?.value;
  const payload = await verifySessionToken(token);
  const isApi = pathname.startsWith('/api');
  const idleMs = (getEnv().sessionIdleMinutes || 45) * 60 * 1000;
  const now = Date.now();
  let response = null;

  // Sesi menganggur terlalu lama -> paksa login ulang.
  if (payload && !isPublicPath(pathname) && now - Number(payload.iat || 0) * 1000 > idleMs) {
    const expired = isApi
      ? NextResponse.json(
          { ok: false, error: 'Sesi berakhir karena tidak ada aktivitas.' },
          { status: 401 }
        )
      : NextResponse.redirect(new URL('/login', request.url));
    expired.cookies.delete('session');
    return expired;
  }

  // Perpanjang iat tiap 5 menit; exp absolut tetap dari AUTH_SESSION_HOURS.
  if (payload && !isPublicPath(pathname) && now - Number(payload.iat || 0) * 1000 > 5 * 60 * 1000) {
    const renewed = await renewSessionToken(payload, payload.exp);
    response = NextResponse.next();
    response.cookies.set('session', renewed, sessionCookieOptions());
  }

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
  const isUserApi  = pathname.startsWith('/api/users');
  const isMesinPage = pathname.startsWith('/mesin');
  const isMachineApi = pathname.startsWith('/api/machines') && (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE');
  if (payload && (isUserPage || isUserApi || isMesinPage || isMachineApi) && payload.role !== 'admin') {
    if (isApi) {
      return NextResponse.json({ ok: false, error: 'Anda tidak memiliki akses ke fitur ini.' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 4) Operator hanya bisa akses ruang-tunggu + request API
  if (payload?.role === 'operator') {
    const allowedForOperator = [
      '/', '/ruang-tunggu',
      '/api/requests', '/api/items/search', '/api/items/running-saldo',
      '/api/bkb/next-doc', '/api/bkb/next-seq', '/api/machines',
      '/api/me', '/api/logout',
    ];
    const allowed = allowedForOperator.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'));
    if (!allowed && !isPublicPath(pathname)) {
      if (isApi) {
        return NextResponse.json({ ok: false, error: 'Operator hanya bisa mengakses form request.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/ruang-tunggu', request.url));
    }
  }

  return response || NextResponse.next();
}

export const config = {
  // jangan proses aset statis (gambar, font) agar middleware tidak perlu jalan untuk itu
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)',
  ],
};