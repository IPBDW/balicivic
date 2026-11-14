"use client";

import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE } from "@/lib/api";
import { waitForLeaflet } from "@/lib/leaflet";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.5); border-radius: 20px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.8); }
.checkbox-wrapper input:checked + .checkbox-box { background-color: currentColor; border-color: currentColor; }
.checkbox-wrapper input:checked + .checkbox-box i { opacity: 1; transform: scale(1); }
.leaflet-control-zoom { border: none !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important; }
.leaflet-control-zoom a { background-color: rgba(255, 255, 255, 0.9) !important; backdrop-filter: blur(4px); color: #1e293b !important; border-radius: 8px !important; margin-bottom: 4px !important; }
`;

const CLASS_FILTERS = [
  { id: "jalan_bolong", label: "Jalan Bolong", dot: "bg-red-500", box: "text-red-500 group-hover:border-red-400" },
  { id: "genangan_air", label: "Genangan Air", dot: "bg-sky-500", box: "text-sky-500 group-hover:border-sky-400" },
  { id: "sampah_liar", label: "Sampah Liar", dot: "bg-orange-500", box: "text-orange-500 group-hover:border-orange-400" },
  { id: "kabel_semrawut", label: "Kabel Berantakan", dot: "bg-gray-800", box: "text-gray-800 group-hover:border-gray-600" },
];

// Samakan dengan status kanonik backend (models/main.py):
// PENDING -> IN_PROGRESS -> DONE, plus ERROR. Jangan pakai "OPEN"
// (tidak pernah ada di DB, filter-nya pasti kosong).
const STATUS_FILTERS = [
  { v: "", label: "SEMUA" },
  { v: "PENDING", label: "MENUNGGU" },
  { v: "IN_PROGRESS", label: "PROSES" },
  { v: "DONE", label: "SELESAI" },
];

const DETAIL_ZOOM_THRESHOLD = 12;

export default function PetaPage() {
  const [selected, setSelected] = useState(CLASS_FILTERS.map((c) => c.id));
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);
  const heatRef = useRef(null);
  const markerLayerRef = useRef(null);
  const totalRef = useRef(null);
  const loadHeatmapRef = useRef(null);

  const toggleClass = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        mapRef.current.flyTo([latitude, longitude], 14, { animate: true, duration: 1 });
        if (typeof window !== "undefined" && window.L) {
          const userIcon = window.L.divIcon({
            html: '<div style="background-color: #0284c7; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(2, 132, 199, 0.8);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          window.L.marker([latitude, longitude], { icon: userIcon }).addTo(mapRef.current);
        }
      },
      (err) => {
        setLocating(false);
        console.warn("Gagal deteksi lokasi pada peta:", err);
      },
      { timeout: 8000 }
    );
  };

  const updateLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    // Marker SELALU visible di semua zoom (sesuai permintaan user).
    if (markerLayerRef.current && !map.hasLayer(markerLayerRef.current)) {
      markerLayerRef.current.addTo(map);
    }
    // Heatmap blob hanya di zoom rendah (supaya tidak menutupi marker di zoom tinggi).
    if (z < DETAIL_ZOOM_THRESHOLD) {
      if (heatRef.current && !map.hasLayer(heatRef.current)) heatRef.current.addTo(map);
    } else {
      if (heatRef.current && map.hasLayer(heatRef.current)) map.removeLayer(heatRef.current);
    }
  }, []);

  const loadHeatmap = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      let rawPoints;
      const res = await fetch(`${API_BASE}/api/heatmap`);
      if (!res.ok) throw new Error("Gagal ambil data heatmap");
      const data = await res.json();
      rawPoints = data.points || [];
      const points = rawPoints.filter((p) => {
        const pClass = p.issue_class || p.class;
        const pStatus = p.status;
        const classMatch = selected.length === 0 || selected.includes(pClass);
        const statusMatch = status === "" || pStatus === status;
        return classMatch && statusMatch;
      });

      if (totalRef.current && totalRef.current.innerText !== String(points.length)) {
        const el = totalRef.current;
        const start = parseInt(el.innerText) || 0;
        const end = points.length;
        const dur = 1000;
        const t0 = performance.now();
        const step = (ts) => {
          const p = Math.min((ts - t0) / dur, 1);
          el.innerText = Math.floor(p * (end - start) + start);
          if (p < 1) requestAnimationFrame(step);
          else el.innerText = end;
        };
        requestAnimationFrame(step);
      }

      const heatData = points
        .filter((p) => (p.latitude || p.lat) && (p.longitude || p.long || p.lon))
        .map((p) => {
          const score = p.final_score || p.severity_score || p.score || 0;
          return [p.latitude || p.lat, p.longitude || p.long || p.lon, Math.max(score / 100, 0.2)];
        });

      if (heatRef.current) map.removeLayer(heatRef.current);
      if (heatData.length > 0) {
        heatRef.current = L.heatLayer(heatData, {
          radius: 25,
          blur: 20,
          maxZoom: 16,
          gradient: { 0.2: "blue", 0.4: "cyan", 0.6: "lime", 0.8: "yellow", 1.0: "red" },
        });
        if (map.getZoom() < DETAIL_ZOOM_THRESHOLD) heatRef.current.addTo(map);
      } else {
        heatRef.current = null;
      }

      markerLayerRef.current?.clearLayers();
      points.forEach((p) => {
        const pClass = p.issue_class || p.class || "unknown";
        const pId = p.id;
        const pScore = p.final_score || p.severity_score || p.score || "-";
        // Status kanonik backend: PENDING/IN_PROGRESS/DONE/ERROR.
        // Fallback "PENDING" (bukan "OPEN" yang tidak pernah ada).
        const pStatus = p.status || "PENDING";
        const pLat = p.latitude || p.lat;
        const pLon = p.longitude || p.long || p.lon;
        if (!pLat || !pLon) return;

        const colorClass =
          pClass === "jalan_bolong"
            ? "text-red-500"
            : pClass === "genangan_air"
              ? "text-sky-500"
              : pClass === "sampah_liar"
                ? "text-orange-500"
                : "text-gray-700";

        // Icon sederhana: fa-map-pin solid warna sesuai class, ukuran kecil.
        // Tidak ada label bawaan di marker (supaya tidak crowded di zoom rendah).
        const iconHtml = `<i class="fas fa-map-pin text-2xl ${colorClass} drop-shadow-md"></i>`;

        const customIcon = L.divIcon({ html: iconHtml, className: "", iconSize: [20, 28], iconAnchor: [10, 28], popupAnchor: [0, -28] });
        const marker = L.marker([pLat, pLon], { icon: customIcon });
        const statusColor =
          pStatus === "PENDING"
            ? "bg-yellow-100 text-yellow-600"
            : pStatus === "IN_PROGRESS"
              ? "bg-sky-100 text-sky-600"
              : pStatus === "ERROR"
                ? "bg-slate-200 text-slate-600"
                : "bg-green-100 text-green-600";
        const popupHtml = `
          <div class="font-sans p-1 min-w-[150px]">
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">${String(pClass).replace("_", " ")}</div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-bold text-gray-800">Skor: ${pScore}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${statusColor} font-bold">${pStatus}</span>
            </div>
            <div class="text-[10px] text-gray-400">ID: #${pId}</div>
            <div class="mt-2 text-[10px] text-primary font-bold cursor-pointer hover:underline" onclick="window.location.href='/detail/${pId}'">Lihat Detail &rarr;</div>
          </div>`;
        marker.bindPopup(popupHtml);
        markerLayerRef.current.addLayer(marker);
      });

      updateLayerVisibility();
    } catch (err) {
      console.error("Gagal load heatmap:", err);
    }
  }, [selected, status, updateLayerVisibility]);

  // Simpan versi terbaru agar peta (yang di-init sekali) selalu memanggil data terbaru.
  useEffect(() => {
    loadHeatmapRef.current = loadHeatmap;
  }, [loadHeatmap]);

  useEffect(() => {
    let cancelled = false;
    let map = null;
    let initTimer = null;

    (async () => {
      try {
        const L = await waitForLeaflet();
        if (cancelled) return;

        const container = document.getElementById("heatmap-map");
        if (!container) return;
        if (container._leaflet_id) container._leaflet_id = null;

        map = L.map(container, { zoomControl: false, attributionControl: false }).setView([-8.4095, 115.1889], 10);
        L.control.zoom({ position: "bottomleft" }).addTo(map);
        const zoomControlContainer = document.querySelector(".leaflet-bottom.leaflet-left");
        if (zoomControlContainer) {
          zoomControlContainer.style.marginBottom = "80px";
          zoomControlContainer.classList.add("md:mb-0");
        }
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          subdomains: "abcd",
        }).addTo(map);
        mapRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        map.on("zoomend", updateLayerVisibility);
        initTimer = setTimeout(() => {
          if (cancelled) return;
          map.invalidateSize();
          loadHeatmapRef.current?.();
        }, 300);
      } catch (err) {
        console.error("Gagal init peta:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (initTimer) clearTimeout(initTimer);
      if (map) {
        map.off("zoomend", updateLayerVisibility);
        map.remove();
      }
      mapRef.current = null;
      markerLayerRef.current = null;
      heatRef.current = null;
    };
  }, [updateLayerVisibility]);

  // Muat ulang data setiap filter berubah (tanpa membuat ulang peta).
  useEffect(() => {
    if (mapRef.current) loadHeatmap();
  }, [loadHeatmap]);

  const hasActiveFilters = selected.length < CLASS_FILTERS.length || status !== "";

  return (
    <div className="bg-bgPage text-textDark h-[100dvh] flex flex-col overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/peta" sublabel="Heatmap & Sebaran Spasial" />
      {/*__JSX_SIDEBAR__*/}
      <div className="relative flex-1 w-full h-full">
        <div id="heatmap-map" className="absolute inset-0 z-0 bg-gray-100 w-full h-full"></div>

        {/* Floating Controls (Lokasi Saya + Filter) */}
        <div className="fixed md:absolute bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] md:bottom-6 right-4 md:right-6 z-[1500] md:z-[400] flex flex-col items-end gap-2.5">
          {/* Tombol Lokasi Saya */}
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 text-slate-700 hover:text-sky-600 hover:bg-white active:scale-90 transition-all flex items-center justify-center group focus:outline-none"
            aria-label="Pusatkan ke lokasi saya saat ini"
            title="Lokasi Saya"
          >
            <i className={`fas fa-location-crosshairs text-base ${locating ? "animate-spin text-sky-600" : "group-hover:scale-110 transition-transform"}`}></i>
          </button>

          {/* Tombol Buka Filter */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-12 h-12 sm:w-13 sm:h-13 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 text-primary hover:bg-white active:scale-90 transition-all flex items-center justify-center group relative focus:outline-none"
            aria-label="Buka Pengaturan Filter Peta"
            title="Filter Peta"
          >
            <i className="fas fa-sliders text-lg group-hover:rotate-12 transition-transform"></i>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-xs">
                !
              </span>
            )}
          </button>
        </div>

        <div
          className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[1900] hidden opacity-0 transition-opacity duration-300 md:hidden ${sidebarOpen ? "!block !opacity-100" : ""}`}
          onClick={() => setSidebarOpen(false)}
        ></div>

        <aside
          className={`fixed md:absolute bottom-0 md:bottom-20 left-0 md:left-auto md:right-6 z-[2000] md:z-[500] w-full md:w-80 max-h-[85vh] md:max-h-[calc(100vh-150px)] flex flex-col transition-all duration-300 rounded-t-3xl md:rounded-2xl shadow-[0_-4px_25px_rgba(0,0,0,0.15)] md:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transform ${sidebarOpen ? "translate-y-0 md:translate-y-10 opacity-100 visible" : "translate-y-full md:translate-y-10 opacity-0 invisible"}`}
        >
          <div className="flex flex-col h-full pointer-events-auto bg-white/95 backdrop-blur-xl md:rounded-2xl border-t md:border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white/60">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 md:hidden"></div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-slate-900">Filter Peta Sebaran</h2>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors active:scale-95"
                  aria-label="Tutup Filter"
                >
                  <i className="fas fa-times text-sm"></i>
                </button>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Total Titik Kerusakan</span>
              <div className="flex items-baseline gap-2">
                <span ref={totalRef} className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">{total}</span>
                <span className="text-xs text-slate-500 font-medium">laporan aktif di Bali</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <i className="fas fa-filter text-primary"></i> Kategori Masalah
                </h3>
                <button
                  onClick={() => {
                    setSelected(CLASS_FILTERS.map((c) => c.id));
                    setStatus("");
                  }}
                  className="text-[10px] font-bold text-primary hover:underline px-2 py-1 rounded transition-colors uppercase tracking-wider"
                >
                  Reset Semua
                </button>
              </div>

              <div className="space-y-1.5">
                {CLASS_FILTERS.map((c) => (
                  <label key={c.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100/70 cursor-pointer transition-colors group checkbox-wrapper min-h-[44px]">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center">
                        <input type="checkbox" data-class={c.id} checked={selected.includes(c.id)} onChange={() => toggleClass(c.id)} className="peer hidden" />
                        <div className={`checkbox-box w-4 h-4 rounded border border-slate-300 flex items-center justify-center transition-all ${c.box}`}>
                          <i className="fas fa-check text-[10px] text-white opacity-0 transform scale-50 transition-all duration-200"></i>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800">{c.label}</span>
                    </div>
                    <span className={`w-3 h-3 rounded-full ${c.dot} shadow-xs`}></span>
                  </label>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Status Penanganan</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setStatus(s.v)}
                      className={`flex-1 min-h-[36px] py-1.5 text-[10px] font-bold rounded-lg transition-all ${status === s.v ? "text-primary shadow-xs bg-white" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Gradien Kepadatan Heatmap</h4>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500 mb-1"></div>
                <div className="flex justify-between text-[10px] font-medium text-slate-500">
                  <span>Rendah</span>
                  <span>Kritis / Padat</span>
                </div>
              </div>

              {/* Tombol Terapkan di Layar Mobile */}
              <div className="pt-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-full min-h-[44px] py-3 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primaryHover active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-check text-xs"></i>
                  <span>Terapkan & Lihat Peta</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <BottomNav raised="/peta" />
      {/*__JSX_END__*/}
    </div>
  );
}