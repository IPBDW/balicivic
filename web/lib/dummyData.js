// lib/dummyData.js
// Sample data untuk dummy backend.
// Digunakan oleh Next.js API routes di branch maintenance/frontend.
// Saat branch di-merge atau backend FastAPI siap, file ini jadi obsolete.

export const KELAS = ['jalan_bolong', 'genangan_air', 'sampah_liar', 'kabel_semrawut'];
// Class key disamakan dengan backend (utils.CLASS_LABEL_PUBLIC) supaya
// statistik/distribusi di frontend tidak salah hitung saat swap ke API asli.

export const KABUPATEN_BALI = [
  'Denpasar', 'Badung', 'Gianyar', 'Tabanan',
  'Buleleng', 'Klungkung', 'Bangli', 'Karangasem', 'Jembrana'
];

export const DUMMY_KECAMATAN = [
  'Denpasar Selatan', 'Denpasar Utara', 'Kuta', 'Kuta Utara',
  'Ubud', 'Gianyar', 'Tabanan', 'Mengwi',
];

// Kecamatan yang VALID per kabupaten (biar tidak muncul "Kuta, Gianyar").
// Kuta & Mengwi memang di Badung, Ubud/Gianyar di Gianyar, dst.
export const KECAMATAN_BY_KABUPATEN = {
  Denpasar:   ['Denpasar Selatan', 'Denpasar Utara', 'Denpasar Timur', 'Denpasar Barat'],
  Badung:     ['Kuta', 'Kuta Utara', 'Kuta Selatan', 'Mengwi'],
  Gianyar:    ['Ubud', 'Gianyar', 'Tegallalang', 'Payangan'],
  Tabanan:    ['Tabanan', 'Kediri', 'Pupuan', 'Marga'],
  Buleleng:   ['Buleleng', 'Singaraja', 'Sawan', 'Banjar'],
  Klungkung:  ['Klungkung', 'Banjarangkan', 'Dawan', 'Nusa Penida'],
  Bangli:     ['Bangli', 'Tembuku', 'Susut', 'Kintamani'],
  Karangasem: ['Karangasem', 'Rendang', 'Selat', 'Abang'],
  Jembrana:   ['Negara', 'Jembrana', 'Mendoyo', 'Melaya'],
};

// 30 laporan sample dengan variasi realistik
export const SAMPLE_ISSUES = (() => {
  const now = Date.now();
  const days = (n) => new Date(now - n * 86400e3).toISOString();

  const titles = {
    jalan_bolong: [
      'Lubang besar di tengah Jalan Tukad Yeh Aya',
      'Jalan rusak parah dekat SDN 4 Ubud',
      'Aspal mengelupas di jalur cepat Sunset Road',
      'Lubang dalam diameter 40cm di Jalan Bypass Ngurah Rai',
      'Bergelombang parah setelah hujan',
    ],
    genangan_air: [
      'Genangan 50cm tidak surut 3 hari',
      'Selokan tersumbat, air meluap ke jalan',
      'Drainase rusak, genangan di simpang tiga',
      'Banjir rob di pesisir Sanur',
    ],
    sampah_liar: [
      'Tumpukan sampah di tepi sungai',
      'Sampah menumpuk di pasar tradisional',
      'Limbah bangunan dibuang sembarangan',
      'Sampah plastik di sepanjang pantai',
    ],
    kabel_semrawut: [
      'Kabel menjuntai rendah di atas trotoar',
      'Tiang kabel miring hampir roboh',
      'Kabel melilit di pohon, bahaya konsleting',
    ],
  };

  // Deret status deterministik (bukan acak) — rotasi tetap.
  const statuses = ['PENDING', 'IN_PROGRESS', 'DONE', 'PENDING', 'IN_PROGRESS', 'DONE', 'PENDING'];

  // Pusat tiap kabupaten (koordinat sudah diverifikasi ADA DI DARATAN,
  // sama dengan yang dipakai dummyDashboard.js). Offset di bawah kecil
  // (maks ±0.005° ≈ 550 m) sehingga titik tidak pernah jatuh ke laut.
  const KAB_CENTER = {
    Denpasar:   [-8.6705, 115.2126],
    Badung:     [-8.7220, 115.1700],
    Gianyar:    [-8.5069, 115.2625],
    Tabanan:    [-8.5396, 115.1256],
    Buleleng:   [-8.1140, 115.0900],
    Klungkung:  [-8.5494, 115.4039],
    Bangli:     [-8.4567, 115.3547],
    Karangasem: [-8.4479, 115.6087],
    Jembrana:   [-8.3600, 114.6297],
  };
  const OFFSETS = [
    [0, 0], [0.004, 0.003], [-0.004, 0.002], [0.003, -0.004],
    [-0.003, -0.003], [0.005, 0.001], [-0.002, 0.004],
  ];

  const list = [];
  let id = 1;
  KELAS.forEach((kelas, kIdx) => {
    const arr = titles[kelas] || [];
    for (let i = 0; i < 7; i++) {
      const t = arr[i % arr.length] || `Laporan ${kelas}`;
      // Rotasi deterministik supaya 9 kabupaten kebagian merata.
      const kab = KABUPATEN_BALI[(kIdx * 7 + i) % KABUPATEN_BALI.length];
      // Kecamatan dipilih dari daftar yang VALID untuk kabupaten itu.
      const kecList = KECAMATAN_BY_KABUPATEN[kab] || DUMMY_KECAMATAN;
      const kec = kecList[(kIdx * 3 + i) % kecList.length];
      // Skor deterministik dari indeks (rentang 28..90).
      const score = 28 + ((kIdx * 13 + i * 9) % 63);
      const sev = score >= 75 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';
      const status = statuses[(kIdx + i) % statuses.length];
      const center = KAB_CENTER[kab] || [-8.5, 115.2];
      const off = OFFSETS[i % OFFSETS.length];
      const lat = +(center[0] + off[0]).toFixed(4);
      const lon = +(center[1] + off[1]).toFixed(4);
      const ageDays = ((kIdx * 5 + i * 2) % 14) + 1;

      list.push({
        id: id++,
        title: t,
        description: `Laporan dari warga: ${t}. Sudah berlangsung ${ageDays} hari. Mohon tindak lanjut dari dinas terkait.`,
        image_url: `https://picsum.photos/seed/${kelas}${i}/640/480`,
        latitude: lat,
        longitude: lon,
        kecamatan: kec,
        kabupaten: kab,
        issue_class: kelas,
        final_score: score,
        severity_label: sev,
        breakdown_score: {
          base: 30,
          area: Math.floor(score * 0.3),
          perspective: Math.floor(score * 0.1),
        },
        secondary_issues: [],
        meta_data: { source: 'dummy' },
        timeline: status === 'DONE' ? [
          { status: 'PENDING', timestamp: days(7), actor: 'Sistem', message: 'Laporan diterima' },
          { status: 'IN_PROGRESS', timestamp: days(5), actor: 'Admin Dinas', message: 'Tim diterjunkan' },
          { status: 'DONE', timestamp: days(1), actor: 'Admin Dinas', message: 'Selesai diperbaiki' },
        ] : status === 'IN_PROGRESS' ? [
          { status: 'PENDING', timestamp: days(3), actor: 'Sistem', message: 'Laporan diterima' },
          { status: 'IN_PROGRESS', timestamp: days(1), actor: 'Admin Dinas', message: 'Tim diterjunkan' },
        ] : null,
        status,
        created_at: days(ageDays),
        updated_at: days(Math.min(ageDays, 3)),
      });
    }
  });
  return list;
})();

// Public labels (mirror backend/utils.py:CLASS_LABEL_PUBLIC)
export const CLASS_LABEL_PUBLIC = {
  jalan_bolong: 'jalan bolong',
  genangan_air: 'genangan air',
  sampah_liar: 'sampah liar',
  kabel_semrawut: 'kabel berantakan',
};

// Distribution response (mirror backend/main.py:get_issue_distribution)
export function distributionFromIssues(issues) {
  const total = issues.length || 1;
  const counts = {
    jalan_bolong: issues.filter(i => i.issue_class === 'jalan_bolong').length,
    sampah_liar: issues.filter(i => i.issue_class === 'sampah_liar').length,
    genangan_air: issues.filter(i => i.issue_class === 'genangan_air').length,
    kabel_semrawut: issues.filter(i => i.issue_class === 'kabel_semrawut').length,
  };
  const data = [
    { label: 'Jalan Bolong', percent: Math.round(counts.jalan_bolong / total * 100), color: '#d32f2f', count: counts.jalan_bolong },
    { label: 'Sampah Liar', percent: Math.round(counts.sampah_liar / total * 100), color: '#f57c00', count: counts.sampah_liar },
    { label: 'Genangan Air', percent: Math.round(counts.genangan_air / total * 100), color: '#1976d2', count: counts.genangan_air },
    { label: 'Kabel Berantakan', percent: Math.round(counts.kabel_semrawut / total * 100), color: '#455a64', count: counts.kabel_semrawut },
  ];
  data.sort((a, b) => b.percent - a.percent);
  return data;
}

export function summaryFromIssues(issues) {
  return {
    total: issues.length,
    antrean: issues.filter(i => i.status === 'PENDING').length,
    perlu_tindakan: issues.filter(i => i.status === 'IN_PROGRESS').length,
    selesai: issues.filter(i => i.status === 'DONE').length,
    error: issues.filter(i => i.status === 'ERROR').length,
  };
}

export function topLocationsFromIssues(issues, n = 3) {
  const map = {};
  for (const i of issues) {
    if (!i.kabupaten) continue;
    map[i.kabupaten] = (map[i.kabupaten] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([kabupaten, total]) => ({ kabupaten, total }));
}

export function heatmapFromIssues(issues) {
  const points = issues
    .filter(i => i.latitude != null && i.longitude != null && i.final_score != null)
    .map(i => {
      const base = (i.final_score || 0) / 100.0;
      let intensity;
      if (i.severity_label === 'HIGH') intensity = Math.min(1.0, base * 1.2);
      else if (i.severity_label === 'MEDIUM') intensity = base;
      else intensity = Math.max(0.15, base * 0.7);
      return {
        lat: i.latitude,
        lon: i.longitude,
        intensity: Math.round(intensity * 1000) / 1000,
        class: i.issue_class,
        severity: i.severity_label,
        score: i.final_score,
        status: i.status,
      };
    });
  return { total: points.length, points };
}

// Admin token yang valid di dummy. Hardcoded — gak ada validasi.
export const DUMMY_ADMIN_TOKEN = 'dev-dummy-token-2026';

export function isAdminAuthorized(req) {
  const header = req.headers.get('x-admin-token') || '';
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token') || '';
  return header === DUMMY_ADMIN_TOKEN || queryToken === DUMMY_ADMIN_TOKEN;
}