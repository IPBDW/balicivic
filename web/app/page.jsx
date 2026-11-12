"use client";

import Link from "next/link";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE } from "@/lib/api";
import { waitForLeaflet } from "@/lib/leaflet";
import { useEffect, useRef, useState } from "react";
import { DUMMY_HEATMAP_POINTS, KABUPATEN_BALI } from "@/lib/dummyDashboard";

const CATEGORIES = [
  {
    id: "jalan_bolong",
    title: "Jalan Rusak & Berlubang",
    code: "jalan_bolong",
    icon: "fa-road",
    color: "text-rose-600 bg-rose-50 border-rose-200",
    badge: "Prioritas Jalan",
    impact: "Rawan kecelakaan pengendara roda dua dan menghambat logistik pariwisata.",
    action: "Dinas PUPR Kabupaten/Kota (Bina Marga)",
    sla: "Target inspeksi 1x24 jam untuk skor kritis (>75).",
  },
  {
    id: "sampah_liar",
    title: "Timbulan Sampah Liar",
    code: "sampah_liar",
    icon: "fa-trash-can",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    badge: "Kebersihan Publik",
    impact: "Mencemari estetika Pulau Dewata, menyumbat saluran drainase, dan sumber bau.",
    action: "Dinas Lingkungan Hidup & Kebersihan (DLHK)",
    sla: "Pengangkutan terjadwal maksimal 2x24 jam.",
  },
  {
    id: "genangan_air",
    title: "Genangan Air & Drainase",
    code: "genangan_air",
    icon: "fa-water",
    color: "text-sky-600 bg-sky-50 border-sky-200",
    badge: "Drainase Jalan",
    impact: "Mempercepat pengikisan lapisan aspal jalan dan memicu aquaplaning kendaraan.",
    action: "Dinas Sumber Daya Air & Bina Marga PUPR",
    sla: "Pembersihan sedimen saluran & pemompaan darurat.",
  },
  {
    id: "kabel_semrawut",
    title: "Kabel Utilitas Bahaya",
    code: "kabel_semrawut",
    icon: "fa-network-wired",
    color: "text-slate-700 bg-slate-100 border-slate-300",
    badge: "Keamanan Utilitas",
    impact: "Menjuntai di badan jalan, membahayakan truk/bus, serta risiko sengatan listrik.",
    action: "Koordinasi PLN, Dishub, dan Asosiasi Penyedia Jasa Internet (APJII)",
    sla: "Penertiban dan pengikatan kabel darurat.",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Warga Mengambil Foto",
    desc: "Warga memotret kerusakan langsung di lokasi jalan via browser HP. Koordinat GPS terkunci otomatis khusus wilayah Provinsi Bali.",
    icon: "fa-camera",
  },
  {
    step: "02",
    title: "Analisis Vision AI & Geometri",
    desc: "Model mendeteksi objek kerusakan, mengestimasi jarak kamera, menghitung lebar fisik kerusakan (meter), dan merumuskan skor keparahan.",
    icon: "fa-brain",
  },
  {
    step: "03",
    title: "Verifikasi & Disposisi PUPR",
    desc: "Laporan masuk ke sistem dinas kabupaten terkait. Laporan kritis (>75) otomatis memicu notifikasi peringatan dan draft Surat Perintah Kerja (SPK).",
    icon: "fa-clipboard-check",
  },
  {
    step: "04",
    title: "Penanganan Tuntas & Audit Trail",
    desc: "Tim teknis PUPR memperbaiki kerusakan di lapangan. Riwayat status dan foto perbaikan tercatat transparan di buku jejak digital.",
    icon: "fa-circle-check",
  },
];

const FAQS = [
  {
    q: "Apakah warga harus membuat akun untuk melapor?",
    a: "Tidak perlu. Sistem dirancang seringkas mungkin agar warga bisa melapor cepat saat di jalan tanpa hambatan pendaftaran akun.",
  },
  {
    q: "Bagaimana privasi foto warga dijaga?",
    a: "Foto yang dikirimkan warga otomatis dibersihkan dari metadata EXIF kamera (informasi perangkat dan sensor). File yang dipublikasikan ke peta hanya file yang telah di-render tanpa metadata sensitif.",
  },
  {
    q: "Dinas mana saja yang terhubung dengan BaliCivic AI?",
    a: "Sistem mengarahkan laporan ke instansi yang berwenang: Dinas PUPR (Bina Marga) untuk jalan berlubang, DLHK untuk sampah liar, Bidang Pengairan untuk genangan, serta koordinasi PLN/Dishub untuk kabel utilitas.",
  },
  {
    q: "Apakah laporan di luar pulau Bali bisa diterima?",
    a: "Tidak. BaliCivic AI menerapkan pembatasan wilayah (geofencing) khusus Provinsi Bali (8 kabupaten dan 1 kota Denpasar) guna menjaga fokus dan ketepatan alokasi tim operasional dinas.",
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [openFaq, setOpenFaq] = useState(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    let mapInstance = null;

    async function initMiniMap() {
      if (!mapContainerRef.current) return;
      try {
        const L = await waitForLeaflet();
        if (!L || !mapContainerRef.current) return;

        // Pusatkan peta di Pulau Bali
        mapInstance = L.map(mapContainerRef.current, {
          center: [-8.5, 115.18],
          zoom: 10,
          scrollWheelZoom: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(mapInstance);

        // Tambahkan pin dari titik contoh Bali
        DUMMY_HEATMAP_POINTS.slice(0, 15).forEach((p) => {
          const lat = p.latitude || p.lat;
          const lon = p.longitude || p.long;
          if (!lat || !lon) return;

          const isHigh = (p.score || p.final_score || 0) >= 75;
          const markerColor = isHigh ? "#ef4444" : "#f59e0b";

          const iconHtml = `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`;
          const customIcon = L.divIcon({
            html: iconHtml,
            className: "bali-marker-dot",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          L.marker([lat, lon], { icon: customIcon })
            .addTo(mapInstance)
            .bindPopup(
              `<div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
                <strong style="color: #0f172a;">${p.kecamatan || "Lokasi"}, ${p.kabupaten || "Bali"}</strong><br/>
                <span style="color: #64748b;">Kategori: ${p.class || "Jalan"}</span><br/>
                <span style="color: ${markerColor}; font-weight: bold;">Skor: ${p.score || 0}/100</span>
              </div>`
            );
        });
      } catch (err) {
        console.error("Gagal inisialisasi mini map:", err);
      }
    }

    initMiniMap();

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, []);

  const selectedCategory = CATEGORIES.find((c) => c.id === activeTab) || CATEGORIES[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-primary/20 selection:text-primary">
      <NavbarApp active="/" sublabel="Portal Informasi Publik" />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/60 pt-12 pb-20 border-b border-slate-200/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left Column: Heading and CTAs */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                  <span>Inisiatif Digital Pemantauan Infrastruktur Provinsi Bali</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.15]">
                  Pelaporan Cerdas Kerusakan Jalan & Fasilitas Publik di Bali Berbasis Vision AI
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                  Ubah foto laporan warga menjadi data geospasial presisi untuk Dinas Pekerjaan Umum (PUPR).
                  Deteksi otomatis jalan berlubang, sampah liar, saluran tersumbat, dan kabel berbahaya secara objektif dan transparan.
                </p>

                {/* Primary CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/lapor"
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/25 hover:bg-primaryHover hover:shadow-lg transition-all active:scale-95"
                  >
                    <i className="fas fa-camera text-base"></i>
                    <span>Laporkan Kerusakan Sekarang</span>
                  </Link>

                  <Link
                    href="/peta"
                    className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white text-slate-800 font-semibold text-sm border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all active:scale-95 shadow-sm"
                  >
                    <i className="fas fa-map-location-dot text-slate-500"></i>
                    <span>Pantau Peta Sebaran</span>
                  </Link>
                </div>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-200">
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-2xl font-black text-slate-900 block">4 Kategori</span>
                    <span className="text-xs text-slate-500 font-medium">Jalan, Sampah, Air, Kabel</span>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-2xl font-black text-slate-900 block">9 Wilayah</span>
                    <span className="text-xs text-slate-500 font-medium">Kabupaten & Kota se-Bali</span>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-2xl font-black text-primary block">WITA</span>
                    <span className="text-xs text-slate-500 font-medium">Zona Waktu Terpusat</span>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-2xl font-black text-slate-900 block">Geofence</span>
                    <span className="text-xs text-slate-500 font-medium">Khusus Provinsi Bali</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual AI Inspection Preview */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                  <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                      <span className="text-xs font-mono font-medium">Inference Engine · Vision AI</span>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                      Bali Pilot: Gianyar
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Visual Detection Box Container */}
                    <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                      <img
                        src="/assets/1240c19a_detected.jpg"
                        alt="Hasil Deteksi Vision AI BaliCivic"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/20">
                        <i className="fas fa-crosshairs text-primary mr-1.5"></i>
                        Objek: Genangan Air (89%)
                      </div>
                    </div>

                    {/* Inspection Specs */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Kategori Terdeteksi</span>
                        <span className="font-bold text-slate-900">Saluran / Genangan Air</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Estimasi Lebar Kerusakan</span>
                        <span className="font-mono font-bold text-slate-900">~1.45 meter</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Tingkat Keparahan</span>
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Skor 78 · Bahaya Tinggi
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-slate-500">
                        <span>Rekomendasi Dinas</span>
                        <span className="font-semibold text-slate-800">Normalisasi Saluran Drainase</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 MASALAH INFRASTRUKTUR BALI */}
        <section className="py-20 bg-white border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Cakupan Pemantauan</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-2">
                4 Kategori Kerusakan Lingkungan yang Diprioritaskan
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                Sistem dirancang khusus untuk membedakan tipe kerusakan fisik infrastruktur jalan dan utilitas umum di Bali.
              </p>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {CATEGORIES.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveTab(cat.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-slate-900 text-white shadow-md"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <i className={`fas ${cat.icon} text-xs`}></i>
                    <span>{cat.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Category Feature Display */}
            <div className="max-w-4xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${selectedCategory.color}`}>
                  <i className={`fas ${selectedCategory.icon} text-2xl`}></i>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{selectedCategory.title}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      kelas: {selectedCategory.code}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">
                    <strong>Dampak Bahaya:</strong> {selectedCategory.impact}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                      <span className="text-slate-500 font-medium block">Instansi Berwenang</span>
                      <strong className="text-slate-900 text-sm mt-0.5 block">{selectedCategory.action}</strong>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                      <span className="text-slate-500 font-medium block">Target Kecepatan Respon</span>
                      <strong className="text-slate-900 text-sm mt-0.5 block">{selectedCategory.sla}</strong>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href={`/lapor`}
                      className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                    >
                      <span>Laporkan masalah seperti ini sekarang</span>
                      <i className="fas fa-arrow-right text-[10px]"></i>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ALUR KERJA TRANSPARAN (WORKFLOW) */}
        <section className="py-20 bg-slate-50 border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Transparansi Penanganan</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-2">
                Dari Foto di Jalan Hingga Penanganan Lapangan
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                Setiap laporan melewati tahapan verifikasi otomatis dan birokrasi dinas yang terukur.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map((wf) => (
                <div
                  key={wf.step}
                  className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-2xs hover:shadow-md transition-shadow relative"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-slate-300 font-mono">{wf.step}</span>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <i className={`fas ${wf.icon}`}></i>
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">{wf.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{wf.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* METODOLOGI AI & SPATIAL MATH */}
        <section id="metodologi" className="py-20 bg-white border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Spesifikasi Teknikal</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-2">
                Metodologi AI & Perhitungan Geometri Spasial
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                Penilaian keparahan tidak ditentukan secara acak, melainkan melalui estimasi dimensi fisik dan kalkulasi sudut kamera.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <h3 className="font-bold text-slate-900 text-base">Computer Vision (YOLO)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Model mendeteksi kotak pembatas (bounding box) objek kerusakan pada resolusi piksel kamera secara cepat di server backend.
                </p>
                <div className="font-mono text-[11px] bg-white p-3 rounded-xl border border-slate-200 text-slate-700">
                  Target: jalan_bolong, sampah_liar, genangan_air, kabel_semrawut
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <h3 className="font-bold text-slate-900 text-base">Geometri Jarak & Dimensi</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Posisi vertikal objek (Y-Center) memproyeksikan jarak relatif (dekat/sedang/jauh). Rasio piksel terhadap Field of View (FOV) mengestimasi lebar kerusakan aspal dalam satuan meter nyata.
                </p>
                <div className="font-mono text-[11px] bg-white p-3 rounded-xl border border-slate-200 text-slate-700">
                  Formula: width_m = 2 * dist * tan(FOV/2) * (box_w / img_w)
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <h3 className="font-bold text-slate-900 text-base">Sintesis Laporan Teknis</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sistem menghasilkan dua keluaran serentak: ringkasan ramah publik untuk warga, dan catatan risiko teknis serta rekomendasi aksi untuk staf Dinas PUPR.
                </p>
                <div className="font-mono text-[11px] bg-white p-3 rounded-xl border border-slate-200 text-slate-700">
                  Output: Public Summary + Dinas Action Recommendation
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MINI MAP PREVIEW */}
        <section className="py-20 bg-slate-50 border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Distribusi Wilayah</span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">
                  Peta Sebaran Laporan di Pulau Bali
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-2">
                  Pemantauan spasial terintegrasi di 8 Kabupaten dan 1 Kota di Bali.
                </p>
              </div>

              <Link
                href="/peta"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shrink-0"
              >
                <span>Buka Peta Interaktif Lengkap</span>
                <i className="fas fa-up-right-from-square text-[10px]"></i>
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div ref={mapContainerRef} className="h-80 sm:h-96 w-full z-10" />
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Prioritas Tinggi (Skor &gt;= 75)
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Prioritas Sedang (Skor 45-74)
                  </span>
                </div>
                <span>Koordinat terikat resmi wilayah Provinsi Bali</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-20 bg-white border-b border-slate-200">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Tanya Jawab</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">
                Pertanyaan yang Sering Diajukan
              </h2>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm hover:text-primary transition-colors"
                    >
                      <span>{faq.q}</span>
                      <i className={`fas fa-chevron-down text-xs transition-transform ${isOpen ? "rotate-180 text-primary" : "text-slate-400"}`}></i>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3 bg-white">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* BOTTOM CIVIC CTA */}
        <section className="py-16 bg-slate-900 text-white text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
            <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold">
              Partisipasi Masyarakat Bali
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
              Temukan Kerusakan Jalan Hari Ini? Ambil Foto & Laporkan.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Setiap foto yang Anda kirimkan langsung dianalisis AI dan dipetakan secara akurat untuk percepatan perbaikan oleh instansi terkait.
            </p>
            <div className="pt-2">
              <Link
                href="/lapor"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/40 hover:bg-primaryHover transition-all active:scale-95"
              >
                <i className="fas fa-camera text-base"></i>
                <span>Mulai Buat Laporan</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* CIVIC FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 pb-24 md:pb-12 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/BaliCivic_App_Icon_1_.png"
                  alt="BaliCivic AI Logo"
                  className="h-7 w-7 rounded-lg object-cover"
                  width="28"
                  height="28"
                />
                <span className="font-bold text-slate-900 text-sm">BaliCivic AI</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Sistem pelaporan kerusakan infrastruktur publik berbasis Artificial Intelligence untuk Provinsi Bali.
              </p>
            </div>

            <div>
              <strong className="text-slate-900 font-bold block mb-3">Layanan Publik</strong>
              <ul className="space-y-2">
                <li><Link href="/lapor" className="hover:text-primary transition-colors">Lapor Kerusakan</Link></li>
                <li><Link href="/peta" className="hover:text-primary transition-colors">Peta Sebaran</Link></li>
                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard Statistik</Link></li>
                <li><Link href="/laporan" className="hover:text-primary transition-colors">Daftar Laporan</Link></li>
              </ul>
            </div>

            <div>
              <strong className="text-slate-900 font-bold block mb-3">Kabupaten & Kota</strong>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                {KABUPATEN_BALI.map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </div>
            </div>

            <div>
              <strong className="text-slate-900 font-bold block mb-3">Bantuan & Dokumen</strong>
              <ul className="space-y-2">
                <li><Link href="/bantuan" className="hover:text-primary transition-colors">Panduan Penggunaan</Link></li>
                <li><a href="#metodologi" className="hover:text-primary transition-colors">Metodologi Riset</a></li>
                <li className="pt-2 text-[11px] text-slate-400">
                  Lisensi Terbuka AGPL-3.0 · Khusus Pemerintah & Publik Bali
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 text-center sm:flex sm:justify-between sm:items-center">
            <p>&copy; 2026 BaliCivic AI. Seluruh Hak Dilindungi.</p>
            <p className="mt-2 sm:mt-0 font-medium text-slate-600">
              Inisiatif Pelayanan Publik Provinsi Bali
            </p>
          </div>
        </div>
      </footer>

      <BottomNav raised="/" />
    </div>
  );
}
