// Satu pintu akses API.
//
// Prioritas URL:
//   1) NEXT_PUBLIC_API_BASE eksplisit (mis. http://127.0.0.1:8000) -> backend FastAPI.
//   2) Tidak di-set -> pakai relative URL (Next.js API routes dummy).
//
// Mode dummy HANYA untuk development/demo. Di produksi (NODE_ENV=production)
// dummy routes menolak request dengan 503 (lihat lib/dummyGuard.js), dan helper
// di bawah melempar error yang jelas alih-alih diam-diam menampilkan data palsu.

const apiBaseFromEnv = process.env.NEXT_PUBLIC_API_BASE;
const allowDummyFromEnv = process.env.NEXT_PUBLIC_ALLOW_DUMMY;

function resolveBase() {
  if (apiBaseFromEnv && apiBaseFromEnv.length > 0) return apiBaseFromEnv.replace(/\/+$/, '');
  return ''; // relative URL -> Next.js route handler
}

// Backward-compat: banyak file import `API_BASE` (string kosong saat dummy).
export const API_BASE = resolveBase();

// True kalau frontend memakai Next.js dummy routes (bukan backend FastAPI).
export const IS_DUMMY_MODE = API_BASE === '';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DUMMY_EXPLICITLY_ALLOWED =
  allowDummyFromEnv === 'true' || allowDummyFromEnv === '1';

// Satu kali peringatan saat modul dimuat (di browser).
if (IS_DUMMY_MODE) {
  if (IS_PRODUCTION && !DUMMY_EXPLICITLY_ALLOWED) {
    console.error(
      '[BaliCivic] KRITIS: NEXT_PUBLIC_API_BASE kosong di build produksi. ' +
        'Frontend akan memakai data DUMMY dan bukan backend asli. ' +
        'Set NEXT_PUBLIC_API_BASE ke URL FastAPI, atau NEXT_PUBLIC_ALLOW_DUMMY=true ' +
        'kalau memang sengaja demo dengan data contoh.'
    );
  } else {
    console.warn(
      '[BaliCivic] Mode DEMO: memakai data dummy lokal, bukan backend FastAPI.'
    );
  }
}

function assertApiConfigured() {
  if (IS_DUMMY_MODE && IS_PRODUCTION && !DUMMY_EXPLICITLY_ALLOWED) {
    throw new Error(
      'Backend belum dikonfigurasi: NEXT_PUBLIC_API_BASE kosong di build produksi. ' +
        'Set env tersebut ke URL FastAPI (atau NEXT_PUBLIC_ALLOW_DUMMY=true untuk demo).'
    );
  }
}

// Ubah response non-OK jadi pesan yang bisa dibaca manusia.
async function toError(res, path) {
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    return new Error(
      `Terlalu banyak permintaan. Coba lagi${retry ? ` dalam ${retry} detik` : ' sebentar'}.`
    );
  }
  if (res.status === 503 && body.code === 'DUMMY_API_BLOCKED') {
    return new Error(
      body.detail ||
        'Data contoh dinonaktifkan di produksi. Hubungkan ke backend FastAPI.'
    );
  }
  return new Error(body.detail || `API ${res.status}: ${path}`);
}

export function apiUrl(path) {
  const base = resolveBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiGet(path) {
  assertApiConfigured();
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw await toError(res, path);
  return res.json();
}

export async function apiPut(path, body, opts = {}) {
  assertApiConfigured();
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toError(res, path);
  return res.json();
}

export async function apiPostForm(path, formData, opts = {}) {
  assertApiConfigured();
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    body: formData,
    headers: opts.headers || {},
  });
  if (!res.ok) throw await toError(res, path);
  return res.json();
}

export async function apiDelete(path, opts = {}) {
  assertApiConfigured();
  const res = await fetch(apiUrl(path), {
    method: 'DELETE',
    headers: opts.headers || {},
  });
  if (!res.ok) throw await toError(res, path);
  return res.json();
}

export function imgUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  // URL relatif untuk static (uploads/ di FastAPI) atau picsum/unsplash (absolute)
  const base = resolveBase();
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
}

// Ambil SEMUA issue lewat pagination.
//
// Endpoint /api/issues default limit=50 (max 200). Kalau frontend fetch tanpa
// param, laporan ke-51 dst tidak ikut -> statistik (total, distribusi, heatmap)
// jadi salah tanpa error. Helper ini looping per halaman sampai habis.
export async function fetchAllIssues({ pageSize = 200, maxPages = 50 } = {}) {
  assertApiConfigured();
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    const path = `/api/issues?limit=${pageSize}&offset=${page * pageSize}`;
    const res = await fetch(apiUrl(path));
    if (!res.ok) throw await toError(res, path);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break; // halaman terakhir
  }
  return all;
}
