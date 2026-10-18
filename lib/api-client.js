// FILE: lib/api-client.js
// Helper untuk memanggil API dari sisi klien (browser).
// Semua call memakai fetch biasa + handling error yang rapi.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// untuk useSWR: ambil data lalu balikin pesan error yang bisa ditampilkan
export async function swrFetcher(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Terjadi kesalahan saat memuat data.', res.status);
  }
  return data;
}

// untuk POST/PUT/DELETE dengan body JSON
export async function apiFetch(url, { method = 'POST', body = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Terjadi kesalahan. Silakan coba lagi.', res.status);
  }
  return data;
}