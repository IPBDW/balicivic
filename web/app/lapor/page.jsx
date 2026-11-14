"use client";

import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE } from "@/lib/api";
import { formatTimeWita } from "@/lib/datetime";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; }
* { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
a, button, .card, .btn { transition: all 0.3s ease; }
.card-hover:hover, [class*="rounded"]:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08); }
button:hover, .btn:hover, a[class*="bg-"]:hover { transform: translateY(-1px); box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.08); }
button:active, .btn:active { transform: translateY(0px); }
a:not([class*="bg-"]):hover { color: #B91C1C; }
i:hover { transform: scale(1.05); transition: transform 0.2s ease; }
input:focus, textarea:focus, select:focus { box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1); transition: all 0.2s ease; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.loader { border: 3px solid #f3f3f3; border-top: 3px solid #B91C1C; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const TIPS = [
  { icon: "fas fa-check-circle text-green-500", t: "Fokus pada Objek", d: "Pastikan lubang/sampah ada di tengah frame." },
  { icon: "fas fa-sun text-amber-500", t: "Cahaya Cukup", d: "Hindari foto back-light atau terlalu gelap." },
  { icon: "fas fa-ban text-red-500", t: "Hindari Blur", d: "Pegang HP stabil saat memotret." },
];

function formatIssueCategory(cat) {
  if (!cat) return "-";
  if (cat === "jalan_bolong") return "Jalan Bolong";
  if (cat === "sampah_liar") return "Sampah Liar";
  if (cat === "genangan_air") return "Genangan Air";
  if (cat === "kabel_semrawut") return "Kabel Semrawut";
  if (cat === "aman") return "Kondisi Aman";
  return String(cat).replace(/_/g, " ");
}

export default function LaporPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const isMountedRef = useRef(true);
  const timerRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [gpsStatus, setGpsStatus] = useState({ text: "GPS Inactive", cls: "text-[10px] text-gray-400" });
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [modal, setModal] = useState({
    show: false,
    stage: "idle",
    message: "",
    submessage: "",
    countdown: 2,
    issueId: null,
    issueData: null,
  });
  const [activity, setActivity] = useState([]);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    async function fetchLiveActivity() {
      try {
        const res = await fetch(`${API_BASE}/api/issues?limit=3`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMountedRef.current) setActivity(data.slice(0, 3));
      } catch (error) {
        // Gunakan warn agar error polling di background tidak memunculkan overlay modal merah di Next.js dev
        console.warn("Gagal load aktivitas:", error?.message || error);
      }
    }

    fetchLiveActivity();
    const interval = setInterval(fetchLiveActivity, 10000);
    // Sengaja TIDAK memanggil getLocation() otomatis: permintaan izin lokasi
    // yang muncul sendiri saat halaman dibuka itu mengganggu, dan di beberapa
    // browser memblokir UI. Pengguna menekan tombol kalau memang mau.
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(interval);
    };
  }, []);

  function previewFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setGpsStatus({ text: "Browser tidak mendukung GPS", cls: "text-[10px] text-red-500 font-bold" });
      setFormError("Browser ini tidak mendukung Geolocation. Isi koordinat manual di bawah.");
      return;
    }
    setFormError(null);
    setGpsStatus({ text: "Mencari satelit...", cls: "text-[10px] text-amber-500 font-bold animate-pulse" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pLat = position.coords.latitude;
        const pLng = position.coords.longitude;
        setLat(pLat.toFixed(6));
        setLng(pLng.toFixed(6));
        if (pLat < -9.0 || pLat > -8.0 || pLng < 114.4 || pLng > 115.8) {
          setGpsStatus({ text: "GPS Terkunci (Di Luar Bali)", cls: "text-[10px] text-amber-500 font-bold" });
          setFormError(
            "GPS terdeteksi di luar Provinsi Bali. Masukkan koordinat di dalam wilayah Bali (misal: Denpasar -8.67, 115.21)."
          );
        } else {
          setGpsStatus({ text: "GPS Terkunci (Bali)", cls: "text-[10px] text-accentGreen font-bold" });
        }
      },
      (error) => {
        let msg = "Gagal ambil lokasi.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Izin lokasi ditolak. Aktifkan izin lokasi browser, atau isi koordinat manual di bawah.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Informasi lokasi tidak tersedia. Isi koordinat manual di bawah.";
            break;
          case error.TIMEOUT:
            msg = "Waktu habis mengambil lokasi. Coba lagi atau isi koordinat manual.";
            break;
          default:
            msg = "Error GPS: " + error.message;
        }
        setFormError(msg);
        setGpsStatus({ text: "GPS tidak aktif", cls: "text-[10px] text-red-500 font-bold" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function goToDetailNow() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (modal.issueId) {
      router.push(`/detail/${modal.issueId}`);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!fileRef.current?.files?.[0]) {
      setFormError("Harap ambil atau pilih foto dulu.");
      return;
    }

    const trimmedLat = String(lat || "").trim();
    const trimmedLng = String(lng || "").trim();
    if (!trimmedLat || !trimmedLng) {
      setFormError(
        "Lokasi kerusakan wajib diisi agar Dinas PUPR dapat menindaklanjuti. Klik \"Deteksi Lokasi Saya\" atau masukkan koordinat manual."
      );
      return;
    }

    const numLat = parseFloat(trimmedLat);
    const numLng = parseFloat(trimmedLng);
    if (isNaN(numLat) || isNaN(numLng)) {
      setFormError("Format koordinat latitude dan longitude tidak valid.");
      return;
    }

    const isOutsideBali = numLat < -9.0 || numLat > -8.0 || numLng < 114.4 || numLng > 115.8;
    if (isOutsideBali) {
      setFormError(
        "Koordinat berada di luar wilayah Provinsi Bali. Masukkan koordinat di dalam wilayah Bali (misal: Denpasar -8.67, 115.21)."
      );
      return;
    }

    setModal({
      show: true,
      stage: "uploading",
      message: "Mengunggah Laporan...",
      submessage: "Mengirim berkas foto dan data koordinat...",
      countdown: 2,
      issueId: null,
      issueData: null,
    });

    const formData = new FormData();
    formData.append("file", fileRef.current.files[0]);
    formData.append("lat", trimmedLat);
    formData.append("long", trimmedLng);

    let issueId = null;
    try {
      const response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: formData });
      if (!response.ok) {
        if (response.status === 429) {
          const retry = response.headers.get("Retry-After");
          throw new Error(
            `Terlalu banyak laporan dari jaringan ini. Coba lagi${retry ? ` dalam ${retry} detik` : " sebentar"}.`
          );
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Server Error");
      }
      const data = await response.json();
      issueId = data.id;

      if (!isMountedRef.current) return;

      setModal((m) => ({
        ...m,
        stage: "analyzing",
        issueId,
        message: "Menganalisis Kerusakan dengan AI...",
        submessage: "Model YOLO sedang mendeteksi kerusakan pada foto...",
      }));

      // Polling backend hingga status AI selesai (issue_class bukan 'processing' lagi)
      let pollCount = 0;
      const maxPolls = 25; // ~25 detik batas tunggu
      let finalIssue = null;

      while (pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!isMountedRef.current) return;
        pollCount++;

        try {
          const checkRes = await fetch(`${API_BASE}/api/issues/${issueId}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.issue_class && checkData.issue_class !== "processing") {
              finalIssue = checkData;
              break;
            }
            if (checkData.status === "ERROR") {
              finalIssue = checkData;
              break;
            }
          }
        } catch (err) {
          console.warn("Polling warning:", err);
        }

        if (pollCount === 4) {
          setModal((m) => ({
            ...m,
            submessage: "Menghitung tingkat keparahan & menyusun deskripsi...",
          }));
        } else if (pollCount === 8) {
          setModal((m) => ({
            ...m,
            submessage: "Memfinalisasi laporan teknis...",
          }));
        }
      }

      if (!isMountedRef.current) return;

      const isCompleted = finalIssue && finalIssue.issue_class !== "processing";
      if (isCompleted) {
        setModal({
          show: true,
          stage: "success",
          message: "Analisis Selesai!",
          submessage: "Laporan berhasil dianalisis oleh AI.",
          countdown: 2,
          issueId,
          issueData: finalIssue,
        });
      } else {
        // Fallback jika timeout / error: biarkan halaman detail melanjutkan polling live
        setModal({
          show: true,
          stage: "fallback",
          message: "Laporan Tersimpan!",
          submessage: "AI masih menganalisis di latar belakang. Mengalihkan ke detail laporan...",
          countdown: 1,
          issueId,
          issueData: null,
        });
      }

      let timeLeft = isCompleted ? 2 : 1;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        timeLeft--;
        setModal((m) => ({ ...m, countdown: Math.max(0, timeLeft) }));
        if (timeLeft <= 0) {
          clearInterval(timerRef.current);
          router.push(`/detail/${issueId}`);
        }
      }, 1000);
    } catch (error) {
      console.error("Upload Error:", error);
      setFormError("Gagal mengirim laporan: " + error.message);
      setModal({ show: false, stage: "idle", message: "", submessage: "", countdown: 2, issueId: null, issueData: null });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-28 md:pb-12">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/lapor" sublabel="Formulir Laporan Kerusakan" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <div className="lg:col-span-7 order-1 animate-slide-up">
            <div className="mb-4 lg:mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold mb-2">
                <i className="fas fa-camera text-xs"></i>
                <span>Pelaporan Jalan & Fasilitas Publik</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                Lapor Kerusakan
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Ambil foto kerusakan jalan, genangan, atau sampah liar di Bali. AI akan menganalisis tingkat keparahannya secara otomatis.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-7 md:p-8 hover:border-slate-300 transition-all duration-300">
              <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
                {/* 1. Upload Foto */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">1</span>
                      Foto Kondisi Kerusakan <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-500">Kamera / Galeri</span>
                  </div>

                  <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 hover:border-primary hover:bg-red-50/20 transition-all duration-300 overflow-hidden group cursor-pointer shadow-inner">
                    <input
                      ref={fileRef}
                      type="file"
                      name="file"
                      accept="image/*"
                      capture="environment"
                      required
                      onChange={previewFile}
                      aria-label="Upload foto kerusakan"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    {!preview && (
                      <div id="uploadPlaceholder" className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 select-none">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-md border border-slate-200 flex items-center justify-center mb-3 text-primary group-hover:scale-105 transition-transform duration-300">
                          <i className="fas fa-camera text-2xl sm:text-3xl"></i>
                        </div>
                        <span className="text-sm sm:text-base font-bold text-slate-800">
                          Ketuk untuk Memotret Kerusakan
                        </span>
                        <span className="text-xs text-slate-500 mt-1 max-w-xs">
                          Buka kamera smartphone atau pilih foto dari galeri
                        </span>
                        <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                          <i className="fas fa-sparkles text-[10px]"></i> Vision AI Siap Analisis
                        </span>
                      </div>
                    )}
                    {preview && (
                      <img
                        src={preview}
                        className="absolute inset-0 w-full h-full object-cover z-10"
                        alt="Preview Foto Kerusakan"
                      />
                    )}
                    {preview && (
                      <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center pointer-events-none">
                        <span className="bg-slate-900/85 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full backdrop-blur-md shadow-lg border border-white/20 flex items-center gap-2">
                          <i className="fas fa-camera-rotate"></i> Ketuk untuk Ganti Foto
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Lokasi Kerusakan */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <label htmlFor="input-lat" className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">2</span>
                      Lokasi Kerusakan <span className="text-red-500">*</span>
                    </label>
                    <span className={gpsStatus.cls} id="gpsStatus" role="status" aria-live="polite">
                      {gpsStatus.text}
                    </span>
                  </div>

                  {/* Tombol Deteksi GPS Mobile-first */}
                  <button
                    type="button"
                    onClick={getLocation}
                    className="relative overflow-hidden w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 group"
                  >
                    <i className="fas fa-crosshairs text-base group-hover:rotate-45 transition-transform duration-300"></i>
                    <span>Deteksi Lokasi GPS Otomatis</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Latitude</span>
                      <input
                        id="input-lat"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        name="lat"
                        required
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        placeholder="Contoh: -8.6705"
                        aria-label="Latitude"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Longitude</span>
                      <input
                        id="input-long"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        name="long"
                        required
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        placeholder="Contoh: 115.2120"
                        aria-label="Longitude"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sistem membatasi laporan khusus di dalam wilayah 8 Kabupaten & 1 Kota di Provinsi Bali.
                  </p>
                </div>

                {formError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 leading-relaxed flex items-start gap-2.5">
                    <i className="fas fa-circle-exclamation text-red-500 text-sm mt-0.5 shrink-0"></i>
                    <span>{formError}</span>
                  </div>
                )}

                {/* 3. Tombol Kirim */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[50px] bg-primary text-white rounded-xl py-3.5 sm:py-4 px-6 text-sm sm:text-base font-bold shadow-lg shadow-primary/25 hover:bg-primaryHover hover:shadow-xl transition-all duration-200 flex justify-center items-center gap-2.5 active:scale-95 group"
                  >
                    <i className="fas fa-brain text-white/80 group-hover:scale-110 transition-transform"></i>
                    <span>Kirim & Analisis AI Sekarang</span>
                    <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
                  </button>
                  <p className="text-center text-[11px] text-slate-400 mt-2">
                    Data foto langsung dianalisis di server tanpa menyimpan metadata pribadi EXIF.
                  </p>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-5 order-2 space-y-5 animate-slide-up">
            {/* Panduan Akurasi AI */}
            <div className="bg-sky-50/80 rounded-2xl p-5 border border-sky-100 shadow-2xs">
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs text-sm">
                  <i className="fas fa-lightbulb"></i>
                </div>
                <div>
                  <h3 className="font-bold text-sky-950 text-sm">
                    Tips Foto Akurat
                  </h3>
                  <p className="text-[11px] text-sky-800">
                    Membantu model mendeteksi ukuran & kedalaman
                  </p>
                </div>
              </div>
              <div className="space-y-2.5">
                {TIPS.map((tip) => (
                  <div key={tip.t} className="flex items-start gap-3 bg-white/90 p-3 rounded-xl border border-sky-100/80">
                    <i className={`${tip.icon} mt-0.5 text-xs`}></i>
                    <div>
                      <strong className="block text-xs text-slate-800">{tip.t}</strong>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{tip.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aktivitas Warga Terkini */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Laporan Warga Terkini
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Live WITA</span>
              </div>
              <div id="liveActivityList" className="space-y-3">
                {activity.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">Memuat aktivitas terbaru...</p>
                )}
                {activity.map((item, i) => {
                  const timeStr = formatTimeWita(item.created_at);
                  let badgeCls = "bg-slate-100 text-slate-700 border-slate-200";
                  const cat = item.issue_class;
                  if (cat === "jalan_bolong") badgeCls = "bg-rose-50 text-rose-700 border-rose-200";
                  else if (cat === "sampah_liar") badgeCls = "bg-amber-50 text-amber-800 border-amber-200";
                  else if (cat === "genangan_air") badgeCls = "bg-sky-50 text-sky-700 border-sky-200";
                  else if (cat === "kabel_semrawut") badgeCls = "bg-slate-100 text-slate-700 border-slate-300";

                  return (
                    <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                      <div className="min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border capitalize mr-2 ${badgeCls}`}>
                          {String(cat || "Laporan").replace(/_/g, " ")}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {item.kecamatan || item.kabupaten || "Bali"}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{timeStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 pt-1">
              BaliCivic AI · Pemantauan Infrastruktur Publik Provinsi Bali
            </div>
          </div>
        </div>
      </main>

      {/* Modal Status Analisis AI */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`fixed inset-0 z-[100] ${modal.show ? "flex" : "hidden"} items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${modal.show ? "opacity-100" : "opacity-0"}`}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full mx-auto text-center transform transition-all duration-300 border border-slate-100 max-h-[90vh] overflow-y-auto">
          {modal.stage === "uploading" || modal.stage === "analyzing" ? (
            <div className="flex flex-col items-center">
              <div className="relative mb-5 w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <i className={`fas ${modal.stage === "uploading" ? "fa-cloud-arrow-up" : "fa-robot"} text-primary text-xl animate-pulse`}></i>
              </div>
              <h3 id="modal-title" className="text-lg font-bold text-textDark mb-1.5">
                {modal.message}
              </h3>
              <p className="text-xs text-textSecondary leading-relaxed min-h-[32px] px-2">
                {modal.submessage}
              </p>

              {/* Step indicator */}
              <div className="w-full mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${modal.stage === "uploading" ? "bg-primary animate-ping" : "bg-emerald-500"}`}></span>
                  <span className={modal.stage === "uploading" ? "font-bold text-textDark" : "text-slate-400"}>Kirim Foto</span>
                </div>
                <i className="fas fa-chevron-right text-[9px] text-slate-300"></i>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${modal.stage === "analyzing" ? "bg-primary animate-ping" : "bg-slate-300"}`}></span>
                  <span className={modal.stage === "analyzing" ? "font-bold text-textDark" : "text-slate-400"}>Deteksi AI</span>
                </div>
                <i className="fas fa-chevron-right text-[9px] text-slate-300"></i>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                  <span className="text-slate-400">Selesai</span>
                </div>
              </div>
            </div>
          ) : modal.stage === "success" ? (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 text-2xl shadow-sm">
                <i className="fas fa-check"></i>
              </div>
              <h3 id="modal-title" className="text-xl font-bold text-textDark mb-1">
                {modal.message}
              </h3>
              <p className="text-xs text-textSecondary mb-4">
                {modal.submessage}
              </p>

              {modal.issueData && (
                <div className="bg-slate-50 rounded-xl p-3 w-full mb-4 border border-slate-100 text-left">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Kategori:</span>
                    <span className="font-bold text-textDark capitalize">
                      {formatIssueCategory(modal.issueData.issue_class)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tingkat Keparahan:</span>
                    <span className="font-bold text-primary">
                      {modal.issueData.issue_class === "aman"
                        ? "Aman (0/100)"
                        : `${modal.issueData.final_score ?? 0}/100 • ${modal.issueData.severity_label || "SEDANG"}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-3 w-full mb-3 border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Mengalihkan ke Detail Laporan dalam</p>
                <div className="text-2xl font-bold text-primary" id="countdownTimer">{modal.countdown}</div>
              </div>

              <button
                type="button"
                onClick={goToDetailNow}
                className="w-full py-2.5 px-4 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primaryHover transition-colors shadow-sm"
              >
                Buka Detail Sekarang
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-3 text-2xl">
                <i className="fas fa-info"></i>
              </div>
              <h3 id="modal-title" className="text-lg font-bold text-textDark mb-1">
                {modal.message || "Laporan Tersimpan"}
              </h3>
              <p className="text-xs text-textSecondary mb-4 leading-relaxed">
                {modal.submessage || "Mengalihkan ke halaman detail laporan..."}
              </p>
              <div className="bg-slate-50 rounded-lg p-3 w-full mb-3 border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Mengalihkan dalam</p>
                <div className="text-2xl font-bold text-primary" id="countdownTimer">{modal.countdown}</div>
              </div>
              <button
                type="button"
                onClick={goToDetailNow}
                className="w-full py-2.5 px-4 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primaryHover transition-colors shadow-sm"
              >
                Buka Detail Sekarang
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav raised="/lapor" />
    </div>
  );
}