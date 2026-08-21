"use client";

import Link from "next/link";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { API_BASE } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

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
table, table *, tr, td, th { transform: none !important; box-shadow: none !important; }
thead th { transition: none !important; }
`;

function getStatusColors(status) {
  const st = String(status || "").toUpperCase();
  if (st === "PENDING" || st === "OPEN")
    return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", icon: "fa-clock" };
  if (st === "IN_PROGRESS" || st === "INPROGRESS")
    return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", icon: "fa-spinner" };
  if (st === "DONE" || st === "SELESAI")
    return { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: "fa-check-circle" };
  if (st === "ERROR")
    return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", icon: "fa-exclamation-circle" };
  return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", icon: "fa-clock" };
}

function scoreClass(score) {
  const isHigh = score > 70;
  const isMed = score > 40;
  return isHigh
    ? "text-red-600 bg-red-50 border-red-100"
    : isMed
      ? "text-amber-600 bg-amber-50 border-amber-100"
      : "text-green-600 bg-green-50 border-green-100";
}

export default function LaporanPage() {
  const [all, setAll] = useState([]);
  const [shown, setShown] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/issues`);
      if (!res.ok) throw new Error("network");
      const data = await res.json();
      setAll(data);
      setShown(data);
      setCount(data.length);
      setError(false);
    } catch (e) {
      console.error("Gagal load tabel:", e);
      setError(true);
      setToast(true);
      setTimeout(() => setToast(false), 5000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function onSearch(e) {
    const keyword = e.target.value.toLowerCase();
    if (!all || !keyword) {
      setShown(all);
      return;
    }
    const filtered = all.filter(
      (item) =>
        String(item.issue_class || "").toLowerCase().includes(keyword) ||
        (item.kecamatan && item.kecamatan.toLowerCase().includes(keyword)) ||
        String(item.status || "").toLowerCase().includes(keyword)
    );
    setShown(filtered);
  }

  const EmptyState = (
    <div className="text-center py-12 flex flex-col items-center gap-3 text-gray-400">
      <i className="far fa-folder-open text-4xl mb-2 opacity-50"></i>
      <span>Belum ada laporan ditemukan</span>
    </div>
  );

  const ErrorState = (
    <div className="text-center py-12 flex flex-col items-center gap-3">
      <div className="bg-red-50 text-red-500 p-4 rounded-full mb-2">
        <i className="fas fa-exclamation-triangle text-2xl"></i>
      </div>
      <h3 className="font-bold text-gray-800">Gagal Memuat Data</h3>
      <p className="text-sm text-gray-500">Terjadi kesalahan saat mengambil data laporan.</p>
      <button onClick={fetchData} className="mt-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
        Coba Lagi
      </button>
    </div>
  );

  return (
    <div className="pb-24 md:pb-0">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/laporan" />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-slide-in-top">
          <div className="bg-white/90 backdrop-blur-md border-l-4 border-red-500 shadow-2xl rounded-lg p-4 flex items-center gap-4">
            <div className="bg-red-100 p-2 rounded-full text-red-600">
              <i className="fas fa-wifi-slash text-lg"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Koneksi Terputus</h3>
              <p className="text-xs text-gray-600 mt-0.5">Gagal terhubung ke server. Mohon periksa jaringan anda.</p>
            </div>
            <button onClick={() => setToast(false)} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 pb-24 pt-8 md:pt-12 animate-fade-in">
        {/* Breadcrumb */}
        <nav className="flex mb-4 text-xs text-textSecondary" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/dashboard" className="inline-flex items-center hover:text-primary transition-colors">
                <i className="fas fa-chart-pie mr-2"></i> Dashboard
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <i className="fas fa-chevron-right text-gray-300 mx-1"></i>
                <span className="text-textDark font-medium">Semua Laporan</span>
              </div>
            </li>
          </ol>
        </nav>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-textDark tracking-tight flex items-center gap-3">
              Semua Laporan
              <span className="text-xs font-normal text-textSecondary bg-gray-100 px-2 py-1 rounded-full border border-gray-200">{count} Laporan</span>
            </h1>
            <p className="text-textSecondary text-xs md:text-sm mt-1">Arsip lengkap laporan masyarakat Bali.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400 text-xs"></i>
              </div>
              <input
                type="text"
                onChange={onSearch}
                className="bg-white border border-lightBorder text-gray-900 text-sm rounded-xl focus:ring-primary focus:border-primary block w-full pl-10 p-2.5 shadow-sm transition-all"
                placeholder="Cari laporan..."
              />
            </div>
            <div className="bg-white px-4 py-2.5 rounded-xl border border-lightBorder shadow-sm flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-bold text-textSecondary">Live</span>
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="bg-white rounded-2xl border border-lightBorder shadow-sm overflow-hidden animate-fade-in-up min-h-[500px] flex flex-col">
          <div className="p-4 md:p-6 border-b border-lightBorder flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/30">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-textDark">Daftar Laporan</h3>
              <button onClick={fetchData} className="text-textSecondary hover:text-primary transition-colors p-1 rounded-full hover:bg-primary/10" title="Refresh Data">
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
            </div>
            <Link href="/lapor" className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primaryHover transition-colors flex items-center gap-2 shadow-md shadow-primary/20 w-full md:w-auto justify-center">
              <i className="fas fa-plus"></i> Buat Laporan Baru
            </Link>
          </div>

          {/* Mobile View (Cards) */}
          <div className="md:hidden space-y-4 p-4 bg-gray-50/50 flex-1">
            {loading && (
              <div className="text-center text-gray-400 text-sm py-12 flex flex-col items-center gap-3">
                <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-8 w-8"></div>
                <span>Memuat data...</span>
              </div>
            )}
            {error && !loading && ErrorState}
            {!loading && !error && shown.length === 0 && EmptyState}
            {!loading &&
              !error &&
              shown.map((item) => {
                const dateObj = new Date(item.created_at);
                const timeStr = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
                const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                const sc = scoreClass(item.final_score);
                const statusColors = getStatusColors(item.status);
                return (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-lightBorder shadow-sm flex flex-col gap-3 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${sc} flex items-center gap-1`}>
                          <i className="fas fa-tachometer-alt text-[9px]"></i> {item.final_score}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColors.bg} ${statusColors.text} ${statusColors.border} flex items-center gap-1`}>
                          <i className={`fas ${statusColors.icon} text-[9px]`}></i> {item.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-textDark">{timeStr}</div>
                        <div className="text-[9px] text-textSecondary">{dateStr}</div>
                      </div>
                    </div>
                    <div className="py-1">
                      <h4 className="font-bold text-textDark capitalize text-sm mb-1 flex items-center gap-2">
                        {String(item.issue_class || "-").replace("_", " ")}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-textSecondary mt-1">
                        <i className="fas fa-map-marker-alt text-primary/60 w-4 text-center"></i>
                        <span className="truncate">{item.kecamatan || "Lokasi Unknown"}</span>
                      </div>
                    </div>
                    <Link href={`/detail/${item.id}`} className="w-full mt-1 bg-white border border-lightBorder text-textDark hover:bg-primary hover:text-white hover:border-primary transition-all py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group-hover:border-primary/30">
                      Lihat Detail <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </Link>
                  </div>
                );
              })}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs text-textSecondary uppercase tracking-wider border-b border-lightBorder">
                  <th className="px-6 py-4 font-semibold">Score</th>
                  <th className="px-6 py-4 font-semibold">Kategori</th>
                  <th className="px-6 py-4 font-semibold">Lokasi</th>
                  <th className="px-6 py-4 font-semibold">Waktu</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lightBorder text-sm bg-white">
                {loading && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-8 w-8"></div>
                        <span>Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {error && !loading && (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-red-500">
                      <div className="flex flex-col items-center gap-2">
                        <i className="fas fa-exclamation-circle text-xl"></i>
                        <span>Gagal memuat data. Periksa koneksi anda.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && !error && shown.length === 0 && <tr><td colSpan="6">{EmptyState}</td></tr>}
                {!loading &&
                  !error &&
                  shown.map((item) => {
                    const dateObj = new Date(item.created_at);
                    const timeStr = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
                    const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                    const sc = scoreClass(item.final_score);
                    const statusColors = getStatusColors(item.status);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group border-b border-lightBorder last:border-0">
                        <td className="px-6 py-4">
                          <span className={`font-bold px-2.5 py-1 rounded-lg border text-xs ${sc}`}>{item.final_score}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textSecondary group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-200">
                              <i className="fas fa-exclamation-circle"></i>
                            </div>
                            <span className="capitalize font-medium text-textDark text-sm">{String(item.issue_class || "-").replace("_", " ")}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-textSecondary text-xs">
                            <i className="fas fa-map-marker-alt text-gray-400"></i>
                            <span className="truncate max-w-[150px] font-medium text-gray-600">{item.kecamatan || "Lokasi Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-textDark">{timeStr}</span>
                            <span className="text-[10px] text-textSecondary">{dateStr}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 w-fit ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                            <i className={`fas ${statusColors.icon}`}></i> {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/detail/${item.id}`} className="text-textSecondary hover:text-primary hover:bg-primary/5 p-2 rounded-lg transition-all" title="Lihat Detail">
                            <i className="fas fa-external-link-alt"></i>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination (Visual) */}
          <div className="p-4 border-t border-lightBorder flex justify-between items-center bg-gray-50/30">
            <span className="text-xs text-textSecondary">Menampilkan semua data</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-lg border border-lightBorder bg-white text-textSecondary text-xs hover:bg-gray-50 disabled:opacity-50" disabled>
                Previous
              </button>
              <button className="px-3 py-1 rounded-lg border border-lightBorder bg-white text-textSecondary text-xs hover:bg-gray-50 disabled:opacity-50" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav raised="/laporan" />
    </div>
  );
}