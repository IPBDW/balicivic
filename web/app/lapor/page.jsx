"use client";

import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; }
* { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
a, button, .card, .btn { transition: all 0.3s ease; }
.card-hover:hover, [class*="rounded"]:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08); }
button:hover, .btn:hover, a[class*="bg-"]:hover { transform: translateY(-1px); box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.08); }
button:active, .btn:active { transform: translateY(0px); }
a:not([class*="bg-"]):hover { color: #C94B4B; }
i:hover { transform: scale(1.05); transition: transform 0.2s ease; }
input:focus, textarea:focus, select:focus { box-shadow: 0 0 0 3px rgba(201, 75, 75, 0.1); transition: all 0.2s ease; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.loader { border: 3px solid #f3f3f3; border-top: 3px solid #C94B4B; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const TIPS = [
  { icon: "fas fa-check-circle text-green-500", t: "Fokus pada Objek", d: "Pastikan lubang/sampah ada di tengah frame." },
  { icon: "fas fa-sun text-amber-500", t: "Cahaya Cukup", d: "Hindari foto back-light atau terlalu gelap." },
  { icon: "fas fa-ban text-red-500", t: "Hindari Blur", d: "Pegang HP stabil saat memotret." },
];

export default function LaporPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [gpsStatus, setGpsStatus] = useState({ text: "GPS Inactive", cls: "text-[10px] text-gray-400" });
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [modal, setModal] = useState({ show: false, success: false, countdown: 3 });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    fetchLiveActivity();
    const interval = setInterval(fetchLiveActivity, 10000);
    getLocation();
    return () => clearInterval(interval);
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
      alert("Browser anda tidak mendukung Geolocation.");
      return;
    }
    setGpsStatus({ text: "Mencari satelit...", cls: "text-[10px] text-amber-500 font-bold animate-pulse" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setGpsStatus({ text: "GPS Terkunci", cls: "text-[10px] text-accentGreen font-bold" });
      },
      (error) => {
        let msg = "Gagal ambil lokasi.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Izin GPS ditolak. Mohon aktifkan izin lokasi browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Informasi lokasi tidak tersedia.";
            break;
          case error.TIMEOUT:
            msg = "Waktu habis. Coba lagi di area terbuka.";
            break;
          default:
            msg = "Error GPS: " + error.message;
        }
        alert(msg);
        setGpsStatus({ text: "GPS Error", cls: "text-[10px] text-red-500 font-bold" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function fetchLiveActivity() {
    try {
      const res = await fetch(`${API_BASE}/api/issues?limit=3`);
      if (!res.ok) return;
      const data = await res.json();
      setActivity(data.slice(0, 3));
    } catch (error) {
      console.error("Gagal load aktivitas:", error);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!fileRef.current?.files?.[0]) {
      alert("Harap ambil foto dulu!");
      return;
    }
    if (!lat) {
      if (!confirm("Lokasi belum terkunci (0,0). Lanjutkan?")) return;
    }

    setModal({ show: true, success: false, countdown: 3 });

    const formData = new FormData();
    formData.append("file", fileRef.current.files[0]);
    formData.append("lat", lat || "0");
    formData.append("long", lng || "0");

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Server Error");
      }
      const data = await response.json();

      setModal((m) => ({ ...m, success: true }));
      // Countdown lalu redirect ke halaman detail laporannya sendiri
      let timeLeft = 2;
      const interval = setInterval(() => {
        timeLeft--;
        setModal((m) => ({ ...m, countdown: timeLeft }));
        if (timeLeft <= 0) {
          clearInterval(interval);
          router.push(`/detail/${data.id}`);
        }
      }, 1000);
    } catch (error) {
      console.error("Upload Error:", error);
      alert("Gagal mengirim laporan: " + error.message);
      setModal({ show: false, success: false, countdown: 3 });
    }
  }

  return (
    <div className="pb-24 md:pb-0">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/lapor" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <div className="lg:col-span-7 order-1 animate-slide-up">
            <div className="mb-4 lg:mb-6 group cursor-default">
              <h1 className="text-2xl font-bold text-textDark group-hover:text-primary transition-colors duration-300">
                Lapor Kerusakan
              </h1>
              <p className="text-sm text-textSecondary mt-1 group-hover:text-textDark transition-colors duration-300">
                Bantu pemerintah mendata infrastruktur via AI.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-lightBorder shadow-sm p-5 md:p-8 hover:shadow-2xl hover:-translate-y-1 hover:border-primary/30 transition-all duration-500 ease-out group">
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-textDark flex justify-between items-center">
                    Foto Kondisi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full aspect-[4/3] bg-gray-50 rounded-xl border-2 border-dashed border-lightBorder hover:border-primary hover:bg-red-50/30 transition-all duration-300 overflow-hidden group cursor-pointer">
                    <input
                      ref={fileRef}
                      type="file"
                      name="file"
                      accept="image/*"
                      capture="environment"
                      required
                      onChange={previewFile}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    {!preview && (
                      <div id="uploadPlaceholder" className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 text-primary group-hover:scale-110 transition-transform duration-300">
                          <i className="fas fa-camera text-xl"></i>
                        </div>
                        <span className="text-sm font-medium text-gray-600">Ketuk untuk Foto</span>
                        <span className="text-[10px] text-gray-400 mt-1">atau upload dari galeri</span>
                      </div>
                    )}
                    {preview && <img src={preview} className="absolute inset-0 w-full h-full object-cover z-10" alt="Preview" />}
                    {preview && (
                      <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                        <span className="text-white text-xs font-bold border border-white px-3 py-1 rounded-full backdrop-blur-sm">Ganti Foto</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-bold text-textDark">Lokasi</label>
                    <span className={gpsStatus.cls} id="gpsStatus">{gpsStatus.text}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      name="lat"
                      value={lat}
                      readOnly
                      placeholder="Latitude"
                      required
                      className="bg-gray-50 border border-lightBorder rounded-lg px-3 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                    <input
                      type="number"
                      step="any"
                      name="long"
                      value={lng}
                      readOnly
                      placeholder="Longitude"
                      required
                      className="bg-gray-50 border border-lightBorder rounded-lg px-3 py-3 text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={getLocation}
                    className="relative overflow-hidden w-full py-3 rounded-xl bg-accentGreen/10 text-accentGreen text-xs font-bold hover:bg-accentGreen hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-center gap-2 active:scale-95 group"
                  >
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent z-0"></div>
                    <span className="relative z-10 flex items-center gap-2">
                      <i className="fas fa-crosshairs group-hover:rotate-45 transition-transform duration-500 ease-out"></i>
                      Deteksi Lokasi Saya
                    </span>
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-white rounded-xl py-4 text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primaryHover hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 ease-out flex justify-center items-center gap-2 active:scale-95 group"
                >
                  <span>Analisis Sekarang</span>
                  <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform duration-300 ease-out"></i>
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-5 order-2 space-y-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm text-lg">
                  <i className="fas fa-robot"></i>
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 text-sm group-hover:text-blue-700 transition-colors duration-300">
                    Panduan Akurasi AI
                  </h3>
                  <p className="text-[10px] text-blue-700 group-hover:text-blue-900 transition-colors duration-300">
                    Ikuti tips ini agar laporan valid.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {TIPS.map((tip) => (
                  <div key={tip.t} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-blue-100/50 hover:bg-blue-100/50 transition-colors cursor-default group">
                    <i className={`${tip.icon} mt-0.5 group-hover:scale-110 transition-transform`}></i>
                    <div>
                      <strong className="block text-xs text-gray-800">{tip.t}</strong>
                      <p className="text-[10px] text-gray-500">{tip.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-lightBorder p-5 shadow-sm overflow-hidden relative hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out group">
              <div className="absolute top-0 left-0 w-1 h-full bg-accentGreen"></div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 group-hover:text-accentGreen transition-colors duration-300">
                <span className="w-2 h-2 rounded-full bg-accentGreen animate-pulse"></span>
                Aktivitas Warga
              </h3>
              <div id="liveActivityList" className="space-y-4 opacity-70">
                {activity.length === 0 && <p className="text-xs text-gray-400 animate-pulse">Memuat aktivitas...</p>}
                {activity.map((item, i) => {
                  const date = new Date(item.created_at);
                  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  let colorClass = "text-gray-600";
                  const cat = item.issue_class;
                  if (cat === "JALAN_RUSAK") colorClass = "text-red-500";
                  else if (cat === "SAMPAH") colorClass = "text-amber-500";
                  else if (cat === "GENANGAN") colorClass = "text-accentGreen";
                  else if (cat === "KABEL") colorClass = "text-slate-600";
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs hover:translate-x-1 transition-transform duration-300 cursor-default">
                      <span className="text-gray-400">{timeStr}</span>
                      <span className="font-medium text-textDark">
                        Laporan <span className={`${colorClass} font-bold capitalize`}>{String(cat || "").replace(/_/g, " ").toLowerCase()}</span> di {item.kecamatan || "Lokasi"}.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center text-[10px] text-gray-400 pt-4">
              &copy; 2025 BaliCivic AI Project. <br /> Powered by YOLO11 & Gemini Flash.
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      <div className={`fixed inset-0 z-[100] ${modal.show ? "flex" : "hidden"} items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${modal.show ? "opacity-100" : "opacity-0"}`}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center transform scale-95 transition-transform duration-300">
          {!modal.success ? (
            <div className="flex flex-col items-center">
              <div className="loader mb-4 w-12 h-12 border-4 border-t-primary border-gray-200 rounded-full animate-spin"></div>
              <h3 className="text-lg font-bold text-textDark mb-1">Menganalisis Laporan...</h3>
              <p className="text-xs text-textSecondary">Mohon tunggu sebentar.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4 text-3xl animate-bounce">
                <i className="fas fa-check"></i>
              </div>
              <h3 className="text-xl font-bold text-textDark mb-2">Laporan Berhasil!</h3>
              <p className="text-sm text-textSecondary mb-6">Laporan anda telah tersimpan dan dianalisis oleh AI.</p>
              <div className="bg-gray-50 rounded-lg p-3 w-full mb-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Mengalihkan ke Detail Laporan dalam</p>
                <div className="text-2xl font-bold text-primary" id="countdownTimer">{modal.countdown}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav raised="/lapor" />
    </div>
  );
}