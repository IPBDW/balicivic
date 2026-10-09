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
  { id: "kabel_semrawut", label: "Kabel Semrawut", dot: "bg-gray-800", box: "text-gray-800 group-hover:border-gray-600" },
];

const STATUS_FILTERS = [
  { v: "", label: "SEMUA" },
  { v: "PENDING", label: "PENDING" },
  { v: "OPEN", label: "OPEN" },
  { v: "DONE", label: "SELESAI" },
];

const DETAIL_ZOOM_THRESHOLD = 12;

export default function PetaPage() {
  const [selected, setSelected] = useState(CLASS_FILTERS.map((c) => c.id));
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mapRef = useRef(null);
  const heatRef = useRef(null);
  const markerLayerRef = useRef(null);
  const totalRef = useRef(null);
  const loadHeatmapRef = useRef(null);

  const toggleClass = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const updateLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    if (z < DETAIL_ZOOM_THRESHOLD) {
      if (heatRef.current && !map.hasLayer(heatRef.current)) heatRef.current.addTo(map);
      if (markerLayerRef.current) map.removeLayer(markerLayerRef.current);
    } else {
      if (heatRef.current && map.hasLayer(heatRef.current)) map.removeLayer(heatRef.current);
      if (markerLayerRef.current) markerLayerRef.current.addTo(map);
    }
  }, []);

  const loadHeatmap = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const res = await fetch(`${API_BASE}/api/issues`);
      const allData = await res.json();
      const points = allData.filter((p) => {
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
        const pStatus = p.status || "OPEN";
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

        const iconHtml = `
          <div class="relative group cursor-pointer transform transition-transform hover:scale-110 hover:z-50">
            <div class="relative z-10 drop-shadow-md">
              <i class="fas fa-map-marker-alt text-3xl ${colorClass} drop-shadow-sm"></i>
              <div class="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-inner"></div>
            </div>
            <div class="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap z-20">
              <div class="bg-white/95 backdrop-blur-sm border border-gray-200 px-2 py-1 rounded-lg shadow-lg flex flex-col items-center gap-0.5">
                <span class="text-[10px] font-bold text-gray-800 uppercase tracking-wide leading-none">${String(pClass).replace("_", " ")}</span>
                <span class="text-[9px] font-mono text-gray-500 leading-none">#${pId}</span>
              </div>
              <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-t border-l border-gray-200"></div>
            </div>
          </div>`;

        const customIcon = L.divIcon({ html: iconHtml, className: "", iconSize: [30, 42], iconAnchor: [15, 42], popupAnchor: [0, -45] });
        const marker = L.marker([pLat, pLon], { icon: customIcon });
        const popupHtml = `
          <div class="font-sans p-1 min-w-[150px]">
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">${String(pClass).replace("_", " ")}</div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-bold text-gray-800">Skor: ${pScore}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${pStatus === "OPEN" ? "bg-red-100 text-red-600" : pStatus === "PENDING" ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"} font-bold">${pStatus}</span>
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
        L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
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

  return (
    <div className="bg-bgPage text-textDark h-screen flex flex-col overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/peta" variant="heatmap" sublabel="Heatmap" />
      {/*__JSX_SIDEBAR__*/}
      <div className="relative flex-1 w-full h-full pt-16">
        <div id="heatmap-map" className="absolute inset-0 z-0 bg-gray-100"></div>

        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed md:absolute bottom-24 md:bottom-6 right-6 z-[1500] md:z-[400] bg-white/90 backdrop-blur-md p-4 rounded-full shadow-lg border border-white/50 text-primary hover:bg-white hover:scale-110 transition-all duration-300 group"
          aria-label="Filter"
        >
          <i className="fas fa-filter text-xl group-hover:rotate-12 transition-transform duration-300"></i>
        </button>

        <div
          className={`fixed inset-0 bg-black/20 z-[1900] hidden opacity-0 transition-opacity duration-300 md:hidden ${sidebarOpen ? "!block !opacity-100" : ""}`}
          onClick={() => setSidebarOpen(false)}
        ></div>

        <aside
          className={`fixed md:absolute bottom-0 md:bottom-20 left-0 md:left-auto md:right-6 z-[2000] md:z-[500] w-full md:w-80 max-h-[80vh] md:max-h-[calc(100vh-150px)] flex flex-col transition-all duration-300 rounded-t-3xl md:rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transform ${sidebarOpen ? "translate-y-0 md:translate-y-10 opacity-100 visible" : "translate-y-full md:translate-y-10 opacity-0 invisible"}`}
        >
          <div className="flex flex-col h-full pointer-events-auto bg-white/95 backdrop-blur-xl md:rounded-2xl border-t md:border border-white/50 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-white/50">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 md:hidden"></div>
              <div className="flex items-center justify-between mb-4 sm:hidden">
                <h2 className="text-lg font-bold text-textDark">Filter Peta</h2>
                <button onClick={() => setSidebarOpen(false)} className="p-2 text-textSecondary hover:text-red-500 transition-colors" aria-label="Tutup">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <h2 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest mb-1">Total Data Points</h2>
              <div className="flex items-baseline gap-2">
                <span ref={totalRef} className="text-3xl font-display font-bold text-textDark">{total}</span>
                <span className="text-xs text-textSecondary font-medium">laporan terdeteksi</span>
              </div>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-textDark flex items-center gap-2 text-sm">
                  <i className="fas fa-filter text-primary"></i> Filter Data
                </h3>
                <button
                  onClick={() => {
                    setSelected(CLASS_FILTERS.map((c) => c.id));
                    setStatus("");
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors uppercase tracking-wider"
                >
                  Reset
                </button>
              </div>

              <div className="mb-6 space-y-3">
                <label className="text-[10px] font-bold text-textSecondary uppercase tracking-widest block mb-2">Kategori Masalah</label>
                {CLASS_FILTERS.map((c) => (
                  <label key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 cursor-pointer transition-colors group checkbox-wrapper">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center">
                        <input type="checkbox" data-class={c.id} checked={selected.includes(c.id)} onChange={() => toggleClass(c.id)} className="peer hidden" />
                        <div className={`checkbox-box w-4 h-4 rounded border border-gray-300 flex items-center justify-center transition-all ${c.box}`}>
                          <i className="fas fa-check text-[10px] text-white opacity-0 transform scale-50 transition-all duration-200"></i>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{c.label}</span>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shadow-sm`}></span>
                  </label>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-[10px] font-bold text-textSecondary uppercase tracking-widest block mb-3">Status Laporan</label>
                <div className="flex p-1 bg-gray-100 rounded-xl">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setStatus(s.v)}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${status === s.v ? "text-primary shadow-sm bg-white" : "text-textSecondary hover:text-textDark"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-textSecondary uppercase tracking-widest mb-2">Intensitas Heatmap</h4>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500 mb-1"></div>
                <div className="flex justify-between text-[10px] font-medium text-textSecondary">
                  <span>Rendah</span>
                  <span>Tinggi</span>
                </div>
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