"use client";

import Link from "next/link";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { fetchAllIssues } from "@/lib/api";
import { formatTimeWitaLabel, formatDateWita } from "@/lib/datetime";
import { getScoreBadgeClass } from "@/lib/severity";
import { useCallback, useEffect, useMemo, useState } from "react";

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
table, table *, tr, td, th { transform: none !important; box-shadow: none !important; }
thead th { transition: none !important; }
`;

function getStatusColors(status) {
  const st = String(status || "").toUpperCase();
  if (st === "PENDING" || st === "OPEN")
    return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: "fa-clock" };
  if (st === "IN_PROGRESS" || st === "INPROGRESS")
    return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "fa-spinner" };
  if (st === "DONE" || st === "SELESAI")
    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "fa-circle-check" };
  if (st === "ERROR")
    return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", icon: "fa-circle-exclamation" };
  return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: "fa-clock" };
}

function scoreClass(score) {
  return getScoreBadgeClass(score);
}

const CATEGORY_FILTERS = [
  { id: "", label: "Semua Kategori", icon: "fa-border-all" },
  { id: "jalan_bolong", label: "Jalan Rusak", icon: "fa-road" },
  { id: "sampah_liar", label: "Sampah Liar", icon: "fa-trash-can" },
  { id: "genangan_air", label: "Genangan Air", icon: "fa-water" },
  { id: "kabel_semrawut", label: "Kabel Bahaya", icon: "fa-network-wired" },
];

const STATUS_FILTERS = [
  { id: "", label: "Semua Status" },
  { id: "PENDING", label: "Menunggu" },
  { id: "IN_PROGRESS", label: "Diproses" },
  { id: "DONE", label: "Selesai" },
];

export default function LaporanPage() {
  const [all, setAll] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const PAGE_SIZE = 20;

  const applyFilters = useCallback((sourceList, searchKey, cat, st) => {
    let result = sourceList || [];
    if (cat) {
      result = result.filter((i) => i.issue_class === cat);
    }
    if (st) {
      result = result.filter((i) => {
        const itemStatus = String(i.status || "").toUpperCase();
        return itemStatus === st || (st === "PENDING" && itemStatus === "OPEN");
      });
    }
    if (searchKey && searchKey.trim()) {
      const q = searchKey.trim().toLowerCase();
      result = result.filter(
        (item) =>
          String(item.issue_class || "").toLowerCase().includes(q) ||
          (item.kecamatan && item.kecamatan.toLowerCase().includes(q)) ||
          (item.kabupaten && item.kabupaten.toLowerCase().includes(q)) ||
          String(item.status || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchAllIssues();
      setAll(data);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const shown = useMemo(() => {
    return applyFilters(all, keyword, selectedCat, selectedStatus);
  }, [all, keyword, selectedCat, selectedStatus, applyFilters]);

  // Reset ke halaman pertama saat filter berubah
  const handleKeywordChange = (val) => {
    setKeyword(val);
    setPage(1);
  };

  const handleCategoryChange = (catId) => {
    setSelectedCat(catId);
    setPage(1);
  };

  const handleStatusChange = (stId) => {
    setSelectedStatus(stId);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 pt-6 md:pt-10 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-2.5 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <i className="fas fa-database text-xs"></i>
            <span>Arsip Publik Transparan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
            Semua Laporan Kerusakan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
            Pantau dan telusuri seluruh riwayat laporan jalan berlubang, sampah liar, dan utilitas di Provinsi Bali.
          </p>

          {/* Search Box */}
          <div className="w-full max-w-md mt-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <i className="fas fa-search text-xs"></i>
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary block w-full pl-10 pr-9 py-2.5 sm:py-3 shadow-xs transition-all outline-none"
              placeholder="Cari lokasi (Kuta, Denpasar), jenis kerusakan, atau status..."
            />
            {keyword && (
              <button
                type="button"
                onClick={() => handleKeywordChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Hapus pencarian"
              >
                <i className="fas fa-circle-xmark text-xs"></i>
              </button>
            )}
          </div>

          {/* Quick Filters (Horizontal scrollable on mobile) */}
          <div className="w-full flex flex-col gap-2 mt-3">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 -mx-4 px-4 sm:mx-0 sm:justify-center">
              {CATEGORY_FILTERS.map((cat) => {
                const isActive = selectedCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 min-h-[36px] ${
                      isActive
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <i className={`fas ${cat.icon} text-[10px]`}></i>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-1 -mx-4 px-4 sm:mx-0 sm:justify-center">
              {STATUS_FILTERS.map((st) => {
                const isActive = selectedStatus === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleStatusChange(st.id)}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                      isActive
                        ? "bg-primary text-white shadow-xs font-bold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up min-h-[480px] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">Daftar Laporan Terkini</h2>
              <span className="text-[11px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                {shown.length} Data
              </span>
              <button
                onClick={fetchData}
                className="text-slate-500 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-slate-200 active:scale-95"
                title="Refresh Data"
                aria-label="Refresh Data"
              >
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
            </div>
            <Link
              href="/lapor"
              className="bg-primary text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-primaryHover transition-all flex items-center gap-2 shadow-sm shadow-primary/20 w-full sm:w-auto justify-center active:scale-95"
            >
              <i className="fas fa-plus"></i>
              <span>Buat Laporan Baru</span>
            </Link>
          </div>

          {/* Mobile View (Cards) */}
          <div className="md:hidden space-y-3.5 p-3.5 sm:p-4 bg-slate-50/50 flex-1">
            {loading && (
              <div className="text-center text-slate-400 text-sm py-16 flex flex-col items-center gap-3">
                <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-8 w-8"></div>
                <span className="text-xs font-medium">Memuat data laporan...</span>
              </div>
            )}
            {error && !loading && ErrorState}
            {!loading && !error && shown.length === 0 && EmptyState}
            {!loading &&
              !error &&
              paged.map((item) => {
                const timeStr = formatTimeWitaLabel(item.created_at);
                const dateStr = formatDateWita(item.created_at);
                const sc = scoreClass(item.final_score);
                const statusColors = getStatusColors(item.status);
                const cat = item.issue_class;
                let catIcon = "fa-triangle-exclamation";
                let catBg = "bg-rose-50 text-rose-600 border-rose-200";
                if (cat === "jalan_bolong") {
                  catIcon = "fa-road";
                  catBg = "bg-rose-50 text-rose-600 border-rose-200";
                } else if (cat === "sampah_liar") {
                  catIcon = "fa-trash-can";
                  catBg = "bg-amber-50 text-amber-700 border-amber-200";
                } else if (cat === "genangan_air") {
                  catIcon = "fa-water";
                  catBg = "bg-sky-50 text-sky-600 border-sky-200";
                } else if (cat === "kabel_semrawut") {
                  catIcon = "fa-network-wired";
                  catBg = "bg-slate-100 text-slate-700 border-slate-300";
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col gap-3 hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${sc} flex items-center gap-1`}>
                          <i className="fas fa-gauge-high text-[9px]"></i>
                          <span>Skor {item.final_score}</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColors.bg} ${statusColors.text} ${statusColors.border} flex items-center gap-1`}>
                          <i className={`fas ${statusColors.icon} text-[9px]`}></i>
                          <span>{item.status}</span>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-bold text-slate-900">{timeStr}</div>
                        <div className="text-[10px] text-slate-500">{dateStr}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${catBg}`}>
                        <i className={`fas ${catIcon} text-sm`}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 capitalize text-sm truncate">
                          {String(item.issue_class || "Laporan Kerusakan").replace(/_/g, " ")}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5 truncate">
                          <i className="fas fa-location-dot text-rose-500 text-[10px] shrink-0"></i>
                          <span className="truncate">
                            {item.kecamatan || item.kabupaten
                              || (item.latitude != null && item.longitude != null ? `${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}` : "Wilayah Bali")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/detail/${item.id}`}
                      className="w-full min-h-[44px] bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95"
                    >
                      <span>Lihat Analisis AI PUPR</span>
                      <i className="fas fa-arrow-right text-[10px]"></i>
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
                  paged.map((item) => {
                    const timeStr = formatTimeWitaLabel(item.created_at);
                    const dateStr = formatDateWita(item.created_at);
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
                            <span className="truncate max-w-[150px] font-medium text-gray-600">
                              {item.kecamatan || item.kabupaten
                                || (item.latitude != null && item.longitude != null ? "Koordinat" : "Lokasi tidak tersedia")}
                            </span>
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

          {/* Pagination */}
          <div className="p-3.5 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/60">
            <span className="text-xs text-slate-500 font-medium text-center sm:text-left">
              {shown.length === 0
                ? "Tidak ada data laporan"
                : `Menampilkan ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, shown.length)} dari ${shown.length} laporan`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-2xs"
              >
                <i className="fas fa-chevron-left mr-1 text-[10px]"></i> Prev
              </button>
              <span className="text-xs font-bold text-slate-800 px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-2xs"
              >
                Next <i className="fas fa-chevron-right ml-1 text-[10px]"></i>
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav raised="/laporan" />
    </div>
  );
}