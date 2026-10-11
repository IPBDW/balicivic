// POST /api/analyze — terima upload gambar, simpan issue, simulasi analisis.
// Mirror: backend/main.py:analyze_endpoint (simplified — no YOLO/LLM di dummy)
import { addIssue, simulateAnalysis } from '@/lib/dummyStore';

export async function POST(req) {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ detail: 'Body harus multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return Response.json({ detail: 'File harus berupa gambar (jpg/png)' }, { status: 400 });
  }
  if (file.type && !file.type.startsWith('image/')) {
    return Response.json({ detail: 'File harus berupa gambar (jpg/png)' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ detail: 'Ukuran file maksimal 10MB' }, { status: 413 });
  }
  // Cek magic bytes juga (content_type bisa kosong/dipalsukan).
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isWebp = String.fromCharCode(head[0], head[1], head[2], head[3]) === 'RIFF'
      && String.fromCharCode(head[8], head[9], head[10], head[11]) === 'WEBP';
    if (!(isJpeg || isPng || isWebp)) {
      return Response.json({ detail: 'File harus berupa gambar (jpg/png)' }, { status: 400 });
    }
  } catch {
    return Response.json({ detail: 'Gagal membaca file' }, { status: 400 });
  }

  const latRaw = formData.get('lat');
  const lonRaw = formData.get('long');
  const lat = latRaw != null && latRaw !== '' ? Number(latRaw) : null;
  const long = lonRaw != null && lonRaw !== '' ? Number(lonRaw) : null;
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    return Response.json({ detail: 'Latitude tidak valid' }, { status: 400 });
  }
  if (long !== null && (!Number.isFinite(long) || long < -180 || long > 180)) {
    return Response.json({ detail: 'Longitude tidak valid' }, { status: 400 });
  }

  // Di dummy kita gak beneran extract bytes. Kita catat aja nama file
  // dan ukuran sebagai placeholder. Untuk real preview, frontend bisa
  // tampilkan blob URL dari file input.
  const newIssue = addIssue({
    title: 'Sedang Menganalisis',
    description: 'Menunggu antrean pemrosesan AI.',
    image_url: null, // akan terisi setelah simulateAnalysis
    latitude: lat,
    longitude: long,
    issue_class: 'processing',
    severity_label: 'LOW',
    final_score: 0,
    status: 'PENDING',
    breakdown_score: {},
    secondary_issues: [],
    meta_data: {
      dummy_file: { name: file.name, size: file.size, type: file.type },
    },
  });

  // Simulasi background task: ~4-8 detik, update ke kelas+skor random.
  // Catatan: di development module, setTimeout cukup karena request handler
  // selesai duluan. Di produksi real, ini harus jadi task queue beneran.
  simulateAnalysis(newIssue.id);

  return Response.json({
    message: 'Laporan diterima & sedang diproses',
    id: newIssue.id,
    status: 'PENDING',
    image_url: newIssue.image_url,
  });
}