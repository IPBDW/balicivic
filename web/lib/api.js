// Satu pintu akses API ke backend FastAPI.
//
// NEXT_PUBLIC_API_BASE berisi URL backend (mis. http://127.0.0.1:8000).
// Kalau dikosongkan, semua request memakai origin yang sama (same-origin),
// yaitu pola yang dipakai saat deploy di balik reverse proxy: frontend dan
// backend dilayani dari satu domain, jadi tidak ada masalah CORS.
// Jangan pernah menganggap base kosong sebagai "backend tidak ada" — request
// dengan path relatif tetap valid.

const apiBaseFromEnv = process.env.NEXT_PUBLIC_API_BASE;

function resolveBase() {
  if (apiBaseFromEnv && apiBaseFromEnv.length > 0) return apiBaseFromEnv.replace(/\/+$/, '');
  return '';
}

export const API_BASE = resolveBase();

// Hanya info, bukan error: base kosong = mode same-origin (valid).
if (!API_BASE && process.env.NODE_ENV !== 'production') {
  console.info(
    '[BaliCivic] NEXT_PUBLIC_API_BASE kosong — memakai origin yang sama ' +
      '(request ke /api/... di domain frontend).'
  );
}

async function toError(res, path) {
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    return new Error(
      `Terlalu banyak permintaan. Coba lagi${retry ? ` dalam ${retry} detik` : ' sebentar'}.`
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
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw await toError(res, path);
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
  if (!res.ok) throw await toError(res, path);
  return res.json();
}

export async function apiPostForm(path, formData, opts = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    body: formData,
    headers: opts.headers || {},
  });
  if (!res.ok) throw await toError(res, path);
  return res.json();
}

export async function apiDelete(path, opts = {}) {
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
  const base = resolveBase();
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
}

// Ambil SEMUA issue lewat pagination.
export async function fetchAllIssues({ pageSize = 200, maxPages = 50 } = {}) {
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    const path = `/api/issues?limit=${pageSize}&offset=${page * pageSize}`;
    const res = await fetch(apiUrl(path));
    if (!res.ok) throw await toError(res, path);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

// Ambil N laporan terbaru (mendukung opsi filter seperti excludeAman & minScore).
export async function fetchRecentIssuesList(limit = 10, options = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.minScore != null) params.set("min_score", String(options.minScore));
  if (options.excludeAman) params.set("exclude_aman", "true");
  if (options.status) params.set("status", options.status);
  if (options.issueClass) params.set("issue_class", options.issueClass);
  const path = `/api/issues?${params.toString()}`;
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw await toError(res, path);
  return res.json();
}
