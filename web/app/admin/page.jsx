"use client";

import { imgUrl, apiGet, apiPut, apiDelete } from "@/lib/api";
import { getRiskLevelLabel, getSeverityCode, getScoreBadgeClass } from "@/lib/severity";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";

const STORAGE_KEY = "balicivic_admin_token";

const CATEGORY_NAMES = {
  jalan_bolong: "Jalan Rusak & Berlubang",
  sampah_liar: "Timbulan Sampah Liar",
  genangan_air: "Genangan Air & Drainase",
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

  // Navigation State
  const [activeView, setActiveView] = useState("queue"); // "queue" | "detail"
  const [selectedId, setSelectedId] = useState(null);

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
  const [modalOpen, setModalOpen] = useState(false); // Modal full resolution image
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, type, onConfirm }
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
      // Prioritas 1: URL Query token
      if (urlToken) {
        const isValid = await verifyTokenWithBackend(urlToken, urlId);
        if (cancelled) return;
        if (isValid) {
          sessionStorage.setItem(STORAGE_KEY, urlToken);
          setAuthToken(urlToken);
          setAuthStatus("authenticated");
          if (urlId) {
            setSelectedId(Number(urlId) || urlId);
            setActiveView("detail");
          }
          return;
        }
      }

      // Prioritas 2: SessionStorage token
      const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const isValid = await verifyTokenWithBackend(stored);
        if (cancelled) return;
        if (isValid) {
          setAuthToken(stored);
          setAuthStatus("authenticated");
          if (urlId) {
            setSelectedId(Number(urlId) || urlId);
            setActiveView("detail");
          }
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
      setLoginError("Masukkan Kunci Akses / Token Petugas.");
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
      showToast("Berhasil Masuk", "Selamat bertugas di Pusat Kendali BaliCivic.");
      if (urlId) {
        setSelectedId(Number(urlId) || urlId);
        setActiveView("detail");
      }
    } else {
      setLoginError("Kunci Otoritas tidak valid. Periksa kembali token dari Administrator Dinas.");
    }
  }

  // 4. Handle Logout
  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthToken("");
    setAuthStatus("login");
    setSelectedId(null);
    setData(null);
    setActiveView("queue");
    router.replace("/admin");
    showToast("Telah Keluar", "Sesi administrasi Anda telah ditutup.");
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
      showToast("Koneksi Lemah", "Gagal menyinkronkan data antrean terbaru.", true);
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
      console.error("Gagal load detail laporan:", e);
      showToast("Gagal Memuat", "Laporan tidak ditemukan atau telah dihapus.", true);
      setActiveView("queue");
    } finally {
      setDataLoading(false);
    }
  }, []);

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
      showToast("Laporan Dihapus", `Laporan #${targetId} telah dihapus permanen dari server.`);
      if (selectedId === targetId) {
        setSelectedId(null);
        setActiveView("queue");
        router.replace("/admin");
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
    showToast("Membuat Dokumen...", "Menyusun Surat Perintah Kerja (SPK) PDF...");
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
          filename: `SPK_Dinas_BaliCivic_${data ? String(data.id).substring(0, 8) : "laporan"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(pdfRef.current)
        .save()
        .then(() => {
          setPdfVisible(false);
          showToast("Berhasil", "SPK PDF berhasil diunduh.");
        })
        .catch(() => {
          setPdfVisible(false);
          showToast("Gagal", "Terjadi kendala saat merender PDF.", true);
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
  // RENDER: LOADING STATE
  // =========================================================================
  if (authStatus === "checking") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4 animate-pulse">
          <i className="fas fa-shield-halved text-2xl text-primary"></i>
        </div>
        <p className="font-semibold text-sm text-slate-300">Memverifikasi Otoritas Dinas...</p>
        <span className="text-xs text-slate-500 mt-1">Sistem Keamanan Terpadu BaliCivic AI</span>
      </div>
    );
  }

  // =========================================================================
  // RENDER: LOGIN PORTAL
  // =========================================================================
  if (authStatus === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
        {/* Top Minimal Nav */}
        <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-2">
          <Link href="/" className="inline-flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors">
            <img src="/assets/BaliCivic_App_Icon_1_.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="font-bold text-sm tracking-tight">BaliCivic AI</span>
          </Link>
          <Link href="/" className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors">
            <i className="fas fa-arrow-left text-[10px]"></i>
            <span>Kembali ke Beranda Warga</span>
          </Link>
        </header>

        {/* Center Card */}
        <main className="max-w-md w-full mx-auto my-8">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-rose-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-primary/25 mb-4">
                <i className="fas fa-lock"></i>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-2">
                Portal Internal Aparatur
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Pusat Disposisi Dinas
              </h1>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xs">
                Akses verifikasi laporan kerusakan, pengerahan tim reaksi cepat, dan penerbitan Surat Perintah Kerja (SPK).
              </p>
            </div>

            {loginError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <i className="fas fa-triangle-exclamation text-rose-400 mt-0.5"></i>
                <div className="flex-1">{loginError}</div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Kunci Otoritas Petugas / Master Admin Token
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Masukkan token dinas..."
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors text-xs"
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 px-4 bg-primary hover:bg-primaryHover text-white rounded-xl font-bold text-sm shadow-md shadow-primary/25 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin"></i>
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-key text-xs"></i>
                    <span>Buka Pusat Komando</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800 text-[11px] text-slate-500 space-y-1.5 text-center">
              <p>
                <i className="fas fa-shield-alt text-emerald-400 mr-1"></i>
                Dilindungi otentikasi konstan-waktu & enkripsi TLS.
              </p>
              <p className="text-[10px] text-slate-600">
                Pemerintah Provinsi Bali · Dinas PUPR & DLHK
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 py-2">
          BaliCivic AI © 2026 — Smart Infrastructure Monitoring Platform
        </footer>
      </div>
    );
  }

  // =========================================================================
  // RENDER: AUTHENTICATED ADMIN WORKSPACE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[120] max-w-sm p-4 rounded-2xl shadow-xl flex items-start gap-3 border transition-all animate-bounce-slow ${
          toast.isError ? "bg-rose-50 text-rose-900 border-rose-200" : "bg-white text-slate-900 border-slate-200"
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            toast.isError ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
          }`}>
            <i className={`fas ${toast.isError ? "fa-circle-exclamation" : "fa-check"}`}></i>
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-xs">{toast.title}</h4>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                <i className="fas fa-triangle-exclamation"></i>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500">Konfirmasi tindakan dinas</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
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
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                  confirmModal.type === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-primary hover:bg-primaryHover"
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Res Image Viewer Modal */}
      {modalOpen && data?.image_url && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setModalOpen(false)}
        >
          <div className="relative max-w-6xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={imgUrl(data.image_url)}
              alt="Bukti Lengkap"
              className="max-h-[82vh] w-auto object-contain rounded-xl shadow-2xl border border-white/10"
            />
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-slate-300 font-mono">
                {formatCategory(data.issue_class)} · Skor {data.final_score}/100
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP COMMAND BAR */}
      <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-primary/30">
              <i className="fas fa-shield-halved text-sm"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">BaliCivic AI</span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                  PUSAT KOMANDO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                Portal Pelayanan & Pengawasan Infrastruktur Dinas PUPR Bali
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              target="_blank"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors hidden md:flex items-center gap-1.5"
            >
              <i className="fas fa-arrow-up-right-from-square text-[10px]"></i>
              <span>Portal Publik</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 active:scale-95"
              title="Keluar dari sesi admin"
            >
              <i className="fas fa-right-from-bracket text-[10px]"></i>
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* SUB-HEADER / VIEW TABS */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveView("queue");
                setSelectedId(null);
                router.replace("/admin");
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all ${
                activeView === "queue"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <i className="fas fa-list-check text-xs"></i>
              <span>Antrean Disposisi</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary text-white font-mono">
                {issues.length}
              </span>
            </button>

            {selectedId && (
              <>
                <i className="fas fa-chevron-right text-slate-300 text-[10px] mx-1"></i>
                <button
                  type="button"
                  onClick={() => setActiveView("detail")}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeView === "detail"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <i className="fas fa-file-invoice text-xs"></i>
                  <span>Lembar Disposisi #{selectedId}</span>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={fetchQueueData}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Segarkan data antrean"
          >
            <i className={`fas fa-rotate text-xs ${issuesLoading ? "fa-spin" : ""}`}></i>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: QUEUE & DISPOSITION TABLE */}
      {/* =================================================================== */}
      {activeView === "queue" && (
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* STATS STRIP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Masuk</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{stats.total || issues.length}</div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Laporan warga Bali</span>
            </div>

            <div className="bg-white rounded-2xl border border-red-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-red-50/30">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Menunggu Verifikasi</span>
              <div className="text-2xl sm:text-3xl font-black text-red-700 mt-1">{stats.antrean || 0}</div>
              <span className="text-[11px] text-red-600/80 mt-0.5 block">Butuh atensi dinas</span>
            </div>

            <div className="bg-white rounded-2xl border border-amber-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-amber-50/30">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Sedang Ditangani</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">{stats.perlu_tindakan || 0}</div>
              <span className="text-[11px] text-amber-700/80 mt-0.5 block">Tim PUPR di Lapangan</span>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Selesai Diperbaiki</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">{stats.selesai || 0}</div>
              <span className="text-[11px] text-emerald-700/80 mt-0.5 block">Arsip Berita Acara</span>
            </div>
          </div>

          {/* FILTER CONTROLS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold overflow-x-auto max-w-full">
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
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                      statusFilter === tab.id
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kecamatan, kabupaten, ID..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs border-t border-slate-100">
              <span className="text-slate-400 font-medium text-[11px] mr-1">Kategori:</span>
              {[
                { id: "ALL", label: "Semua" },
                { id: "jalan_bolong", label: "Jalan Bolong" },
                { id: "sampah_liar", label: "Sampah Liar" },
                { id: "genangan_air", label: "Genangan Air" },
                { id: "kabel_semrawut", label: "Kabel Bahaya" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    categoryFilter === c.id
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <i className="fas fa-inbox text-primary"></i>
                <span>Daftar Laporan Antrean Disposisi</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">
                Menampilkan {filteredIssues.length} laporan
              </span>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                  <i className="fas fa-folder-open"></i>
                </div>
                <h4 className="font-bold text-slate-700 text-sm">Tidak ada laporan yang cocok</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Silakan sesuaikan filter status, kategori, atau kata kunci pencarian.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                      <th className="px-4 py-3.5 font-semibold">Bukti & Skor</th>
                      <th className="px-4 py-3.5 font-semibold">Kategori Kerusakan</th>
                      <th className="px-4 py-3.5 font-semibold">Wilayah Geospasial</th>
                      <th className="px-4 py-3.5 font-semibold">Status Dinas</th>
                      <th className="px-4 py-3.5 font-semibold">Waktu WITA</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Tindakan Petugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredIssues.map((item) => {
                      const score = item.final_score ?? 0;
                      const isCritical = score >= 60;
                      const badgeClass = getScoreBadgeClass(score);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Bukti & Skor */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-12 rounded-lg bg-slate-900 overflow-hidden relative shrink-0 border border-slate-200">
                                {item.image_url ? (
                                  <img
                                    src={imgUrl(item.image_url)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                                    <i className="fas fa-image"></i>
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${badgeClass}`}>
                                  {score}/100
                                </span>
                                {isCritical && (
                                  <span className="block mt-1 text-[9px] font-bold text-rose-600 uppercase tracking-wide">
                                    KRITIS
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Kategori Kerusakan */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-xs capitalize">
                              {formatCategory(item.issue_class)}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{item.id}
                            </span>
                          </td>

                          {/* Wilayah Geospasial */}
                          <td className="px-4 py-3 text-slate-600">
                            <div className="font-semibold text-slate-800">
                              {[item.kecamatan, item.kabupaten].filter(Boolean).join(", ") || "Provinsi Bali"}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                              <i className="fas fa-map-pin text-primary text-[9px]"></i>
                              <span>
                                {item.latitude != null && item.longitude != null
                                  ? `${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`
                                  : "Koordinat belum diset"}
                              </span>
                            </div>
                          </td>

                          {/* Status Dinas */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              item.status === "DONE"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : item.status === "IN_PROGRESS"
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                item.status === "DONE" ? "bg-emerald-500" : item.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-red-500"
                              }`}></span>
                              <span>{item.status === "DONE" ? "Selesai" : item.status === "IN_PROGRESS" ? "Diproses" : "Antrean"}</span>
                            </span>
                          </td>

                          {/* Waktu WITA */}
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>

                          {/* Tindakan Petugas */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(item.id);
                                setActiveView("detail");
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all active:scale-95 shadow-xs"
                            >
                              <span>Buka Disposisi</span>
                              <i className="fas fa-arrow-right text-[10px]"></i>
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
      {/* VIEW 2: DETAIL LEMBAR DISPOSISI (#ID) */}
      {/* =================================================================== */}
      {activeView === "detail" && (
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Top Breadcrumb & Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveView("queue");
                router.replace("/admin");
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs hover:bg-slate-50 transition-all"
            >
              <i className="fas fa-arrow-left"></i>
              <span>Kembali ke Antrean Kerja</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadPDF}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs hover:bg-slate-50 transition-all shadow-2xs"
              >
                <i className="fas fa-file-pdf text-rose-600"></i>
                <span>Cetak SPK PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmModal({
                    title: "Hapus Laporan Secara Permanen",
                    message: `Laporan #${selectedId} beserta seluruh bukti foto dan hasil analisanya akan dihapus dari server. Tindakan ini hanya untuk laporan hoax/iseng. Lanjutkan?`,
                    type: "danger",
                    onConfirm: () => deleteIssue(selectedId),
                  });
                }}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all disabled:opacity-50"
              >
                <i className="fas fa-trash"></i>
                <span>Hapus Laporan</span>
              </button>
            </div>
          </div>

          {dataLoading || !data ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <i className="fas fa-circle-notch fa-spin text-3xl text-primary mb-3"></i>
              <p className="font-bold text-slate-700 text-sm">Memuat Berkas Laporan #{selectedId}...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Box Lembar Kerja */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full inline-block mb-2">
                      Lembar Kerja Lapangan Dinas
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black">
                      {formatCategory(data.issue_class)}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Lokasi: {[data.kecamatan, data.kabupaten].filter(Boolean).join(", ") || "Provinsi Bali"}
                    </p>
                  </div>

                  <div className="flex flex-col md:items-end">
                    <span className="text-3xl font-black font-mono text-white">#{data.id}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      WITA: {new Date(data.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid 2 Kolom: Kiri Bukti & Analisis AI, Kanan Disposisi & SPK */}
              <div className="grid lg:grid-cols-12 gap-6">
                {/* Kolom Kiri: Bukti Visual AI */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Foto Ambient Blur */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div
                      className="relative w-full h-[320px] sm:h-[380px] bg-slate-950 flex items-center justify-center p-2 cursor-zoom-in"
                      onClick={() => setModalOpen(true)}
                      title="Klik untuk membuka resolusi penuh"
                    >
                      {data.image_url && (
                        <img
                          src={imgUrl(data.image_url)}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover filter blur-2xl scale-125 opacity-25 pointer-events-none select-none"
                        />
                      )}
                      {data.image_url ? (
                        <img
                          src={imgUrl(data.image_url)}
                          alt="Bukti Laporan"
                          className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-md"
                        />
                      ) : (
                        <div className="text-slate-500 text-xs font-mono">Belum ada foto</div>
                      )}
                      <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-md text-white text-[11px] font-mono border border-white/20">
                        <i className="fas fa-crosshairs text-primary mr-1"></i>
                        <span>{data.issue_class}</span>
                      </div>
                      <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-md text-white text-[10px] font-medium border border-white/20 flex items-center gap-1.5">
                        <i className="fas fa-expand text-slate-300"></i>
                        <span>Klik untuk perbesar</span>
                      </div>
                    </div>
                  </div>

                  {/* Analisis Teknis AI & Rekayasa Lapangan */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <i className="fas fa-robot text-primary"></i>
                      <span>Hasil Analisis Rekayasa Vision AI & Geometri</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[11px]">Estimasi Lebar Kerusakan</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block font-mono">
                          {(() => {
                            const w = data.meta_data?.llm_result?.dinas?.estimated_width_m
                              ?? data.meta_data?.llm_result?.size_reasoning?.adjusted_width_m;
                            return w != null ? `~${Number(w).toFixed(2)} meter` : "—";
                          })()}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[11px]">Jarak Pengambilan Foto</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                          {data.meta_data?.geometry?.distance_m
                            ? `±${data.meta_data.geometry.distance_m} meter (${data.meta_data.geometry.distance_category || "Normal"})`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                      <span className="font-bold text-slate-700 block">Deskripsi Teknis:</span>
                      <p className="text-slate-600 leading-relaxed text-justify">
                        {data.description || "Tidak ada deskripsi rinci."}
                      </p>
                    </div>

                    {data.meta_data?.llm_result?.dinas?.risk_notes && (
                      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-1">
                        <span className="font-bold text-amber-900 flex items-center gap-1.5">
                          <i className="fas fa-triangle-exclamation text-amber-600"></i>
                          <span>Catatan Risiko Keselamatan (Risk Notes):</span>
                        </span>
                        <p className="text-amber-800 leading-relaxed">
                          {data.meta_data.llm_result.dinas.risk_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Status, Disposisi & SPK */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Card Skor Keparahan */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Tingkat Keparahan
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs border ${getScoreBadgeClass(data.final_score)}`}>
                        {data.severity_label || "LOW"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-slate-900 font-mono">{data.final_score ?? 0}</span>
                      <span className="text-xs text-slate-400 font-mono">/ 100</span>
                    </div>

                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          (data.final_score || 0) >= 75
                            ? "bg-rose-600"
                            : (data.final_score || 0) >= 45
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, data.final_score || 0))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Panel Disposisi Cepat */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <i className="fas fa-clipboard-check text-primary"></i>
                      <span>Tindakan & Disposisi Dinas</span>
                    </h3>

                    {/* Rekomendasi Tindakan AI */}
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                      <span className="font-bold text-emerald-950 block">Rekomendasi Penanganan Dinas:</span>
                      <p className="text-emerald-800 leading-relaxed">
                        {data.meta_data?.llm_result?.dinas?.recommended_action || "Lakukan inspeksi dan penanganan sesuai SOP teknis dinas terkait."}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2">
                      {data.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              title: "Verifikasi & Kerahkan Tim",
                              message: `Laporan #${data.id} akan diverifikasi dan dialihkan ke status IN_PROGRESS (Dikerjakan Tim Lapangan). Lanjutkan?`,
                              type: "primary",
                              onConfirm: () => updateStatus(data.id, "IN_PROGRESS"),
                            });
                          }}
                          disabled={actionBusy}
                          className="w-full py-3 px-4 bg-primary hover:bg-primaryHover text-white rounded-xl font-bold text-xs shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-check-circle"></i>
                          <span>Verifikasi & Disposisi ke Lapangan</span>
                        </button>
                      )}

                      {data.status === "IN_PROGRESS" && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              title: "Tandai Perbaikan Selesai",
                              message: `Laporan #${data.id} akan ditandai DONE (Selesai). Rekam jejak penanganan akan dicatat permanen di audit trail. Lanjutkan?`,
                              type: "primary",
                              onConfirm: () => updateStatus(data.id, "DONE"),
                            });
                          }}
                          disabled={actionBusy}
                          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-circle-check"></i>
                          <span>Tandai Perbaikan Selesai & Tutup Laporan</span>
                        </button>
                      )}

                      {data.status === "DONE" && (
                        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-center font-bold text-xs flex items-center justify-center gap-2">
                          <i className="fas fa-lock"></i>
                          <span>Laporan Selesai & Diarsipkan</span>
                        </div>
                      )}

                      <a
                        href={data.latitude && data.longitude ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-location-arrow text-primary"></i>
                        <span>Buka Koordinat di Google Maps</span>
                      </a>
                    </div>
                  </div>

                  {/* Audit Trail Timeline */}
                  {Array.isArray(data.timeline) && data.timeline.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                      <h4 className="font-bold text-xs text-slate-700 flex items-center gap-2">
                        <i className="fas fa-clock-rotate-left text-primary"></i>
                        <span>Audit Trail / Jejak Digital Penanganan</span>
                      </h4>
                      <ol className="relative border-l border-slate-200 ml-2 space-y-4 text-xs pt-1">
                        {data.timeline.map((ev, idx) => (
                          <li key={idx} className="ml-4">
                            <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-2xs"></span>
                            <p className="font-bold text-slate-900">{ev.message || ev.status}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {ev.timestamp} · {ev.actor || "Sistem"}
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
      {/* HIDDEN PRINT TEMPLATE: DRAFT SURAT PERINTAH KERJA (SPK) PDF */}
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
          <div style={{ borderBottom: "2.5px solid #0f172a", paddingBottom: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Pemerintah Provinsi Bali
              </div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#b91c1c" }}>
                Dinas Pekerjaan Umum, Penataan Ruang, Perumahan & Kawasan Permukiman
              </div>
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                Sistem Pemantauan Infrastruktur Sipil Presisi — BaliCivic AI
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#b91c1c", fontFamily: "monospace" }}>
                SPK #{String(data.id).padStart(5, "0")}
              </div>
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                Tgl: {new Date(data.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Judul Dokumen */}
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <h1 style={{ fontSize: "15px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
              Surat Perintah Tugas Lapangan (SPK)
            </h1>
            <p style={{ fontSize: "10px", color: "#64748b", margin: "2px 0 0" }}>
              Penanganan Kerusakan Fisik Fasilitas Publik Berdasarkan Deteksi Vision AI
            </p>
          </div>

          {/* Grid Foto & Spesifikasi */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px", marginBottom: "16px" }}>
            {/* Box Foto */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
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
              <div style={{ padding: "8px 12px", background: "#f1f5f9", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Objek:</strong> {formatCategory(data.issue_class)}</span>
                <span style={{ color: "#b91c1c", fontWeight: "700" }}>Skor AI: {data.final_score}/100</span>
              </div>
            </div>

            {/* Box Parameter */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#ffffff", fontSize: "10px" }}>
              <div style={{ fontWeight: "800", textTransform: "uppercase", fontSize: "9px", color: "#64748b", marginBottom: "8px" }}>
                Parameter Teknis Kerusakan
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ padding: "6px", background: "#f8fafc", borderRadius: "6px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Kabupaten/Kota</div>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>{data.kabupaten || "-"}</div>
                </div>
                <div style={{ padding: "6px", background: "#f8fafc", borderRadius: "6px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Kecamatan</div>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>{data.kecamatan || "-"}</div>
                </div>
                <div style={{ padding: "6px", background: "#f8fafc", borderRadius: "6px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Koordinat GPS</div>
                  <div style={{ fontWeight: "700", color: "#0f172a", fontFamily: "monospace" }}>
                    {data.latitude != null ? `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}` : "-"}
                  </div>
                </div>
                <div style={{ padding: "6px", background: "#f8fafc", borderRadius: "6px" }}>
                  <div style={{ color: "#64748b", fontSize: "8px" }}>Estimasi Lebar</div>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>
                    {data.meta_data?.llm_result?.dinas?.estimated_width_m
                      ? `~${Number(data.meta_data.llm_result.dinas.estimated_width_m).toFixed(2)} m`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rekomendasi & Instruksi Kerja */}
          <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", marginBottom: "16px", background: "#f8fafc" }}>
            <div style={{ fontWeight: "800", textTransform: "uppercase", fontSize: "9px", color: "#b91c1c", marginBottom: "4px" }}>
              Instruksi Penanganan Khusus Lapangan:
            </div>
            <p style={{ fontSize: "10px", lineHeight: "1.5", margin: 0, color: "#334155" }}>
              {data.meta_data?.llm_result?.dinas?.recommended_action || "Lakukan pengamanan area kerja, verifikasi dimensi kedalaman lubang, dan penambalan standar hotmix."}
            </p>
          </div>

          {/* Lembar Tanda Tangan Pejabat & Tim Lapangan */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginTop: "40px" }}>
            <div style={{ textAlign: "center", fontSize: "10px" }}>
              <div>Mengetahui,</div>
              <div style={{ fontWeight: "700", marginBottom: "50px" }}>Pejabat Pembuat Komitmen (PPK)</div>
              <div style={{ borderTop: "1px solid #94a3b8", display: "inline-block", minWidth: "160px", paddingTop: "4px", fontWeight: "700" }}>
                ( .................................................... )
              </div>
              <div style={{ fontSize: "8px", color: "#64748b" }}>NIP. .................................................</div>
            </div>

            <div style={{ textAlign: "center", fontSize: "10px" }}>
              <div>Denpasar, {new Date().toLocaleDateString("id-ID")}</div>
              <div style={{ fontWeight: "700", marginBottom: "50px" }}>Koordinator Tim Reaksi Cepat</div>
              <div style={{ borderTop: "1px solid #94a3b8", display: "inline-block", minWidth: "160px", paddingTop: "4px", fontWeight: "700" }}>
                ( .................................................... )
              </div>
              <div style={{ fontSize: "8px", color: "#64748b" }}>Petugas Pelaksana Lapangan</div>
            </div>
          </div>

          {/* Footer Dokumen */}
          <div style={{ position: "absolute", bottom: "12mm", left: "16mm", right: "16mm", borderTop: "1px solid #e2e8f0", paddingTop: "8px", textAlign: "center", fontSize: "8px", color: "#94a3b8" }}>
            Dokumen ini dicetak secara otomatis melalui Portal Terpadu BaliCivic AI untuk keperluan disposisi operasional Dinas PUPR Provinsi Bali.
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
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center mx-auto animate-pulse">
              <i className="fas fa-shield-halved text-xl"></i>
            </div>
            <p className="text-xs text-slate-400">Memuat Sistem Administrasi...</p>
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
