// lib/dummyData.js
// Sample data untuk dummy backend.
// Digunakan oleh Next.js API routes di branch maintenance/frontend.
// Saat branch di-merge atau backend FastAPI siap, file ini jadi obsolete.

export const KELAS = ['jalan_bolong', 'genangan_air', 'sampah_liar', 'kabel_berantakan'];
// Note: di dummy kita pake 'kabel_berantakan' (label baru) sebagai class key.
// Backend beneran pake 'kabel_semrawut' — beda ini nanti di-mapping saat swap.

export const KABUPATEN_BALI = [
  'Denpasar', 'Badung', 'Gianyar', 'Tabanan',
  'Buleleng', 'Klungkung', 'Bangli', 'Karangasem', 'Jembrana'
];

// Pusat koordinat per kabupaten (latitude, longitude) — pakai titik tengah
// kabupaten asli Bali. Hotspot logic: weighted random berdasarkan kepadatan.
export const KABUPATEN_COORDS = {
  Denpasar:    { lat: -8.6705, lng: 115.2126, weight: 5 }, // kota, tertinggi
  Badung:      { lat: -8.5828, lng: 115.1767, weight: 4 }, // wisata
  Gianyar:     { lat: -8.5444, lng: 115.3269, weight: 3 }, // ubud area
  Tabanan:     { lat: -8.5393, lng: 115.1256, weight: 2 },
  Buleleng:    { lat: -8.1131, lng: 114.9427, weight: 2 },
  Klungkung:   { lat: -8.5389, lng: 115.4036, weight: 1 },
  Bangli:      { lat: -8.4547, lng: 115.3547, weight: 1 },
  Karangasem:  { lat: -8.4467, lng: 115.6600, weight: 1 },
  Jembrana:    { lat: -8.3620, lng: 114.6833, weight: 1 }, // paling barat, rendah
};

// Pool kecamatan per kabupaten (subset realistis)
export const DUMMY_KECAMATAN = {
  Denpasar:   ['Denpasar Selatan', 'Denpasar Utara', 'Denpasar Timur', 'Denpasar Barat'],
  Badung:     ['Kuta', 'Kuta Utara', 'Kuta Selatan', 'Mengwi', 'Abiansemal', 'Petang'],
  Gianyar:    ['Ubud', 'Gianyar', 'Sukawati', 'Tampaksiring', 'Blahbatuh'],
  Tabanan:    ['Tabanan', 'Kediri', 'Kerambitan', 'Penarukan', 'Selemadeg'],
  Buleleng:   ['Buleleng', 'Singaraja', 'Seririt', 'Busungbiu', 'Sawan'],
  Klungkung:  ['Klungkung', 'Nusa Penida', 'Banjarangkan', 'Dawan'],
  Bangli:     ['Bangli', 'Kintamani', 'Tembuku', 'Susut'],
  Karangasem: ['Karangasem', 'Amed', 'Tirta Gangga', 'Rendang', 'Selat'],
  Jembrana:   ['Negara', 'Mendoyo', 'Pekutatan', 'Melaya'],
};

// Sample 32 laporan: terdistribusi sesuai kepadatan penduduk (Denpasar/Badung tinggi),
// lat/lng ter-jitter di sekitar pusat kabupaten (~±0.05° ≈ ±5km), seolah-olah beneran
// ada deteksi GPS dari masing-masing kecamatan.
export const SAMPLE_ISSUES = (() => {
  const now = Date.now();
  const days = (n) => new Date(now - n * 86400e3).toISOString();

  const titles = {
    jalan_bolong: [
      'Lubang besar di tengah Jalan Tukad Yeh Aya',
      'Jalan rusak parah dekat SDN 4 Ubud',
      'Aspal mengelupas di jalur cepat Sunset Road',
      'Lubang dalam diameter 40cm di Jalan Bypass Ngurah Rai',
      'Bergelombang parah setelah hujan deras',
      'Retakan memanjang dari Pasar Kembang ke Ubud',
      'Trotoal ambruk di Jalan Teuku Umar',
    ],
    genangan_air: [
      'Genangan 50cm tidak surut 3 hari',
      'Selokan tersumbat, air meluap ke jalan',
      'Drainase rusak, genangan di simpang tiga',
      'Banjir rob di pesisir Sanur',
      'Lubang menggenang dekat SDN 1 Sukawati',
      'Got penuh plastik, air meluap ke jalan',
    ],
    sampah_liar: [
      'Tumpukan sampah di tepi sungai Tukad Badung',
      'Sampah menumpuk di pasar tradisional Kumbasari',
      'Limbah bangunan dibuang ke sawah',
      'Sampah plastik di sepanjang Pantai Kuta',
      'Pembuangan liar di lahan kosong Ubud',
      'TPS ilegal di jalan menuju Nusa Penida',
    ],
    kabel_berantakan: [
      'Kabel menjuntai rendah di atas trotoar Renon',
      'Tiang kabel miring hampir roboh di Kuta',
      'Kabel melilit di pohon, bahaya konsleting',
      'SUTET putus, kabel jatuh ke jalan',
      'Kabel provider baru semrawut tanpa izin',
    ],
  };

  const statusWeights = [
    // Realistis: kebanyakan PENDING (antri), beberapa IN_PROGRESS, beberapa DONE
    'PENDING', 'PENDING', 'PENDING', 'PENDING', // 40% antri
    'IN_PROGRESS', 'IN_PROGRESS',               // 25% dikerjakan
    'DONE', 'DONE',                              // 25% selesai
    'PENDING',                                    // 10% live inference (status PENDING + analisis AI)
  ];
  const sevWeights = ['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'LOW', 'LOW', 'LOW'];

  // Weighted random pick dari list kabupaten
  const weightedKabs = [];
  for (const [kab, info] of Object.entries(KABUPATEN_COORDS)) {
    for (let i = 0; i < info.weight; i++) weightedKabs.push(kab);
  }

  function pickKab() {
    return weightedKabs[Math.floor(Math.random() * weightedKabs.length)];
  }

  function pickStatus() {
    return statusWeights[Math.floor(Math.random() * statusWeights.length)];
  }

  function pickSev() {
    return sevWeights[Math.floor(Math.random() * sevWeights.length)];
  }

  function jitterCoord(coord, range = 0.05) {
    return coord + (Math.random() - 0.5) * range * 2;
  }

  const list = [];
  let id = 1;

  for (const kelas of KELAS) {
    const arr = titles[kelas] || [];
    for (let i = 0; i < 8; i++) {
      const t = arr[i % arr.length] || `Laporan ${kelas}`;
      const kab = pickKab();
      const kabInfo = KABUPATEN_COORDS[kab];
      const kecList = DUMMY_KECAMATAN[kab] || [kab];
      const kec = kecList[Math.floor(Math.random() * kecList.length)];
      const sev = pickSev();
      const scoreBySeverity = { HIGH: 78 + Math.floor(Math.random() * 22), MEDIUM: 45 + Math.floor(Math.random() * 30), LOW: 20 + Math.floor(Math.random() * 25) };
      const score = scoreBySeverity[sev];
      const status = pickStatus();
      const lat = jitterCoord(kabInfo.lat);
      const lng = jitterCoord(kabInfo.lng);

      // Live inference: status PENDING + sudah ada kelas + skor tapi belum diverifikasi admin
      const isLiveInference = status === 'PENDING' && Math.random() > 0.5;

      list.push({
        id: id++,
        title: t,
        description: `Laporan dari warga: ${t}. Sudah berlangsung ${Math.floor(Math.random() * 14) + 1} hari. Mohon tindak lanjut dari dinas terkait.`,
        image_url: `https://picsum.photos/seed/${kelas}${i}/640/480`,
        latitude: lat,
        longitude: lng,
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
        meta_data: { source: 'dummy', is_live_inference: isLiveInference },
        timeline: status === 'DONE' ? [
          { status: 'PENDING', timestamp: days(7), actor: 'Sistem', message: 'Laporan diterima' },
          { status: 'IN_PROGRESS', timestamp: days(5), actor: 'Admin Dinas', message: 'Tim diterjunkan' },
          { status: 'DONE', timestamp: days(1), actor: 'Admin Dinas', message: 'Selesai diperbaiki' },
        ] : status === 'IN_PROGRESS' ? [
          { status: 'PENDING', timestamp: days(3), actor: 'Sistem', message: 'Laporan diterima' },
          { status: 'IN_PROGRESS', timestamp: days(1), actor: 'Admin Dinas', message: 'Tim diterjunkan' },
        ] : isLiveInference ? [
          { status: 'PENDING', timestamp: days(0), actor: 'AI Engine', message: `AI mendeteksi ${kelas.replace('_', ' ')} (confidence ${(score / 100).toFixed(2)}) — menunggu verifikasi admin` },
        ] : [
          { status: 'PENDING', timestamp: days(2), actor: 'Sistem', message: 'Laporan diterima — antri verifikasi' },
        ],
        status,
        created_at: days(Math.floor(Math.random() * 14) + 1),
        updated_at: days(Math.floor(Math.random() * 3)),
      });
    }
  }
  return list;
})();

// Public labels (mirror backend/utils.py:CLASS_LABEL_PUBLIC)
export const CLASS_LABEL_PUBLIC = {
  jalan_bolong: 'jalan bolong',
  genangan_air: 'genangan air',
  sampah_liar: 'sampah liar',
  kabel_berantakan: 'kabel berantakan',
};

// Distribution response (mirror backend/main.py:get_issue_distribution)
export function distributionFromIssues(issues) {
  const total = issues.length || 1;
  const counts = {
    jalan_bolong: issues.filter(i => i.issue_class === 'jalan_bolong').length,
    sampah_liar: issues.filter(i => i.issue_class === 'sampah_liar').length,
    genangan_air: issues.filter(i => i.issue_class === 'genangan_air').length,
    kabel_berantakan: issues.filter(i => i.issue_class === 'kabel_berantakan').length,
  };
  const data = [
    { label: 'Jalan Bolong', percent: Math.round(counts.jalan_bolong / total * 100), color: '#d32f2f', count: counts.jalan_bolong },
    { label: 'Sampah Liar', percent: Math.round(counts.sampah_liar / total * 100), color: '#f57c00', count: counts.sampah_liar },
    { label: 'Genangan Air', percent: Math.round(counts.genangan_air / total * 100), color: '#1976d2', count: counts.genangan_air },
    { label: 'Kabel Berantakan', percent: Math.round(counts.kabel_berantakan / total * 100), color: '#455a64', count: counts.kabel_berantakan },
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

// Live inference: laporan yang masih PENDING tapi AI sudah deteksi (belum diverifikasi admin)
// Untuk widget "Sedang dianalisis" di landing/peta.
export function liveInferenceFromIssues(issues) {
  return issues.filter(i => i.meta_data?.is_live_inference);
}

// Admin token yang valid di dummy. Hardcoded — gak ada validasi.
export const DUMMY_ADMIN_TOKEN = 'dev-dummy-token-2026';

export function isAdminAuthorized(req) {
  const header = req.headers.get('x-admin-token') || '';
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token') || '';
  return header === DUMMY_ADMIN_TOKEN || queryToken === DUMMY_ADMIN_TOKEN;
}