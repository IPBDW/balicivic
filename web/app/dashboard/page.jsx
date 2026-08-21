"use client";

import Link from "next/link";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; background-color: #F8FAFC; background-image: radial-gradient(at 0% 0%, rgba(201, 75, 75, 0.03) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(201, 75, 75, 0.03) 0px, transparent 50%); }
h1, h2, h3, h4, h5, h6, .font-display { font-family: 'Outfit', sans-serif; }
.glass-card { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); }
.glass-card:hover { background: rgba(255, 255, 255, 0.9); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); transform: translateY(-2px); transition: all 0.3s ease; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
@keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
.stagger-1 { animation-delay: 0.1s; } .stagger-2 { animation-delay: 0.2s; } .stagger-3 { animation-delay: 0.3s; }
.animate-scan { animation: scanline 4s linear infinite; background: linear-gradient(to bottom, transparent, rgba(201, 75, 75, 0.2), transparent); height: 40px; width: 100%; position: absolute; left: 0; pointer-events: none; z-index: 5; }
@keyframes scanline { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
table, table *, tr, td, th { transform: none !important; box-shadow: none !important; }
`;

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
  if (score >= 70) return "text-red-600 bg-red-50 border-red-100";
  if (score >= 40) return "text-amber-600 bg-amber-50 border-amber-100";
  return "text-emerald-600 bg-emerald-50 border-emerald-100";
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
  const [stats, setStats] = useState({ total: "-", antrean: "-", perlu_tindakan: "-", selesai: "-" });
  const [topLocs, setTopLocs] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [barWidths, setBarWidths] = useState({});
  const [issues, setIssues] = useState([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sumary`);
      setStats(await res.json());
    } catch (e) {}
  }, []);

  const fetchTopLocations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/top-locations`);
      setTopLocs(await res.json());
    } catch (e) {
      console.error("Gagal load lokasi:", e);
    }
  }, []);

  const fetchDistribution = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/issues`);
      const issuesArr = await res.json();
      const counts = { jalan_bolong: 0, sampah_liar: 0, genangan_air: 0, kabel_semrawut: 0 };
      issuesArr.forEach((issue) => {
        if (counts[issue.issue_class] !== undefined) counts[issue.issue_class]++;
      });
      const total = issuesArr.length || 1;
      const data = [
        { label: "Jalan Bolong", count: counts.jalan_bolong, percent: Math.round((counts.jalan_bolong / total) * 100) },
        { label: "Sampah Liar", count: counts.sampah_liar, percent: Math.round((counts.sampah_liar / total) * 100) },
        { label: "Genangan Air", count: counts.genangan_air, percent: Math.round((counts.genangan_air / total) * 100) },
        { label: "Kabel Semrawut", count: counts.kabel_semrawut, percent: Math.round((counts.kabel_semrawut / total) * 100) },
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
    try {
      const res = await fetch(`${API_BASE}/api/issues`);
      const data = await res.json();
      setIssues(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchTopLocations();
    const t1 = setInterval(fetchTopLocations, 50000);
    fetchDistribution();
    const t2 = setInterval(fetchDistribution, 100000);
    fetchStats();
    fetchRecentIssues();
    const t3 = setInterval(fetchRecentIssues, 5000);
    initDashboardMap();
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [fetchTopLocations, fetchDistribution, fetchStats, fetchRecentIssues]);

  function initDashboardMap() {
    const mapContainer = document.getElementById("mini-heatmap");
    if (!mapContainer || typeof L === "undefined") return;
    if (window.getComputedStyle(mapContainer).display === "none") return;
    const map = L.map("mini-heatmap", {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: true,
    }).setView([-8.4095, 115.1889], 9);
    L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    fetch(`${API_BASE}/api/issues`)
      .then((r) => r.json())
      .then((points) => {
        const heatData = points
          .filter((p) => (p.latitude || p.lat) && (p.longitude || p.long || p.lon))
          .map((p) => {
            const score = p.final_score || p.severity_score || p.score || 0;
            return [p.latitude || p.lat, p.longitude || p.long || p.lon, Math.max(score / 100, 0.2)];
          });
        if (heatData.length > 0) {
          L.heatLayer(heatData, {
            radius: 20,
            blur: 15,
            maxZoom: 14,
            gradient: { 0.2: "blue", 0.4: "cyan", 0.6: "lime", 0.8: "yellow", 1.0: "red" },
          }).addTo(map);
        }
      })
      .catch((e) => console.error("Dashboard map error:", e));
  }

  const mobileIssues = issues.slice(0, 5);
  const desktopIssues = issues.slice(0, 10);

  return (
    <div className="pb-16">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/dashboard" variant="glass" />

      <main className="flex-1 mx-auto w-full max-w-7xl p-4 md:p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-fade-in-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Dashboard & Heatmap</h1>
            <p className="text-slate-500 mt-2 text-sm md:text-base max-w-2xl">
              Agregasi data laporan infrastruktur di level kecamatan untuk pengambilan keputusan berbasis data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-medium bg-white/50 backdrop-blur-sm text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Data
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up stagger-1">
          <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <i className="fas fa-file-alt text-4xl text-blue-600"></i>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <i className="fas fa-file-alt text-sm"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Laporan</span>
            </div>
            <div className="text-3xl font-display font-bold text-slate-800 mb-1">{stats.total}</div>
            <div className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
              <i className="fas fa-arrow-up"></i> <span>12% bulan ini</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <i className="fas fa-exclamation-triangle text-4xl text-red-600"></i>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <i className="fas fa-exclamation-triangle text-sm"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Perlu Tindakan</span>
            </div>
            <div className="text-3xl font-display font-bold text-slate-800 mb-1">{stats.antrean}</div>
            <div className="text-[10px] font-medium text-red-600 flex items-center gap-1">
              <i className="fas fa-fire"></i> <span>High Severity</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <i className="fas fa-tools text-4xl text-amber-600"></i>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <i className="fas fa-tools text-sm"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sedang Diproses</span>
            </div>
            <div className="text-3xl font-display font-bold text-slate-800 mb-1">{stats.perlu_tindakan}</div>
            <div className="text-[10px] font-medium text-slate-400">Estimasi 2 hari</div>
          </div>

          <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <i className="fas fa-check-circle text-4xl text-emerald-600"></i>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <i className="fas fa-check-circle text-sm"></i>
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selesai</span>
            </div>
            <div className="text-3xl font-display font-bold text-slate-800 mb-1">{stats.selesai}</div>
            <div className="text-[10px] font-medium text-emerald-600">Minggu ini</div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-12 items-start mb-8">
          <div className="lg:col-span-7 flex flex-col h-full animate-fade-in-up stagger-2">
            <div className="glass-card p-6 rounded-2xl h-full min-h-[400px] flex flex-col relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <i className="fas fa-map-marked-alt text-primary"></i> Peta Heatmap Masalah
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Simulasi sebaran jalan rusak, sampah, genangan & kabel.</p>
                </div>
                <Link href="/peta" className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1">
                  Buka Peta Penuh <i className="fas fa-arrow-right"></i>
                </Link>
              </div>
              <div className="relative flex-1 w-full bg-slate-100 rounded-xl border border-dashed border-slate-200 overflow-hidden flex items-center justify-center group-hover:border-primary/20 transition-colors">
                <div id="mini-heatmap" className="absolute inset-0 z-10 hidden lg:block rounded-xl"></div>
                <div className="absolute inset-0 z-0 lg:hidden flex items-center justify-center bg-slate-200/50 backdrop-blur-md">
                  <Link href="/peta" className="px-6 py-3 bg-white text-slate-800 font-bold rounded-xl shadow-lg border border-white/50 hover:scale-105 transition-transform flex items-center gap-2">
                    <i className="fas fa-map-marked-alt text-primary"></i> Buka Heatmap
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6 animate-fade-in-up stagger-3">
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <i className="fas fa-trophy text-amber-500"></i> Top 3 Kecamatan
                </h3>
              </div>
              <div className="space-y-3">
                {topLocs.length === 0 && (
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                )}
                {topLocs.length > 0 &&
                  topLocs.map((item, index) => {
                    const style = RANK_BADGES[index] || RANK_BADGES[2];
                    return (
                      <div key={index} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-slate-50 transition-all group cursor-default">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-white group-hover:shadow-sm transition-all">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-800">{item.kabupaten}</h4>
                            <span className="text-xs text-slate-500">{item.total} Laporan</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>{style.label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                <i className="fas fa-chart-pie text-primary"></i> Distribusi Masalah
              </h3>
              <div className="space-y-4">
                {distribution.length === 0 && (
                  <div className="animate-pulse space-y-3">
                    <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                    <div className="h-2 bg-slate-200 rounded col-span-1"></div>
                  </div>
                )}
                {distribution.map((item, index) => {
                  const color = getSeverityColor(item.percent);
                  return (
                    <div key={index} className="group">
                      <div className="flex justify-between mb-1.5 text-xs font-medium">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="text-slate-500">{item.percent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out relative"
                          style={{ width: barWidths[`bar-${index}`] || "0%", backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">{item.count} laporan</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end items-center">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Updated <span className="font-mono text-slate-600 ml-1">{new Date().toLocaleTimeString()}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Reports Table */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in-up stagger-3">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
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
              const timeStr = new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
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
                  const dateObj = new Date(item.created_at);
                  const timeStr = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
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

      <BottomNav />
    </div>
  );
}