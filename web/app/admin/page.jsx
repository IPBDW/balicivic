"use client";

import { imgUrl, apiGet } from "@/lib/api";
import { getScoreBadgeClass } from "@/lib/severity";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

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
  // Tautan lama /admin?id=68 tetap didukung, dialihkan ke rute berkas laporan.
  const legacyId = searchParams.get("id");

  // Auth State
  const [authToken, setAuthToken] = useState("");
  const [authStatus, setAuthStatus] = useState("checking"); // "checking" | "login" | "authenticated"
  const [loginInput, setLoginInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Queue State
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, antrean: 0, perlu_tindakan: 0, selesai: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  function showToast(title, message, isError = false) {
    setToast({ title, message, isError });
    setTimeout(() => setToast(null), 3500);
  }

  // 1. Verifikasi Token ke Backend
  const verifyTokenWithBackend = useCallback(async (candidateToken) => {
    try {
      await apiGet(`/api/admin/verify?token=${encodeURIComponent(candidateToken)}`, {
        headers: { "X-Admin-Token": candidateToken },
      });
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
        const isValid = await verifyTokenWithBackend(urlToken);
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
        }
        sessionStorage.removeItem(STORAGE_KEY);
      }

      if (!cancelled) {
        setAuthStatus("login");
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [urlToken, verifyTokenWithBackend]);

  // 3. Tautan lama (?id=) dialihkan ke rute berkas laporan
  useEffect(() => {
    if (!legacyId) return;
    const qs = urlToken ? `?token=${encodeURIComponent(urlToken)}` : "";
    router.replace(`/admin/laporan/${legacyId}${qs}`);
  }, [legacyId, urlToken, router]);

  // 4. Handle Login Submit
  async function handleLogin(e) {
    e.preventDefault();
    if (!loginInput.trim()) {
      setLoginError("Masukkan token otorisasi admin dinas.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");

    const isValid = await verifyTokenWithBackend(loginInput.trim());
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

  // 5. Handle Logout
  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthToken("");
    setAuthStatus("login");
    router.replace("/admin");
    showToast("Keluar", "Sesi administrasi Anda telah ditutup.");
  }

  // 6. Fetch Summary Stats & Queue List
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
      // Fetch setelah auth siap: setState terjadi di dalam promise, bukan saat render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchQueueData();
    }
  }, [authStatus, fetchQueueData]);

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
  // VIEW: AUTHENTICATED WORKSPACE (QUEUE ONLY)
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
            <span className="px-3 py-1.5 rounded-lg font-semibold bg-slate-900 text-white">
              Antrean Laporan ({issues.length})
            </span>
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
                          <Link
                            href={`/admin/laporan/${item.id}`}
                            className="inline-block px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors"
                          >
                            Buka Lembar Kerja
                          </Link>
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
