"use client";

import Link from "next/link";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE, fetchAllIssues, fetchRecentIssuesList } from "@/lib/api";
import { waitForLeaflet } from "@/lib/leaflet";
import { formatTimeWitaLabel, formatTimeWita, formatDateShortWita } from "@/lib/datetime";
import { getScoreBadgeClass } from "@/lib/severity";
import { useCallback, useEffect, useState } from "react";
import {
  DUMMY_STATS,
  DUMMY_TOP_LOCATIONS,
  DUMMY_DISTRIBUTION,
  DUMMY_RECENT_ISSUES,
  DUMMY_HEAT_DATA,
} from "@/lib/dummyDashboard";

// Deteksi apakah lagi di mode dummy (API_BASE kosong → Next.js route handler
// dummy dipakai). Pakai dummy data biar preview dashboard tetap berisi data.
const IS_DUMMY_MODE = !API_BASE || API_BASE === "";

const RANK_BADGES = [
  { label: "PRIORITAS", bg: "bg-red-50", text: "text-red-600", border: "border-red-100" },
  { label: "SEDANG", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  { label: "MONITOR", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
];

function getSeverityColor(percent) {
  if (percent >= 50) return "#dc2626";
  if (percent >= 25) return "#f59e0b";
  return "#10b981";
}

function getScoreClass(score) {
  return getScoreBadgeClass(score);
}

function getStatusColors(status, withBorder = false) {
  const st = String(status || "").toUpperCase();
  const b = withBorder ? " border-slate-200" : "";
  if (st === "PENDING" || st === "OPEN") return `bg-slate-100 text-slate-600${withBorder ? " border-slate-200" : ""}`;
  if (st === "IN_PROGRESS" || st === "INPROGRESS") return `bg-amber-100 text-amber-700${withBorder ? " border-amber-200" : ""}`;
  if (st === "DONE" || st === "SELESAI") return `bg-emerald-100 text-emerald-700${withBorder ? " border-emerald-200" : ""}`;
  if (st === "ERROR") return `bg-blue-100 text-blue-700${withBorder ? " border-blue-200" : ""}`;
  return `bg-slate-100 text-slate-600${withBorder ? " border-slate-200" : ""}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState(IS_DUMMY_MODE ? DUMMY_STATS : { total: "-", antrean: "-", perlu_tindakan: "-", selesai: "-" });
  const [topLocs, setTopLocs] = useState(IS_DUMMY_MODE ? DUMMY_TOP_LOCATIONS : []);
  const [distribution, setDistribution] = useState(IS_DUMMY_MODE ? DUMMY_DISTRIBUTION : []);
  const [barWidths, setBarWidths] = useState({});
  const [issues, setIssues] = useState(IS_DUMMY_MODE ? DUMMY_RECENT_ISSUES : []);
  const [updatedAt, setUpdatedAt] = useState("");

  const fetchStats = useCallback(async () => {
    if (IS_DUMMY_MODE) {
      setStats(DUMMY_STATS);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sumary`);
      setStats(await res.json());
    } catch (e) {}
  }, []);

  const fetchTopLocations = useCallback(async () => {
    if (IS_DUMMY_MODE) {
      setTopLocs(DUMMY_TOP_LOCATIONS);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/top-locations`);
      setTopLocs(await res.json());
    } catch (e) {
      console.error("Gagal load lokasi:", e);
    }
  }, []);

  const fetchDistribution = useCallback(async () => {
    if (IS_DUMMY_MODE) {
      setDistribution(DUMMY_DISTRIBUTION);
      const widths = {};
      DUMMY_DISTRIBUTION.forEach((item, index) => {
        setTimeout(() => setBarWidths((prev) => ({ ...prev, [`bar-${index}`]: item.percent + "%" })), 100 + index * 100);
      });
      return;
    }
    try {
      const issuesArr = await fetchAllIssues();
      const counts = { jalan_bolong: 0, sampah_liar: 0, genangan_air: 0, kabel_semrawut: 0 };
      issuesArr.forEach((issue) => {
        if (counts[issue.issue_class] !== undefined) counts[issue.issue_class]++;
      });
      const total = issuesArr.length || 1;
      const data = [
        { label: "Jalan Bolong", count: counts.jalan_bolong, percent: Math.round((counts.jalan_bolong / total) * 100) },
        { label: "Sampah Liar", count: counts.sampah_liar, percent: Math.round((counts.sampah_liar / total) * 100) },
        { label: "Genangan Air", count: counts.genangan_air, percent: Math.round((counts.genangan_air / total) * 100) },
        { label: "Kabel Berantakan", count: counts.kabel_semrawut, percent: Math.round((counts.kabel_semrawut / total) * 100) },
      ];
      data.sort((a, b) => b.percent - a.percent);
      setDistribution(data);
      const widths = {};
      data.forEach((item, index) => {
        setTimeout(() => setBarWidths((prev) => ({ ...prev, [`bar-${index}`]: item.percent + "%" })), 100 + index * 100);
      });
    } catch (e) {
      console.error("Gagal load distribusi:", e);
    }
  }, []);

  const fetchRecentIssues = useCallback(async () => {
    if (IS_DUMMY_MODE) {
      setIssues(DUMMY_RECENT_ISSUES);
      setUpdatedAt(new Date().toLocaleTimeString());
      return;
    }
    try {
      const data = await fetchRecentIssuesList(10);
      setIssues(data);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const initDashboardMap = useCallback(async () => {
    const mapContainer = document.getElementById("mini-heatmap");
    if (!mapContainer) return;
    // Skip kalau container benar-benar zero-size (hidden by parent).
    const rect = mapContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    let L;
    try {
      L = await waitForLeaflet();
    } catch (e) {
      console.error("Dashboard map error:", e);
      return;
    }
    if (mapContainer._leaflet_id) return; // sudah di-init
    const map = L.map(mapContainer, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: true,
    }).setView([-8.4095, 115.1889], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    const fetchHeatPoints = async () => {
      if (IS_DUMMY_MODE) {
        return DUMMY_HEAT_DATA;
      }
      try {
        const points = await fetchAllIssues();
        return points
          .filter((p) => (p.latitude || p.lat) && (p.longitude || p.long || p.lon))
          .map((p) => {
            const score = p.final_score || p.severity_score || p.score || 0;
            return [p.latitude || p.lat, p.longitude || p.long || p.lon, Math.max(score / 100, 0.2)];
          });
      } catch (e) {
        console.error("Dashboard map error:", e);
        return [];
      }
    };
    fetchHeatPoints().then((heatData) => {
      if (heatData.length > 0) {
        L.heatLayer(heatData, {
          radius: 25,
          blur: 20,
          maxZoom: 16,
          gradient: { 0.2: "blue", 0.4: "cyan", 0.6: "lime", 0.8: "yellow", 1.0: "red" },
        }).addTo(map);
      }
    });
  }, []);

  useEffect(() => {
    // Fetch on mount: setState terjadi setelah await, bukan render berjenjang.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTopLocations();
    const t1 = setInterval(fetchTopLocations, 50000);
    fetchDistribution();
    const t2 = setInterval(fetchDistribution, 100000);
    fetchStats();
    fetchRecentIssues();
    const t3 = setInterval(fetchRecentIssues, 25000);
    initDashboardMap();
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [fetchTopLocations, fetchDistribution, fetchStats, fetchRecentIssues, initDashboardMap]);

  const mobileIssues = issues.slice(0, 5);
  const desktopIssues = issues.slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      <NavbarApp active="/dashboard" sublabel="Pusat Pemantauan & Statistik" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Dashboard Statistik & Sebaran Kerusakan
            </h1>
            <p className="text-slate-600 mt-1.5 text-xs sm:text-sm max-w-2xl">
              Agregasi data laporan jalan rusak, sampah liar, saluran air, dan kabel berbahaya di Provinsi Bali.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold bg-white text-slate-700 px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>WITA Real-time Feed</span>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchStats();
                fetchTopLocations();
                fetchDistribution();
                fetchRecentIssues();
              }}
              className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-primary hover:border-primary/30 transition-colors shadow-2xs flex items-center gap-1.5"
              title="Perbarui data sekarang"
            >
              <i className="fas fa-rotate text-xs"></i>
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden group">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                <i className="fas fa-file-alt"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Laporan</span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mb-1">{stats.total}</div>
            <div className="text-[11px] font-medium text-slate-500">
              Terdata di seluruh Bali
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden group">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-sm">
                <i className="fas fa-triangle-exclamation"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Perlu Tindakan</span>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 mb-1">{stats.antrean}</div>
            <div className="text-[11px] font-medium text-rose-600 font-semibold">
              Prioritas Tinggi (&gt;= 75)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden group">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
                <i className="fas fa-wrench"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sedang Ditangani</span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mb-1">{stats.perlu_tindakan}</div>
            <div className="text-[11px] font-medium text-amber-600 font-medium">
              Tim PUPR di Lapangan
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden group">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                <i className="fas fa-circle-check"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selesai Diperbaiki</span>
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 mb-1">{stats.selesai}</div>
            <div className="text-[11px] font-medium text-emerald-600 font-medium">
              Laporan Ditutup
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-12 items-start mb-8">
          <div className="lg:col-span-7 flex flex-col h-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 h-full min-h-[420px] flex flex-col shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <i className="fas fa-map-marked-alt text-primary"></i> Peta Heatmap Sebaran
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Konsentrasi titik kerusakan jalan, sampah, dan genangan di Bali.</p>
                </div>
                <Link href="/peta" className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-900 hover:text-white transition-colors flex items-center gap-1.5">
                  <span>Peta Penuh</span>
                  <i className="fas fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
              <div className="relative flex-1 w-full h-[280px] sm:h-[320px] lg:h-auto bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                <div id="mini-heatmap" className="absolute inset-0 z-10 rounded-xl"></div>
                <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-200/50 backdrop-blur-md pointer-events-none">
                  <Link href="/peta" className="lg:hidden px-5 py-2.5 bg-white text-slate-800 font-bold text-xs rounded-xl shadow-md border border-slate-200 flex items-center gap-2">
                    <i className="fas fa-map-marked-alt text-primary"></i> Buka Heatmap
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-location-dot text-primary"></i> Wilayah Laporan Terbanyak
                </h3>
              </div>
              <div className="space-y-2.5">
                {topLocs.length === 0 && (
                  <div className="animate-pulse space-y-3 py-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded"></div>
                  </div>
                )}
                {topLocs.length > 0 &&
                  topLocs.map((item, index) => {
                    const style = RANK_BADGES[index] || RANK_BADGES[2];
                    return (
                      <div key={index} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shadow-2xs">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900">{item.kabupaten}</h4>
                            <span className="text-xs text-slate-500">{item.total} Laporan</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>{style.label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <i className="fas fa-chart-pie text-slate-700"></i> Distribusi Kategori Kerusakan
              </h3>
              <div className="space-y-3.5">
                {distribution.length === 0 && (
                  <div className="animate-pulse space-y-3">
                    <div className="h-2 bg-slate-100 rounded"></div>
                    <div className="h-2 bg-slate-100 rounded"></div>
                  </div>
                )}
                {distribution.map((item, index) => {
                  const color = getSeverityColor(item.percent);
                  return (
                    <div key={index}>
                      <div className="flex justify-between mb-1 text-xs font-semibold">
                        <span className="text-slate-800">{item.label}</span>
                        <span className="text-slate-600">{item.percent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: barWidths[`bar-${index}`] || "0%", backgroundColor: color }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 text-right">{item.count} laporan</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                <span>Sinkronisasi Otomatis</span>
                <span className="font-mono text-slate-700 font-medium">{updatedAt || "--:--:--"} WITA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Reports Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-list-ul text-primary"></i> Laporan Masuk (Live)
            </h3>
            <Link href="/lapor" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-primary transition-colors flex items-center gap-2 shadow-sm hidden md:flex">
              <i className="fas fa-plus"></i> Buat Laporan
            </Link>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3 p-4 bg-slate-50/50">
            {mobileIssues.length === 0 && <div className="text-center text-slate-400 text-sm py-4">Belum ada laporan masuk</div>}
            {mobileIssues.map((item) => {
              const timeStr = formatTimeWitaLabel(item.created_at);
              return (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreClass(item.final_score)}`}>{item.final_score}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColors(item.status)}`}>{item.status}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 capitalize text-sm mb-1">{String(item.issue_class || "-").replace("_", " ")}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <i className="fas fa-map-marker-alt text-primary/60"></i>
                      <span className="truncate">{item.kecamatan || "Unknown"}, {item.kabupaten || "Bali"}</span>
                    </div>
                  </div>
                  <Link href={`/detail/${item.id}`} className="w-full mt-1 bg-slate-50 text-slate-600 hover:bg-primary hover:text-white transition-all py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                    Lihat Detail <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Mobile: Lihat Semua */}
          <div className="md:hidden px-4 pb-4 bg-slate-50/50">
            <Link href="/laporan" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
              <i className="fas fa-list"></i> Lihat Semua Laporan <i className="fas fa-arrow-right text-xs"></i>
            </Link>
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold">Score</th>
                  <th className="px-6 py-4 font-semibold">Kategori</th>
                  <th className="px-6 py-4 font-semibold">Lokasi</th>
                  <th className="px-6 py-4 font-semibold">Waktu</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm bg-white/50">
                {desktopIssues.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className="text-center text-slate-400 py-8 text-sm">Belum ada laporan masuk</div>
                    </td>
                  </tr>
                )}
                {desktopIssues.map((item) => {
                  const timeStr = formatTimeWita(item.created_at);
                  const dateStr = formatDateShortWita(item.created_at);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group border-b border-slate-50 last:border-0">
                      <td className="px-6 py-4">
                        <span className={`font-bold px-2.5 py-1 rounded-lg border text-xs ${getScoreClass(item.final_score)}`}>{item.final_score}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                            <i className="fas fa-exclamation-circle"></i>
                          </div>
                          <span className="capitalize font-medium text-slate-700 text-sm">{String(item.issue_class || "-").replace("_", " ")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                          <i className="fas fa-map-marker-alt"></i>
                          <span className="truncate max-w-[150px]">{item.kecamatan || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-700">{timeStr}</span>
                          <span className="text-[10px] text-slate-400">{dateStr}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColors(item.status, true)}`}>{item.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/detail/${item.id}`} className="text-slate-400 hover:text-primary hover:bg-primary/5 p-2 rounded-lg transition-all" title="Lihat Detail">
                          <i className="fas fa-external-link-alt"></i>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Desktop: Lihat Semua */}
          <div className="hidden md:block p-6 border-t border-slate-100 bg-white/30">
            <Link href="/laporan" className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
              <i className="fas fa-list"></i> Lihat Semua Laporan <i className="fas fa-arrow-right text-xs"></i>
            </Link>
          </div>
        </div>
      </main>

      <BottomNav raised="/dashboard" />
    </div>
  );
}