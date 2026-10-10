// lib/dummyStore.js
// In-memory store untuk dummy backend.
// NOTE: ini cuma untuk branch maintenance/frontend. Saat backend FastAPI
// sudah jalan, file ini obsolete — api.js frontend bisa langsung call ke
// backend beneran lewat NEXT_PUBLIC_API_BASE.

import { SAMPLE_ISSUES } from './dummyData.js';

// Clone sample data biar mutable (jangan mutate module-level const langsung).
let _store = SAMPLE_ISSUES.map(i => ({ ...i }));
let _nextId = _store.length + 1;

export function getAllIssues() {
  return _store;
}

export function getIssue(id) {
  return _store.find(i => i.id === Number(id));
}

export function addIssue(issue) {
  const id = _nextId++;
  const now = new Date().toISOString();
  const newIssue = {
    id,
    title: issue.title || 'Laporan Baru',
    description: issue.description || '',
    image_url: issue.image_url || null,
    latitude: issue.latitude ?? null,
    longitude: issue.longitude ?? null,
    kecamatan: null,
    kabupaten: null,
    issue_class: 'processing',
    final_score: 0,
    severity_label: 'LOW',
    breakdown_score: {},
    secondary_issues: [],
    meta_data: {},
    timeline: null,
    status: 'PENDING',
    created_at: now,
    updated_at: null,
    ...issue,
    id,
  };
  _store.unshift(newIssue);
  return newIssue;
}

export function updateIssue(id, patch) {
  const i = _store.findIndex(x => x.id === Number(id));
  if (i === -1) return null;
  _store[i] = {
    ..._store[i],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  return _store[i];
}

export function appendTimeline(id, event) {
  const i = _store.findIndex(x => x.id === Number(id));
  if (i === -1) return null;
  const tl = Array.isArray(_store[i].timeline) ? [..._store[i].timeline] : [];
  tl.push({
    ...event,
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });
  _store[i] = { ..._store[i], timeline: tl, updated_at: new Date().toISOString() };
  return _store[i];
}

export function deleteIssue(id) {
  const i = _store.findIndex(x => x.id === Number(id));
  if (i === -1) return null;
  const [removed] = _store.splice(i, 1);
  return removed;
}

// Simulasi proses analisis. Dipanggil setelah /api/analyze menerima upload.
// Update PENDING → DONE dalam 4–8 detik dengan skor random.
export function simulateAnalysis(id) {
  setTimeout(() => {
    const issue = _store.find(x => x.id === Number(id));
    if (!issue) return;
    const kelas = ['jalan_bolong', 'genangan_air', 'sampah_liar', 'kabel_berantakan'];
    issue.issue_class = kelas[Math.floor(Math.random() * kelas.length)];
    issue.final_score = 30 + Math.floor(Math.random() * 60);
    issue.severity_label = issue.final_score >= 75 ? 'HIGH' : issue.final_score >= 45 ? 'MEDIUM' : 'LOW';
    issue.title = `Laporan: ${issue.issue_class.replace('_', ' ')}`;
    issue.description = 'Analisis AI selesai. Laporan terverifikasi dan siap ditindaklanjuti oleh admin.';
    issue.status = 'PENDING'; // tetap PENDING untuk admin review
    issue.image_url = issue.image_url || `https://picsum.photos/seed/ai${id}/640/480`;
    issue.breakdown_score = {
      base: 30,
      area: Math.floor(issue.final_score * 0.3),
      perspective: Math.floor(issue.final_score * 0.1),
    };
    issue.timeline = [
      { status: 'PENDING', timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '), actor: 'Sistem', message: 'Laporan diterima' },
      { status: 'IN_PROGRESS', timestamp: new Date(Date.now() + 86400e3).toISOString().slice(0, 19).replace('T', ' '), actor: 'Sistem', message: 'Sedang dianalisis AI' },
    ];
    issue.updated_at = new Date().toISOString();
  }, 4000 + Math.random() * 4000);
}