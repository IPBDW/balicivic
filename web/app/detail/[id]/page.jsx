"use client";

import { API_BASE, imgUrl } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import NavbarApp from "@/components/NavbarApp";

const PAGE_CSS = `
body { background-color: #F0F4F8; background-image: radial-gradient(circle at 10% 20%, rgba(201, 75, 75, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(27, 156, 133, 0.05) 0%, transparent 40%); }
.glass-panel { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03); }
.glass-card-hover { transition: all 0.3s ease; }
.glass-card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08); border-color: rgba(255, 255, 255, 0.8); background: rgba(255, 255, 255, 0.85); }
#map { height: 100%; width: 100%; z-index: 1; }
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
.shadow-glass { box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07); }
.shadow-glow { box-shadow: 0 0 20px rgba(201, 75, 75, 0.3); }
@media print { body { background: white !important; } }
`;

export default function DetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.id;
  const mapRef = useRef(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [data, setData] = useState(null);
  const [bar, setBar] = useState({ cls: "h-full w-0 transition-all duration-1000 ease-out rounded-full relative overflow-hidden bg-slate-300", width: "0%" });
  const [scoreUi, setScoreUi] = useState({ val: "0", cls: "text-5xl font-display font-bold text-slate-800" });
  const [sevUi, setSevUi] = useState({ label: "-", cls: "text-sm font-bold text-slate-700" });
  const [statusUi, setStatusUi] = useState({ label: "Loading...", cls: "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-slate-100 text-slate-500 border-slate-200" });

  useEffect(() => {
    if (!issueId) {
      router.replace("/dashboard");
      return;
    }
    let cancelled = false;
    let mapTimer = null;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/issues/${issueId}`);
        if (!res.ok) throw new Error("Gagal ambil data");
        const d = await res.json();
        if (cancelled) return;
        setData(d);

        const score = typeof d.final_score === "number" ? d.final_score : 0;
        let scoreColor, textColor, labelText;
        if (score > 70) {
          scoreColor = "bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_20px_rgba(225,29,72,0.4)]";
          textColor = "text-rose-600";
          labelText = "KRITIS - Perlu Penanganan Segera";
        } else if (score > 40) {
          scoreColor = "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]";
          textColor = "text-amber-600";
          labelText = "SEDANG - Perlu Dijadwalkan";
        } else {
          scoreColor = "bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]";
          textColor = "text-emerald-600";
          labelText = "RINGAN - Monitor Berkala";
        }
        setBar({ cls: "h-full w-0 transition-all duration-1000 ease-out rounded-full relative overflow-hidden " + scoreColor, width: "0%" });
        setScoreUi({ val: String(score), cls: "text-5xl font-display font-bold " + textColor });
        setSevUi({ label: labelText, cls: "text-sm font-bold " + textColor });
        setTimeout(() => setBar({ cls: "h-full transition-all duration-1000 ease-out rounded-full relative overflow-hidden " + scoreColor, width: `${Math.min(Math.max(score, 0), 100)}%` }), 300);

        const badge = d.status || "UNKNOWN";
        if (badge === "OPEN") {
          setStatusUi({ label: badge, cls: "px-4 py-1.5 rounded-full text-[10px] font-bold border shadow-sm bg-rose-50 text-rose-600 border-rose-100 uppercase tracking-wider" });
        } else {
          setStatusUi({ label: badge, cls: "px-4 py-1.5 rounded-full text-[10px] font-bold border shadow-sm bg-emerald-50 text-emerald-600 border-emerald-100 uppercase tracking-wider" });
        }

        if (typeof L !== "undefined" && d.latitude && d.longitude) {
          mapTimer = setTimeout(() => {
            if (cancelled) return;
            const container = document.getElementById("map");
            if (!container) return;
            // Hindari double-init Leaflet (mis. akibat React StrictMode).
            if (mapRef.current) {
              mapRef.current.remove();
              mapRef.current = null;
            }
            if (container._leaflet_id) container._leaflet_id = null;
            const map = L.map(container, { zoomControl: false, attributionControl: false }).setView([d.latitude, d.longitude], 15);
            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
            const customIcon = L.divIcon({
              className: "custom-div-icon",
              html: `<div style="background-color: #C94B4B; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
            L.marker([d.latitude, d.longitude], { icon: customIcon }).addTo(map);
            mapRef.current = map;
            setTimeout(() => {
              if (cancelled) return;
              map.invalidateSize();
              map.setView([d.latitude, d.longitude], 15);
            }, 500);
          }, 100);
        }
      } catch (error) {
        console.error("Error loading detail:", error);
      }
    })();
    return () => {
      cancelled = true;
      if (mapTimer) clearTimeout(mapTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [issueId]);

  async function shareReport() {
    const title = data?.title || "Laporan";
    const text = `Cek laporan kerusakan lingkungan ini: ${title}`;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Laporan BaliCivic AI", text, url }); } catch (err) { console.log("Error sharing:", err); }
    } else {
      try { await navigator.clipboard.writeText(url); alert("Link laporan berhasil disalin ke clipboard!"); } catch (err) { alert("Gagal menyalin link. Silakan copy URL secara manual."); }
    }
  }

  async function downloadImage() {
    const src = data?.image_url ? imgUrl(data.image_url) : "";
    if (!src) { alert("Gambar tidak tersedia untuk diunduh."); return; }
    const link = document.createElement("a");
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      link.download = `BaliCivic_Report_${issueId || "image"}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.warn("Auto-download failed (likely CORS), using fallback:", error);
      link.href = src;
      link.download = `BaliCivic_Report_${issueId || "image"}.jpg`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  const shortId = data?.id != null ? String(data.id).substring(0, 8) : "...";
  const timeText = data?.created_at
    ? new Date(data.created_at).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
      " • " + new Date(data.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA"
    : "-";
  const desc = data?.meta_data?.llm_result?.public?.message ?? "Tidak ada analisis tersedia.";
  const locText = `${data?.kecamatan || "Lokasi Unknown"}, ${data?.kabupaten || "Lokasi Unknown"}`;
  const gmapsHref = data?.latitude && data?.longitude ? `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}` : "#";
  const imgSrc = data?.image_url ? imgUrl(data.image_url) : "";

  return (
    <div className="text-slate-800 antialiased min-h-screen pb-28 md:pb-12">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/laporan" />
      {/*__REST__*/}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 p-4 md:p-8 lg:p-10">
        {!data && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fade-in print:hidden">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-t-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-robot text-primary/40 text-3xl animate-pulse"></i>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-display font-bold text-slate-800">Menganalisis Data</h3>
              <p className="text-slate-500 font-light">Mengambil detail laporan dan hasil analisis AI...</p>
            </div>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 animate-slide-up">
            {/* Left: Visuals */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-panel rounded-3xl p-2 shadow-glass overflow-hidden group relative">
                <div className="relative aspect-video bg-slate-100 rounded-2xl overflow-hidden cursor-zoom-in" onClick={() => setModalOpen(true)}>
                  {imgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                      <i className="fas fa-image text-slate-300 text-3xl"></i>
                    </div>
                  )}
                  {imgSrc ? (
                    <img src={imgSrc} alt="Bukti Laporan" onLoad={() => setImgLoading(false)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                      <i className="fas fa-image text-slate-300 text-3xl"></i>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-lg">
                      <i className="fas fa-eye text-emerald-400"></i> YOLOv11 Vision
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-white font-display font-bold text-lg">Bukti Visual Terverifikasi</p>
                      <p className="text-slate-300 text-sm mt-1">Klik untuk melihat resolusi penuh</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-6 shadow-glass glass-card-hover relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-slate-700 flex items-center gap-2">
                    <i className="fas fa-map-marked-alt text-primary/70"></i> Lokasi Kejadian
                  </h3>
                  <a href={gmapsHref} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
                    Buka Google Maps <i className="fas fa-external-link-alt ml-1"></i>
                  </a>
                </div>
                <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                  <div id="map"></div>
                </div>
                <div className="mt-4 flex items-start gap-3 text-sm text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <i className="fas fa-location-dot text-rose-500 mt-1"></i>
                  <span className="font-medium leading-relaxed">{locText}</span>
                </div>
              </div>
            </div>

            {/* Right: Details */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-panel rounded-3xl p-8 shadow-glass relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/10 to-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <span className={statusUi.cls}>{statusUi.label}</span>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">ID Laporan</span>
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 select-all">#{shortId}</span>
                    </div>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-800 leading-tight mb-4">{data?.title || `Laporan #${shortId}`}</h1>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
                    <i className="far fa-clock text-primary/60"></i>
                    <span className="font-medium">{timeText}</span>
                  </div>
                  <div className="bg-white/60 rounded-2xl p-5 border border-white/60 shadow-sm backdrop-blur-sm">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tingkat Keparahan</span>
                        <p className={sevUi.cls}>{sevUi.label}</p>
                      </div>
                      <div className="text-right">
                        <span className={scoreUi.cls}>{scoreUi.val}</span>
                        <span className="text-sm text-slate-400 font-medium">/100</span>
                      </div>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-100">
                      <div className={bar.cls} style={{ width: bar.width }}>
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-8 shadow-glass glass-card-hover">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-xl shadow-sm border border-orange-100">
                    <i className="fas fa-robot"></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kategori Masalah</span>
                    <p className="text-lg font-display font-bold text-slate-800 capitalize">{String(data?.issue_class || "-").replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2">Analisis AI</h3>
                  <p className="text-sm text-slate-600 leading-relaxed text-justify">{desc}</p>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3 print:hidden">
                  <button onClick={shareReport} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-2">
                    <i className="fas fa-share-alt"></i> Bagikan Laporan
                  </button>
                  <button onClick={downloadImage} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-2">
                    <i className="fas fa-image"></i> Unduh Gambar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Print Footer */}
      <div className="hidden fixed bottom-0 left-0 w-full text-center py-6 border-t border-slate-200 bg-white" id="print-footer">
        <div className="flex items-center justify-center gap-2 mb-2 opacity-50">
          <img src="/assets/BaliCivic_App_Icon_1_.png" className="w-6 h-6 grayscale" alt="" />
          <span className="font-display font-bold text-slate-600">BaliCivic AI</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Dokumen ini digenerate secara otomatis oleh sistem BaliCivic AI.<br />
          Validitas data bergantung pada hasil analisis AI dan verifikasi lapangan.
        </p>
        <p className="text-[10px] font-bold text-primary mt-1">www.balicivicai.site</p>
      </div>

      {/* Image Modal */}
      <div
        className={`fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md ${modalOpen ? "flex" : "hidden"} items-center justify-center p-4 opacity-0 transition-opacity duration-300 print:hidden`}
        onClick={() => setModalOpen(false)}
      >
        <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col items-center">
          {imgSrc && <img src={imgSrc} alt="Tampilan penuh" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10" />}
          <button className="mt-6 bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 backdrop-blur-sm border border-white/10">
            <i className="fas fa-times"></i> Tutup Tampilan Penuh
          </button>
        </div>
      </div>

      <BottomNav raised="/laporan" />
    </div>
  );
}