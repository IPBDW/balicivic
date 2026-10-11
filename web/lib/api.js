// Satu pintu akses API.
//
// Prioritas URL:
//   1) NEXT_PUBLIC_API_BASE eksplisit (mis. http://127.0.0.1:8000) → backend FastAPI.
//   2) Tidak di-set → pakai relative URL (Next.js API routes di branch dummy).
//
// Catatan: di branch maintenance/frontend, .env.local TIDAK set NEXT_PUBLIC_API_BASE
// (atau unset), jadi call ke /api/* = Next.js dummy routes.
// Saat backend FastAPI siap, set NEXT_PUBLIC_API_BASE=http://localhost:8000 dan
// frontend otomatis point ke sana.

const apiBaseFromEnv = process.env.NEXT_PUBLIC_API_BASE;

function resolveBase() {
  if (apiBaseFromEnv && apiBaseFromEnv.length > 0) return apiBaseFromEnv.replace(/\/+$/, '');
  return ''; // relative URL → Next.js route handler
}

// Backward-compat: banyak file import `API_BASE` (string kosong saat dummy).
export const API_BASE = resolveBase();

export function apiUrl(path) {
  const base = resolveBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiGet(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export async function apiPut(path, body, opts = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API ${res.status}`);
  }
  return res.json();
}

export async function apiPostForm(path, formData, opts = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    body: formData,
    headers: opts.headers || {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API ${res.status}`);
  }
  return res.json();
}

export async function apiDelete(path, opts = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'DELETE',
    headers: opts.headers || {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API ${res.status}`);
  }
  return res.json();
}

export function imgUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  // URL relatif untuk static (uploads/ di FastAPI) atau picsum/unsplash (absolute)
  const base = resolveBase();
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
}