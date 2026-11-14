"use client";

import { imgUrl, apiGet, apiPut, apiDelete } from "@/lib/api";
import { getScoreBadgeClass } from "@/lib/severity";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";

const STORAGE_KEY = "balicivic_admin_token";

const CATEGORY_NAMES = {
  jalan_bolong: "Jalan Rusak dan Berlubang",
  sampah_liar: "Timbulan Sampah Liar",
  genangan_air: "Genangan Air dan Drainase",
  kabel_semrawut: "Kabel Utilitas Bahaya",
  aman: "Aman / Tanpa Kerusakan",
};

function formatCategory(c) {
  if (!c) return "-";
  return CATEGORY_NAMES[c] || c.replace(/_/g, " ");
}

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token");
  const urlId = searchParams.get("id");

  // Auth State
  const [authToken, setAuthToken] = useState("");
  const [authStatus, setAuthStatus] = useState("checking"); // "checking" | "login" | "authenticated"
  const [loginInput, setLoginInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Navigation State derived directly from URL (Single Source of Truth)
  const selectedId = urlId ? Number(urlId) || urlId : null;
  const activeView = selectedId ? "detail" : "queue";

  // URL Navigation Helpers (Push to browser history so Back/Forward buttons work properly)
  const openDetail = useCallback((id) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", String(id));
    router.push(`/admin?${params.toString()}`);
  }, [router, searchParams]);

  const closeDetail = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    const qs = params.toString();
    router.push(qs ? `/admin?${qs}` : "/admin");
  }, [router, searchParams]);

  // Queue State
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, antrean: 0, perlu_tindakan: 0, selesai: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail State
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [pdfVisible, setPdfVisible] = useState(false);
  const pdfRef = useRef(null);

  function showToast(title, message, isError = false) {
    setToast({ title, message, isError });
    setTimeout(() => setToast(null), 3500);
  }

  // 1. Verifikasi Token ke Backend
  const verifyTokenWithBackend = useCallback(async (candidateToken, targetId = null) => {
    try {
      const verifyPath = targetId
        ? `/api/admin/verify?token=${encodeURIComponent(candidateToken)}&issue_id=${encodeURIComponent(targetId)}&id=${encodeURIComponent(targetId)}`
        : `/api/admin/verify?token=${encodeURIComponent(candidateToken)}`;
      await apiGet(verifyPath, { headers: { "X-Admin-Token": candidateToken } });
      return true;
    } catch {
      return false;
    }
  }, []);

  // 2. Initial Auth Check (URL Query atau SessionStorage)
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (urlToken) {
        const isValid = await verifyTokenWithBackend(urlToken, urlId);
        if (cancelled) return;
        if (isValid) {
          sessionStorage.setItem(STORAGE_KEY, urlToken);
          setAuthToken(urlToken);
          setAuthStatus("authenticated");
          return;
        }
      }

      const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const isValid = await verifyTokenWithBackend(stored);
        if (cancelled) return;
        if (isValid) {
          setAuthToken(stored);
          setAuthStatus("authenticated");
          return;
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }

      if (!cancelled) {
        setAuthStatus("login");
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [urlToken, urlId, verifyTokenWithBackend]);

  // 3. Handle Login Submit
  async function handleLogin(e) {
    e.preventDefault();
    if (!loginInput.trim()) {
      setLoginError("Masukkan token otorisasi admin dinas.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");

    const isValid = await verifyTokenWithBackend(loginInput.trim(), urlId);
    setLoginLoading(false);

    if (isValid) {
      sessionStorage.setItem(STORAGE_KEY, loginInput.trim());
      setAuthToken(loginInput.trim());
      setAuthStatus("authenticated");
      showToast("Berhasil Masuk", "Sesi administrasi dinas telah aktif.");
    } else {
      setLoginError("Token tidak valid. Pastikan token sesuai dengan konfigurasi admin dinas.");
    }
  }

  // 4. Handle Logout
  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthToken("");
    setAuthStatus("login");
    setData(null);
    router.replace("/admin");
    showToast("Keluar", "Sesi administrasi Anda telah ditutup.");
  }

  // 5. Fetch Summary Stats & Queue List
  const fetchQueueData = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setIssuesLoading(true);
    try {
      const [sumRes, issuesRes] = await Promise.all([
        apiGet("/api/sumary").catch(() => null),
        apiGet("/api/issues?limit=100").catch(() => []),
      ]);

      if (sumRes) setStats(sumRes);
      if (Array.isArray(issuesRes)) setIssues(issuesRes);
    } catch (e) {
      console.error("Gagal memuat antrean admin:", e);
      showToast("Gagal Memuat", "Tidak dapat menyinkronkan data antrean.", true);
    } finally {
      setIssuesLoading(false);
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchQueueData();
    }
  }, [authStatus, fetchQueueData]);

  // 6. Fetch Detail Issue
  const fetchDetail = useCallback(async (id) => {
    if (!id) return;
    setDataLoading(true);
    try {
      const res = await apiGet(`/api/issues/${id}`);
      setData(res);
    } catch (e) {
      console.error("Gagal memuat detail laporan:", e);
      showToast("Gagal Memuat", "Laporan tidak ditemukan.", true);
      closeDetail();
    } finally {
      setDataLoading(false);
    }
  }, [closeDetail]);

  useEffect(() => {
    if (authStatus === "authenticated" && selectedId) {
      fetchDetail(selectedId);
    }
  }, [authStatus, selectedId, fetchDetail]);

  // 7. Update Status Laporan
  async function updateStatus(targetId, newStatus) {
    setActionBusy(true);
    try {
      await apiPut(
        `/api/issues/${targetId}/status?status=${newStatus}`,
        null,
        { headers: { "X-Admin-Token": authToken } }
      );
      showToast("Status Diperbarui", `Laporan #${targetId} dialihkan ke status ${newStatus}.`);
      if (selectedId === targetId) {
        fetchDetail(targetId);
      }
      fetchQueueData();
    } catch (e) {
      showToast("Gagal Memperbarui", e.message, true);
    } finally {
      setActionBusy(false);
    }
  }

  // 8. Delete Laporan
  async function deleteIssue(targetId) {
    setActionBusy(true);
    try {
      await apiDelete(`/api/issues/${targetId}`, {
        headers: { "X-Admin-Token": authToken },
      });
      showToast("Laporan Dihapus", `Laporan #${targetId} telah dihapus permanen.`);
      if (selectedId === targetId) {
        closeDetail();
      }
      fetchQueueData();
    } catch (e) {
      showToast("Gagal Menghapus", e.message, true);
    } finally {
      setActionBusy(false);
    }
  }

  // 9. Download Official Work Order / SPK PDF
  function downloadPDF() {
    if (!data) return;
    showToast("Memproses Dokumen", "Menyusun Surat Perintah Kerja (SPK) format PDF...");
    setPdfVisible(true);
    setTimeout(() => {
      if (!pdfRef.current || typeof window.html2pdf === "undefined") {
        setPdfVisible(false);
        showToast("Gagal", "Modul PDF belum siap.", true);
        return;
      }
      window.html2pdf()
        .set({
          margin: 0,
          filename: `SPK_Dinas_BaliCivic_${data ? String(data.id).padStart(5, "0") : "laporan"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(pdfRef.current)
        .save()
        .then(() => {
          setPdfVisible(false);
          showToast("Berhasil", "Berkas SPK PDF berhasil diunduh.");
        })
        .catch(() => {
          setPdfVisible(false);
          showToast("Gagal", "Gagal merender dokumen PDF.", true);
        });
    }, 200);
  }

  // Filter Issues
  const filteredIssues = issues.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (categoryFilter !== "ALL" && item.issue_class !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLoc = (item.kecamatan || "").toLowerCase().includes(q) || (item.kabupaten || "").toLowerCase().includes(q);
      const matchClass = (item.issue_class || "").toLowerCase().includes(q);
      const matchId = String(item.id).includes(q);
      if (!matchLoc && !matchClass && !matchId) return false;
    }
    return true;
  });

  // =========================================================================
  // VIEW: CHECKING AUTH STATE
  // =========================================================================
  if (authStatus === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-800">
        <div className="w-10 h-10 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Memeriksa otorisasi petugas...</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW: LOGIN PORTAL (CLEAN, CIVIC, NO AI-SLOP)
  // =========================================================================
  if (authStatus === "login") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 text-slate-800">
        <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-2">
          <Link href="/" className="inline-flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors">
            <img src="/assets/BaliCivic_App_Icon_1_.png" alt="Logo" className="w-7 h-7 rounded border border-slate-200" />
            <span className="font-bold text-sm tracking-tight text-slate-900">BaliCivic</span>
          </Link>
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-900 transition-colors">
            Kembali ke Portal Publik
          </Link>
        </header>

        <main className="max-w-md w-full mx-auto my-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="border-b border-slate-200 pb-5 mb-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Pemerintah Provinsi Bali
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Portal Administrasi Dinas
              </h1>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Akses verifikasi laporan dan penerbitan Surat Perintah Kerja (SPK) untuk Dinas PUPR dan DLHK.
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Token Otoritas Admin
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Masukkan token dinas..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                    tabIndex={-1}
                  >
                    {showPassword ? "Sembunyikan" : "Lihat"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {loginLoading ? "Memverifikasi..." : "Masuk ke Sistem"}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed text-center">
              Akses khusus petugas berwenang Dinas PUPR dan DLHK Provinsi Bali.
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-500 py-3">
          Sistem Pengelolaan Infrastruktur Sipil Presisi BaliCivic
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW: AUTHENTICATED WORKSPACE (GROUNDED, CRISP, HIGH DENSITY)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm p-3.5 rounded-lg shadow-md border text-xs leading-relaxed ${
            toast.isError
              ? "bg-red-50 text-red-900 border-red-200"
              : "bg-white text-slate-900 border-slate-200"
          }`}
        >
          <div className="font-bold mb-0.5">{toast.title}</div>
          <div className="text-slate-600">{toast.message}</div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-lg border border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  if (fn) fn();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
                  confirmModal.type === "danger"
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Res Image Viewer Modal */}
      {modalOpen && data?.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setModalOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={imgUrl(data.image_url)}
              alt="Bukti Lengkap"
              className="max-h-[82vh] w-auto object-contain rounded border border-white/20"
            />
            <div className="mt-3 flex items-center gap-3 text-xs text-white">
              <span>{formatCategory(data.issue_class)} (Skor: {data.final_score}/100)</span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/assets/BaliCivic_App_Icon_1_.png" alt="Logo" className="w-6 h-6 rounded border border-slate-200" />
              <span className="font-bold text-sm tracking-tight text-slate-900">BaliCivic</span>
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-medium text-slate-700">
              Portal Administrasi Dinas PUPR Bali
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/dashboard"
              target="_blank"
              className="text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline-block"
            >
              Lihat Portal Publik
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors font-medium"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* SUB-NAVIGATION BAR */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeDetail}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeView === "queue"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Antrean Laporan ({issues.length})
            </button>

            {selectedId && (
              <>
                <span className="text-slate-400">/</span>
                <button
                  type="button"
                  onClick={() => openDetail(selectedId)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeView === "detail"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Detail Laporan #{selectedId}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={fetchQueueData}
            className="text-slate-500 hover:text-slate-800 transition-colors px-2 py-1"
            title="Muat ulang data"
          >
            {issuesLoading ? "Menyinkronkan..." : "Segarkan"}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: QUEUE TABLE */}
      {/* =================================================================== */}
      {activeView === "queue" && (
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 space-y-5">
          {/* STATS ROW (CLEAN, NO GRADIENTS, NO GLOW) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-slate-500 block">Total Laporan Masuk</span>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {stats.total || issues.length}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Semua laporan warga</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-red-600 block">Menunggu Verifikasi</span>
              <div className="text-2xl font-bold text-red-700 mt-1 font-mono">
                {stats.antrean || 0}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Membutuhkan atensi</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-amber-700 block">Sedang Ditangani</span>
              <div className="text-2xl font-bold text-amber-800 mt-1 font-mono">
                {stats.perlu_tindakan || 0}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Dikerjakan di lapangan</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-emerald-700 block">Selesai Diperbaiki</span>
              <div className="text-2xl font-bold text-emerald-800 mt-1 font-mono">
                {stats.selesai || 0}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Arsip Berita Acara</span>
            </div>
          </div>

          {/* FILTER CONTROLS */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Status Filter */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium bg-slate-50">
                {[
                  { id: "ALL", label: "Semua Status" },
                  { id: "PENDING", label: "Menunggu" },
                  { id: "IN_PROGRESS", label: "Diproses" },
                  { id: "DONE", label: "Selesai" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      statusFilter === tab.id
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kecamatan, kabupaten, atau ID..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs border-t border-slate-100">
              <span className="text-slate-500 font-medium text-[11px] mr-1">Kategori:</span>
              {[
                { id: "ALL", label: "Semua Kategori" },
                { id: "jalan_bolong", label: "Jalan Rusak" },
                { id: "sampah_liar", label: "Sampah Liar" },
                { id: "genangan_air", label: "Genangan Air" },
                { id: "kabel_semrawut", label: "Kabel Bahaya" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    categoryFilter === c.id
                      ? "bg-slate-900 text-white font-medium"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="font-semibold text-xs text-slate-800 uppercase tracking-wide">
                Daftar Antrean Laporan
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {filteredIssues.length} laporan
              </span>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <p className="font-medium text-slate-700 text-xs">Tidak ada laporan yang sesuai dengan filter.</p>
                <p className="text-xs text-slate-500">
                  Ubah pilihan status, kategori, atau kata kunci pencarian.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="px-4 py-2.5 font-semibold">Bukti</th>
                      <th className="px-4 py-2.5 font-semibold">Skor</th>
                      <th className="px-4 py-2.5 font-semibold">Kategori</th>
                      <th className="px-4 py-2.5 font-semibold">Wilayah</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Waktu Masuk</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredIssues.map((item) => {
                      const score = item.final_score ?? 0;
                      const badgeClass = getScoreBadgeClass(score);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          {/* Bukti Foto */}
                          <td className="px-4 py-2.5">
                            <div className="w-12 h-10 rounded bg-slate-100 overflow-hidden border border-slate-200">
                              {item.image_url ? (
                                <img
                                  src={imgUrl(item.image_url)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                                  No photo
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Skor */}
                          <td className="px-4 py-2.5">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${badgeClass}`}>
                              {score}/100
                            </span>
                          </td>

                          {/* Kategori */}
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-900">
                              {formatCategory(item.issue_class)}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{item.id}
                            </span>
                          </td>

                          {/* Wilayah */}
                          <td className="px-4 py-2.5 text-slate-600">
                            <div className="font-medium text-slate-800">
                              {[item.kecamatan, item.kabupaten].filter(Boolean).join(", ") || "Provinsi Bali"}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {item.latitude != null && item.longitude != null
                                ? `${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`
                                : "Koordinat belum tercatat"}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                item.status === "DONE"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : item.status === "IN_PROGRESS"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-red-50 text-red-800 border-red-200"
                              }`}
                            >
                              {item.status === "DONE"
                                ? "Selesai"
                                : item.status === "IN_PROGRESS"
                                ? "Diproses"
                                : "Menunggu"}
                            </span>
                          </td>

                          {/* Waktu */}
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>

                          {/* Tindakan */}
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => openDetail(item.id)}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors"
                            >
                              Buka Lembar Kerja
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: DETAIL LEMBAR DISPOSISI */}
      {/* =================================================================== */}
      {activeView === "detail" && (
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 space-y-5">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              &larr; Kembali ke Antrean
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadPDF}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cetak SPK (PDF)
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmModal({
                    title: "Hapus Laporan Permanen",
                    message: `Laporan #${selectedId} beserta seluruh data dan bukti fotonya akan dihapus dari server. Tindakan ini hanya untuk laporan keliru atau laporan uji coba. Lanjutkan?`,
                    type: "danger",
                    onConfirm: () => deleteIssue(selectedId),
                  });
                }}
                disabled={actionBusy}
                className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Hapus Laporan
              </button>
            </div>
          </div>

          {dataLoading || !data ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <p className="text-xs font-medium text-slate-600">Memuat berkas laporan #{selectedId}...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Box Berkas */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Lembar Pemeriksaan dan Disposisi
                    </span>
                    <h1 className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatCategory(data.issue_class)}
                    </h1>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Wilayah: {[data.kecamatan, data.kabupaten].filter(Boolean).join(", ") || "Provinsi Bali"}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-xl font-bold font-mono text-slate-900">#{data.id}</span>
                    <span className="text-xs text-slate-500 block font-mono">
                      {new Date(data.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid 2 Kolom: Kiri Bukti & Teknis, Kanan Disposisi & Status */}
              <div className="grid lg:grid-cols-12 gap-5">
                {/* Kolom Kiri: Bukti & Analisis */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Foto Bukti */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div
                      className="relative w-full h-[320px] bg-slate-900 flex items-center justify-center cursor-zoom-in"
                      onClick={() => setModalOpen(true)}
                      title="Klik untuk membuka ukuran penuh"
                    >
                      {data.image_url ? (
                        <img
                          src={imgUrl(data.image_url)}
                          alt="Bukti Laporan"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-slate-400 text-xs">Foto tidak tersedia</div>
                      )}
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 rounded text-white text-[10px] font-medium">
                        Klik untuk perbesar
                      </div>
                    </div>
                  </div>

                  {/* Parameter Teknis Kerusakan */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                    <h2 className="font-semibold text-xs uppercase tracking-wide text-slate-700">
                      Parameter Teknis Kerusakan
                    </h2>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Estimasi Lebar Kerusakan</span>
                        <span className="font-bold text-slate-900 text-sm mt-0.5 block font-mono">
                          {(() => {
                            const w = data.meta_data?.llm_result?.dinas?.estimated_width_m
                              ?? data.meta_data?.llm_result?.size_reasoning?.adjusted_width_m;
                            return w != null ? `~${Number(w).toFixed(2)} meter` : "-";
                          })()}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Jarak Pengambilan Foto</span>
                        <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                          {data.meta_data?.geometry?.distance_m
                            ? `${data.meta_data.geometry.distance_m} meter (${data.meta_data.geometry.distance_category || "Normal"})`
                            : "-"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <span className="font-semibold text-slate-700 block">Deskripsi Kerusakan:</span>
                      <p className="text-slate-600 leading-relaxed">
                        {data.description || "Tidak ada deskripsi rinci."}
                      </p>
                    </div>

                    {data.meta_data?.llm_result?.dinas?.risk_notes && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1">
                        <span className="font-semibold text-amber-900 block">
                          Catatan Risiko Keselamatan:
                        </span>
                        <p className="text-amber-800 leading-relaxed">
                          {data.meta_data.llm_result.dinas.risk_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Disposisi & Status */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Card Skor */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Skor Keparahan
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold text-xs border ${getScoreBadgeClass(data.final_score)}`}>
                        {data.severity_label || "LOW"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-slate-900 font-mono">{data.final_score ?? 0}</span>
                      <span className="text-xs text-slate-400 font-mono">/ 100</span>
                    </div>
                  </div>

                  {/* Panel Disposisi */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                    <h2 className="font-semibold text-xs uppercase tracking-wide text-slate-700">
                      Disposisi Petugas
                    </h2>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <span className="font-semibold text-slate-800 block">Rekomendasi Penanganan:</span>
                      <p className="text-slate-600 leading-relaxed">
                        {data.meta_data?.llm_result?.dinas?.recommended_action || "Lakukan inspeksi dan penanganan sesuai SOP teknis dinas terkait."}
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      {data.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              title: "Verifikasi dan Tugaskan Lapangan",
                              message: `Laporan #${data.id} akan diverifikasi dan status diubah menjadi 'Diproses'. Lanjutkan?`,
                              type: "primary",
                              onConfirm: () => updateStatus(data.id, "IN_PROGRESS"),
                            });
                          }}
                          disabled={actionBusy}
                          className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                        >
                          Tugaskan Tim Lapangan (Ubah ke Diproses)
                        </button>
                      )}

                      {data.status === "IN_PROGRESS" && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              title: "Tandai Perbaikan Selesai",
                              message: `Laporan #${data.id} akan ditandai Selesai. Lanjutkan?`,
                              type: "primary",
                              onConfirm: () => updateStatus(data.id, "DONE"),
                            });
                          }}
                          disabled={actionBusy}
                          className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                        >
                          Tandai Perbaikan Selesai
                        </button>
                      )}

                      {data.status === "DONE" && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-center font-semibold text-xs">
                          Laporan Telah Ditandai Selesai
                        </div>
                      )}

                      <a
                        href={data.latitude && data.longitude ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors block text-center"
                      >
                        Buka Koordinat di Google Maps
                      </a>
                    </div>
                  </div>

                  {/* Audit Trail Timeline */}
                  {Array.isArray(data.timeline) && data.timeline.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5">
                      <h3 className="font-semibold text-xs uppercase tracking-wide text-slate-700">
                        Riwayat Penanganan
                      </h3>
                      <ol className="relative border-l border-slate-200 ml-2 space-y-3 text-xs pt-1">
                        {data.timeline.map((ev, idx) => (
                          <li key={idx} className="ml-3">
                            <span className="absolute -left-1 mt-1.5 w-2 h-2 rounded-full bg-slate-400"></span>
                            <p className="font-semibold text-slate-900">{ev.message || ev.status}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {ev.timestamp} ({ev.actor || "Sistem"})
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* =================================================================== */}
      {/* PRINT TEMPLATE: DOKUMEN SPK RESMI PEMPROV BALI (PDF) */}
      {/* =================================================================== */}
      {pdfVisible && data && (
        <div
          ref={pdfRef}
          className="fixed -left-[9999px] top-0"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "16mm",
            fontFamily: "Inter, sans-serif",
            background: "#ffffff",
            color: "#0f172a",
            boxSizing: "border-box",
          }}
        >
          {/* Header Kop Surat Dinas */}
          <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "10px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "800", textTransform: "uppercase" }}>
                Pemerintah Provinsi Bali
              </div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#1e293b" }}>
                Dinas Pekerjaan Umum, Penataan Ruang, Perumahan dan Kawasan Permukiman
              </div>
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                Sistem Pengelolaan Infrastruktur Sipil Presisi BaliCivic
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "monospace" }}>
                SPK #{String(data.id).padStart(5, "0")}
              </div>
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                Tanggal: {new Date(data.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Judul Dokumen */}
          <div style={{ textAlign: "center", marginBottom: "14px" }}>
            <h1 style={{ fontSize: "13px", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>
              Surat Perintah Kerja Lapangan (SPK)
            </h1>
            <p style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 0" }}>
              Penanganan Kerusakan Fasilitas Publik Berdasarkan Verifikasi Sistem
            </p>
          </div>

          {/* Grid Foto & Spesifikasi */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "14px", marginBottom: "14px" }}>
            <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#f8fafc" }}>
              {data.image_url ? (
                <img
                  src={imgUrl(data.image_url)}
                  alt="Bukti Lapangan"
                  style={{ width: "100%", height: "180px", objectFit: "cover" }}
                />
              ) : (
                <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "10px" }}>
                  Foto tidak tersedia
                </div>
              )}
              <div style={{ padding: "6px 10px", background: "#f1f5f9", fontSize: "9px", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Kategori:</strong> {formatCategory(data.issue_class)}</span>
                <span><strong>Skor:</strong> {data.final_score}/100</span>
              </div>
            </div>

            <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px", background: "#ffffff", fontSize: "9px" }}>
              <div style={{ fontWeight: "700", textTransform: "uppercase", fontSize: "8px", color: "#64748b", marginBottom: "6px" }}>
                Rincian Lokasi dan Teknis
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ padding: "5px", background: "#f8fafc", borderRadius: "4px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Kabupaten / Kota</div>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>{data.kabupaten || "-"}</div>
                </div>
                <div style={{ padding: "5px", background: "#f8fafc", borderRadius: "4px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Kecamatan</div>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>{data.kecamatan || "-"}</div>
                </div>
                <div style={{ padding: "5px", background: "#f8fafc", borderRadius: "4px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Koordinat GPS</div>
                  <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace" }}>
                    {data.latitude != null ? `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}` : "-"}
                  </div>
                </div>
                <div style={{ padding: "5px", background: "#f8fafc", borderRadius: "#f8fafc" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Estimasi Lebar</div>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>
                    {data.meta_data?.llm_result?.dinas?.estimated_width_m
                      ? `~${Number(data.meta_data.llm_result.dinas.estimated_width_m).toFixed(2)} m`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rekomendasi Teknis */}
          <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px", marginBottom: "14px", background: "#f8fafc" }}>
            <div style={{ fontWeight: "700", textTransform: "uppercase", fontSize: "8px", color: "#0f172a", marginBottom: "4px" }}>
              Instruksi Penanganan Lapangan:
            </div>
            <p style={{ fontSize: "9px", lineHeight: "1.5", margin: 0, color: "#334155" }}>
              {data.meta_data?.llm_result?.dinas?.recommended_action || "Lakukan pengamanan area kerja, verifikasi fisik, dan perbaikan sesuai standar teknis dinas terkait."}
            </p>
          </div>

          {/* Kolom Tanda Tangan */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "32px" }}>
            <div style={{ textAlign: "center", fontSize: "9px" }}>
              <div>Mengetahui,</div>
              <div style={{ fontWeight: "700", marginBottom: "45px" }}>Pejabat Pembuat Komitmen (PPK)</div>
              <div style={{ borderTop: "1px solid #94a3b8", display: "inline-block", minWidth: "150px", paddingTop: "3px", fontWeight: "700" }}>
                ( .................................................... )
              </div>
              <div style={{ fontSize: "8px", color: "#64748b" }}>NIP. .................................................</div>
            </div>

            <div style={{ textAlign: "center", fontSize: "9px" }}>
              <div>Denpasar, {new Date().toLocaleDateString("id-ID")}</div>
              <div style={{ fontWeight: "700", marginBottom: "45px" }}>Koordinator Tim Lapangan</div>
              <div style={{ borderTop: "1px solid #94a3b8", display: "inline-block", minWidth: "150px", paddingTop: "3px", fontWeight: "700" }}>
                ( .................................................... )
              </div>
              <div style={{ fontSize: "8px", color: "#64748b" }}>Pelaksana Lapangan</div>
            </div>
          </div>

          {/* Footer Dokumen */}
          <div style={{ position: "absolute", bottom: "12mm", left: "16mm", right: "16mm", borderTop: "1px solid #e2e8f0", paddingTop: "6px", textAlign: "center", fontSize: "8px", color: "#94a3b8" }}>
            Dokumen ini dicetak melalui Portal Administrasi BaliCivic untuk keperluan operasional penanganan infrastruktur Dinas PUPR Provinsi Bali.
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
          <p className="text-xs text-slate-500 font-medium">Memuat sistem...</p>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
