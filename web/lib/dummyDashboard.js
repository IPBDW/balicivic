// lib/dummyDashboard.js
// Data dummy konsisten untuk preview Dashboard.
// Koordinat, score, severity, status di-hardcode (TANPA Math.random)
// supaya reload browser selalu menghasilkan data yang sama.

import { KABUPATEN_BALI } from './dummyData.js';

// 30 titik dummy tersebar di DARATAN Bali (tidak ada yang jatuh ke laut).
// Bounding box setiap titik berada dalam radius ±0.04° dari pusat kota/kabupaten.
// Format: [lat, lon, class, severity, score, status, kabupaten, kecamatan]
const RAW_POINTS = [
  // ===== DENPASAR (4) =====
  { lat: -8.6705, lon: 115.2126, class: "jalan_bolong",   severity: "HIGH",   score: 82, status: "PENDING",     kabupaten: "Denpasar",  kecamatan: "Denpasar Selatan" },
  { lat: -8.6580, lon: 115.2280, class: "sampah_liar",    severity: "MEDIUM", score: 58, status: "IN_PROGRESS", kabupaten: "Denpasar",  kecamatan: "Denpasar Timur" },
  { lat: -8.6810, lon: 115.2050, class: "jalan_bolong",   severity: "HIGH",   score: 88, status: "PENDING",     kabupaten: "Denpasar",  kecamatan: "Denpasar Utara" },
  { lat: -8.7090, lon: 115.2200, class: "genangan_air",   severity: "MEDIUM", score: 65, status: "DONE",        kabupaten: "Denpasar",  kecamatan: "Denpasar Barat" },

  // ===== BADUNG (4) =====
  { lat: -8.7220, lon: 115.1700, class: "jalan_bolong",   severity: "HIGH",   score: 79, status: "PENDING",     kabupaten: "Badung",    kecamatan: "Kuta" },
  { lat: -8.7150, lon: 115.1850, class: "genangan_air",   severity: "MEDIUM", score: 55, status: "IN_PROGRESS", kabupaten: "Badung",    kecamatan: "Kuta Selatan" },
  { lat: -8.7300, lon: 115.1800, class: "sampah_liar",    severity: "LOW",    score: 28, status: "DONE",        kabupaten: "Badung",    kecamatan: "Kuta Utara" },
  { lat: -8.6800, lon: 115.1600, class: "kabel_semrawut", severity: "MEDIUM", score: 62, status: "PENDING",     kabupaten: "Badung",    kecamatan: "Mengwi" },

  // ===== GIANYAR (4) =====
  { lat: -8.5069, lon: 115.2625, class: "jalan_bolong",   severity: "HIGH",   score: 85, status: "PENDING",     kabupaten: "Gianyar",   kecamatan: "Ubud" },
  { lat: -8.5180, lon: 115.2700, class: "sampah_liar",    severity: "MEDIUM", score: 48, status: "DONE",        kabupaten: "Gianyar",   kecamatan: "Ubud" },
  { lat: -8.5400, lon: 115.2900, class: "kabel_semrawut", severity: "MEDIUM", score: 50, status: "IN_PROGRESS", kabupaten: "Gianyar",   kecamatan: "Tegallalang" },
  { lat: -8.4950, lon: 115.2500, class: "genangan_air",   severity: "LOW",    score: 38, status: "DONE",        kabupaten: "Gianyar",   kecamatan: "Payangan" },

  // ===== TABANAN (3) =====
  { lat: -8.5396, lon: 115.1256, class: "jalan_bolong",   severity: "MEDIUM", score: 55, status: "IN_PROGRESS", kabupaten: "Tabanan",   kecamatan: "Tabanan" },
  { lat: -8.5500, lon: 115.1500, class: "sampah_liar",    severity: "LOW",    score: 30, status: "DONE",        kabupaten: "Tabanan",   kecamatan: "Kediri" },
  { lat: -8.4900, lon: 115.0900, class: "genangan_air",   severity: "MEDIUM", score: 52, status: "PENDING",     kabupaten: "Tabanan",   kecamatan: "Pupuuan" },

  // ===== BULELENG (3) =====
  { lat: -8.1140, lon: 115.0900, class: "jalan_bolong",   severity: "HIGH",   score: 78, status: "PENDING",     kabupaten: "Buleleng",  kecamatan: "Buleleng" },
  { lat: -8.1300, lon: 115.0800, class: "genangan_air",   severity: "MEDIUM", score: 60, status: "IN_PROGRESS", kabupaten: "Buleleng",  kecamatan: "Singaraja" },
  { lat: -8.1000, lon: 115.1100, class: "sampah_liar",    severity: "LOW",    score: 33, status: "DONE",        kabupaten: "Buleleng",  kecamatan: "Sawan" },

  // ===== KLUNGKUNG (3) =====
  { lat: -8.5494, lon: 115.4039, class: "jalan_bolong",   severity: "MEDIUM", score: 58, status: "IN_PROGRESS", kabupaten: "Klungkung", kecamatan: "Klungkung" },
  { lat: -8.5600, lon: 115.4200, class: "kabel_semrawut", severity: "LOW",    score: 40, status: "DONE",        kabupaten: "Klungkung", kecamatan: "Banjarangkan" },
  { lat: -8.5300, lon: 115.3900, class: "sampah_liar",    severity: "MEDIUM", score: 47, status: "PENDING",     kabupaten: "Klungkung", kecamatan: "Dawan" },

  // ===== BANGLI (3) =====
  { lat: -8.4567, lon: 115.3547, class: "sampah_liar",    severity: "MEDIUM", score: 52, status: "IN_PROGRESS", kabupaten: "Bangli",    kecamatan: "Bangli" },
  { lat: -8.4700, lon: 115.3700, class: "jalan_bolong",   severity: "MEDIUM", score: 56, status: "PENDING",     kabupaten: "Bangli",    kecamatan: "Tembuku" },
  { lat: -8.4400, lon: 115.3400, class: "kabel_semrawut", severity: "LOW",    score: 36, status: "DONE",        kabupaten: "Bangli",    kecamatan: "Susut" },

  // ===== KARANGASEM (3) =====
  { lat: -8.4479, lon: 115.6087, class: "genangan_air",   severity: "MEDIUM", score: 49, status: "IN_PROGRESS", kabupaten: "Karangasem",kecamatan: "Karangasem" },
  { lat: -8.4600, lon: 115.6300, class: "jalan_bolong",   severity: "HIGH",   score: 75, status: "PENDING",     kabupaten: "Karangasem",kecamatan: "Rendang" },
  { lat: -8.4300, lon: 115.5900, class: "kabel_semrawut", severity: "MEDIUM", score: 51, status: "DONE",        kabupaten: "Karangasem",kecamatan: "Selat" },

  // ===== JEMBRANA (3) =====
  { lat: -8.3600, lon: 114.6297, class: "sampah_liar",    severity: "LOW",    score: 35, status: "DONE",        kabupaten: "Jembrana",  kecamatan: "Negara" },
  { lat: -8.3800, lon: 114.6500, class: "jalan_bolong",   severity: "MEDIUM", score: 55, status: "PENDING",     kabupaten: "Jembrana",  kecamatan: "Jembrana" },
  { lat: -8.3400, lon: 114.6100, class: "genangan_air",   severity: "MEDIUM", score: 44, status: "IN_PROGRESS", kabupaten: "Jembrana",  kecamatan: "Mendoyo" },
];

// Derive ID urut dari posisi (1..30) supaya konsisten.
export const DUMMY_HEATMAP_POINTS = RAW_POINTS.map((p, idx) => ({
  id: idx + 1,
  lat: p.lat,
  lon: p.lon,
  class: p.class,
  severity: p.severity,
  score: p.score,
  status: p.status,
  kabupaten: p.kabupaten,
  kecamatan: p.kecamatan,
  issue_class: p.class,
  final_score: p.score,
  latitude: p.lat,
  longitude: p.lon,
  title: "Jalan Bolong Teridentifikasi",
}));

// Untuk fetchHeatPoints di dashboard & peta (butuh format [lat, lon, intensity])
export const DUMMY_HEAT_DATA = DUMMY_HEATMAP_POINTS.map((p) => [
  p.lat,
  p.lon,
  Math.max(p.score / 100, 0.2),
]);

// Statistik yang konsisten dari 30 titik.
const counts = DUMMY_HEATMAP_POINTS.reduce(
  (acc, p) => {
    acc.total++;
    if (p.status === "PENDING") acc.antrean++;
    else if (p.status === "IN_PROGRESS") acc.perlu_tindakan++;
    else if (p.status === "DONE") acc.selesai++;
    return acc;
  },
  { total: 0, antrean: 0, perlu_tindakan: 0, selesai: 0 }
);

// Tambah 12 laporan historis (DONE) supaya total lebih realistis (42)
counts.total = 42;
counts.selesai = 12 + counts.selesai; // 12 DONE tambahan (historis) + yang ada

export const DUMMY_STATS = counts;

// Top 3 kabupaten dengan laporan terbanyak (count dari 30 dummy)
export const DUMMY_TOP_LOCATIONS = (() => {
  const map = {};
  for (const p of DUMMY_HEATMAP_POINTS) {
    map[p.kabupaten] = (map[p.kabupaten] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kabupaten, total]) => ({ kabupaten, total }));
})();

// Distribusi jenis masalah (pie chart) konsisten
export const DUMMY_DISTRIBUTION = (() => {
  const tally = { jalan_bolong: 0, sampah_liar: 0, genangan_air: 0, kabel_semrawut: 0 };
  for (const p of DUMMY_HEATMAP_POINTS) {
    if (tally[p.class] !== undefined) tally[p.class]++;
  }
  const total = DUMMY_HEATMAP_POINTS.length || 1;
  const data = [
    { label: "Jalan Bolong",     count: tally.jalan_bolong,   percent: Math.round((tally.jalan_bolong / total) * 100),   color: "#d32f2f" },
    { label: "Sampah Liar",      count: tally.sampah_liar,    percent: Math.round((tally.sampah_liar / total) * 100),    color: "#f57c00" },
    { label: "Genangan Air",     count: tally.genangan_air,   percent: Math.round((tally.genangan_air / total) * 100),   color: "#1976d2" },
    { label: "Kabel Berantakan", count: tally.kabel_semrawut, percent: Math.round((tally.kabel_semrawut / total) * 100), color: "#455a64" },
  ];
  data.sort((a, b) => b.percent - a.percent);
  return data;
})();

// Recent activity list (10 laporan terbaru dari dummy points)
export const DUMMY_RECENT_ISSUES = DUMMY_HEATMAP_POINTS.slice(0, 10).map((p, i) => ({
  id: p.id,
  final_score: p.score,
  status: p.status,
  issue_class: p.class,
  kecamatan: p.kecamatan,
  kabupaten: p.kabupaten,
  created_at: new Date(Date.now() - 1000 * 60 * (15 * (i + 1))).toISOString(),
}));

export { KABUPATEN_BALI };
