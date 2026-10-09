"use client";

import { API_BASE, imgUrl } from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; }
.animate-bounce-slow { animation: pulse-lock 2s infinite; }
@keyframes pulse-lock { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.modal-animate { animation: modalIn 0.2s ease-out; }
`;

// useSearchParams() wajib dibungkus <Suspense> agar bisa di-prerender Next.js.
function AdminContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const id = params.get("id");
  const pdfRef = useRef(null);

  const hasAccess = Boolean(token && id);
  const [stage, setStage] = useState(hasAccess ? "checking" : "locked"); // checking -> locked -> open
  const [errorMsg, setErrorMsg] = useState(hasAccess ? null : "Token tidak valid.");
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // {title, message, type, onConfirm}
  const [toast, setToast] = useState(null);
  const [pdfVisible, setPdfVisible] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    (async () => {
      // Verifikasi token ke server (token tidak disimpan/hardcoded di client).
      try {
        const res = await fetch(`${API_BASE}/api/admin/verify?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          setStage("locked");
          setErrorMsg("Token tidak valid.");
          return;
        }
        setStage("open");
        fetchIssueDetail(id);
      } catch (e) {
        if (cancelled) return;
        setStage("locked");
        setErrorMsg("Gagal memverifikasi token. Cek koneksi ke server.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function fetchIssueDetail(targetId) {
    try {
      const response = await fetch(`${API_BASE}/api/issues`);
      const allIssues = await response.json();
      const item = allIssues.find((x) => String(x.id) === String(targetId));
      if (!item) throw new Error("Data tidak ditemukan");
      setData(item);
    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal mengambil data.");
    }
  }

  function closeModal() {
    setModal(null);
  }

  function confirmModal() {
    const action = modal?.onConfirm;
    setModal(null);
    if (action) action();
  }

  function showToast(title, message) {
    setToast({ title, message });
    setTimeout(() => setToast(null), 3000);
  }

  async function updateStatus(newStatus) {
    if (!data) return;
    setActionBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/issues/${data.id}/status?status=${newStatus}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token || "" },
      });
      if (res.ok) {
        showToast("Berhasil!", "Status diperbarui.");
        fetchIssueDetail(data.id);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("Gagal", err.detail || "Error");
      }
    } catch (e) {
      showToast("Error", e.message);
    } finally {
      setActionBusy(false);
    }
  }

  function confirmUpdate(newStatus) {
    setModal({
      title: "Konfirmasi",
      message: "Ubah status laporan?",
      type: "confirm",
      onConfirm: () => updateStatus(newStatus),
    });
  }

  function downloadPDF() {
    showToast("Memproses...", "Membuat PDF...");
    setPdfVisible(true);
    setTimeout(() => {
      if (!pdfRef.current || typeof window.html2pdf === "undefined") {
        setPdfVisible(false);
        showToast("Gagal", "html2pdf belum siap.");
        return;
      }
      window.html2pdf()
        .set({
          margin: 0,
          filename: `BaliCivic_Report_${data ? String(data.id).substring(0, 8) : "report"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(pdfRef.current)
        .save()
        .then(() => setPdfVisible(false))
        .catch(() => setPdfVisible(false));
    }, 150);
  }

  // ===== Turunan render =====
  const dateStr = data?.created_at
    ? new Date(data.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "-";
  const score = data ? data.severity_score || data.final_score || 45 : 0;
  const issueClass = data ? String(data.issue_class || data.title || "-").replace(/_/g, " ") : "-";
  const currentLat = data?.latitude || data?.lat;
  const currentLon = data?.longitude || data?.long || data?.lon;
  const coords = currentLat != null ? `${Number(currentLat).toFixed(4)}, ${Number(currentLon).toFixed(4)}` : "-";
  let riskNotes = "-";
  let recommendedAction = "-";
  try {
    riskNotes = data?.meta_data?.llm_result?.dinas?.risk_notes || "-";
    recommendedAction = data?.meta_data?.llm_result?.dinas?.recommended_action || "-";
  } catch (e) {}
  let responseTime = "-";
  if (data?.created_at) {
    const diffHours = Math.floor((new Date() - new Date(data.created_at)) / (1000 * 60 * 60));
    responseTime = diffHours < 24 ? diffHours + " jam" : Math.floor(diffHours / 24) + " hari";
  }
  const riskLevel = score >= 70 ? "RISIKO TINGGI" : score >= 40 ? "RISIKO SEDANG" : "RISIKO RENDAH";
  const riskCls =
    score >= 70
      ? "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 mb-2"
      : score >= 40
        ? "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-600 mb-2"
        : "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 mb-2";
  const shortId = data ? String(data.id).substring(0, 8) : "...";
  const mapsHref = currentLat != null ? `https://www.google.com/maps?q=${currentLat},${currentLon}` : "#";
  const imgSrc = data?.image_url ? imgUrl(data.image_url) : "";

  const st = String(data?.status || "").toUpperCase();
  let actionButtons = null;
  if (st === "IN_PROGRESS" || st === "INPROGRESS") {
    actionButtons = (
      <button onClick={() => confirmUpdate("DONE")} disabled={actionBusy} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl">
        <i className="fas fa-check-circle mr-1"></i> Selesai
      </button>
    );
  } else if (st === "DONE" || st === "SELESAI") {
    actionButtons = (
      <div className="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-xl text-center">
        <i className="fas fa-lock mr-1"></i> Diarsipkan
      </div>
    );
  } else {
    actionButtons = (
      <button onClick={() => confirmUpdate("IN_PROGRESS")} disabled={actionBusy} className="w-full bg-primary text-white font-bold py-3 rounded-xl">
        <i className="fas fa-rocket mr-1"></i> Verifikasi
      </button>
    );
  }
  const statusBadgeText = st === "IN_PROGRESS" ? "PROSES" : st === "DONE" ? "SELESAI" : "MENUNGGU";
  const statusBadgeCls =
    st === "IN_PROGRESS"
      ? "px-2 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-600"
      : st === "DONE"
        ? "px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600"
        : "px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500";

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      {/*__JSX1__*/}
      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal}></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="modal-animate bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="pt-6 pb-2 flex justify-center">
                {modal.type === "confirm" ? (
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                    <i className="fas fa-question-circle text-3xl text-amber-500"></i>
                  </div>
                ) : modal.type === "success" ? (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <i className="fas fa-check-circle text-3xl text-emerald-500"></i>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <i className="fas fa-times-circle text-3xl text-red-500"></i>
                  </div>
                )}
              </div>
              <div className="px-6 pb-4 text-center">
                <h3 className="text-lg font-bold text-slate-800 mb-2">{modal.title}</h3>
                <p className="text-sm text-slate-500">{modal.message}</p>
              </div>
              <div className="flex border-t border-slate-200">
                {modal.type === "confirm" ? (
                  <>
                    <button onClick={closeModal} className="flex-1 py-4 text-slate-500 font-semibold">Batal</button>
                    <button onClick={confirmModal} className="flex-1 py-4 text-primary font-bold border-l">Ya</button>
                  </>
                ) : (
                  <button onClick={closeModal} className={`flex-1 py-4 font-bold ${modal.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                    {modal.type === "success" ? "OK" : "Tutup"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[110]">
          <div className="bg-white rounded-xl shadow-lg border p-4 flex items-center gap-3 max-w-md mx-auto">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <i className="fas fa-check text-emerald-500"></i>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">{toast.title}</p>
              <p className="text-xs text-slate-500">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
              <i className="fas fa-shield-halved text-xs"></i>
            </div>
            <span className="font-bold text-base">BaliCivic <span className="text-primary">AI</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={downloadPDF} className="px-3 py-2 bg-primary/10 text-primary rounded-xl font-semibold text-sm hover:bg-primary hover:text-white">
              <i className="fas fa-file-pdf mr-1"></i> PDF
            </button>
            <span className="text-xs font-mono font-bold text-primary hidden sm:block">#{shortId}</span>
          </div>
        </div>
      </header>

      {/* Lock Screen */}
      {stage !== "open" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white">
          <div className="text-center space-y-6 max-w-sm px-6">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto animate-bounce-slow">
              <i className="fas fa-lock text-3xl text-primary"></i>
            </div>
            <h1 className="text-xl font-bold">Akses Terenkripsi</h1>
            <p className="text-slate-500 text-sm">
              {stage === "checking" ? "Mohon tunggu verifikasi token." : errorMsg || "Token tidak valid."}
            </p>
            {stage === "checking" && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Token OK</span>
              </div>
            )}
          </div>
        </div>
      )}
      {/*__JSX2__*/}
      {/* Main Panel */}
      {stage === "open" && (
        <main className="flex-grow opacity-100 transition-opacity py-4 px-3 pb-6">
          <div className="mx-auto max-w-5xl">
            <nav className="flex mb-3 text-xs text-slate-500">
              <a href="/dashboard" className="hover:text-primary">Dashboard</a>
              <span className="mx-2">/</span>
              <span className="font-medium text-slate-800">Detail</span>
            </nav>

            <div className="bg-gradient-to-r from-primary to-red-600 rounded-xl p-4 mb-4 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-lg font-bold">Laporan Infrastruktur</h1>
                  <p className="text-white/80 text-xs">Kabupaten Gianyar</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black">#{shortId}</span>
                  <p className="text-white/80 text-xs">{dateStr}</p>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="relative aspect-video bg-slate-100">
                    {imgSrc && <img src={imgSrc} alt="Bukti" className="w-full h-full object-cover" />}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-white text-xs font-mono">YOLO11s</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                    <i className="fas fa-database text-primary mr-1"></i> Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="block text-xs text-slate-400">Klasifikasi</span>
                      <span className="font-bold text-slate-800 capitalize">{issueClass}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="block text-xs text-slate-400">Lokasi</span>
                      <span className="font-bold text-slate-800">{data?.kecamatan || "-"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="block text-xs text-slate-400">Kabupaten</span>
                      <span className="font-bold text-slate-800">{data?.kabupaten || "-"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="block text-xs text-slate-400">Tanggal</span>
                      <span className="font-bold text-slate-800">{dateStr}</span>
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-3 border-l-4 border-primary">
                    <h4 className="text-xs font-bold text-primary mb-1">Deskripsi AI</h4>
                    <p className="text-slate-700 text-sm">{data?.description || "Memuat..."}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                    <i className="fas fa-exclamation-triangle text-amber-500 mr-1"></i> Risk Note
                  </h3>
                  <div className={riskCls}>
                    <span>{riskLevel}</span>
                  </div>
                  <p className="text-sm text-slate-600">{data ? riskNotes : "Menganalisis..."}</p>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex justify-between items-center">
                    <span className="font-bold text-sm"><i className="fas fa-microchip text-primary mr-1"></i> Severity Score</span>
                    <span className="text-2xl font-black text-primary">{score}</span>
                  </div>
                  <div className="p-4">
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-1000 rounded-full" style={{ width: `${score}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Low</span><span>Critical</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800">
                      <i className="fas fa-tasks text-primary mr-1"></i> Tindakan
                    </h3>
                    <span className={`${statusBadgeCls} px-2 py-1 rounded-full text-xs font-bold`}>{statusBadgeText}</span>
                  </div>
                  <div className="flex flex-col gap-2 opacity-100">{actionButtons}</div>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                    <i className="fas fa-lightbulb text-emerald-500 mr-1"></i> Recommended Action
                  </h3>
                  <p className="text-sm text-slate-600">{data ? recommendedAction : "Memuat..."}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="bg-blue-50 rounded-lg p-3 border border-blue-100 hover:bg-blue-100 transition-colors block">
                    <i className="fab fa-google text-blue-500 mb-1"></i>
                    <p className="text-xs text-blue-600 font-medium">Google Maps</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{data ? coords : "-"}</p>
                  </a>
                  <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                    <i className="fas fa-clock text-cyan-500 mb-1"></i>
                    <p className="text-xs text-cyan-600">Response</p>
                    <p className="text-sm font-bold text-slate-800">{data ? responseTime : "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t text-center text-xs text-slate-400">
              <p>BaliCivic AI © 2025</p>
            </div>
          </div>
        </main>
      )}
      {/*__JSX2__*/}
      {/* PDF Template */}
      {pdfVisible && data && (
        <div
          ref={pdfRef}
          className="fixed -left-[9999px] top-0"
          style={{ width: "210mm", minHeight: "297mm", padding: "15mm", fontFamily: "Inter,sans-serif", background: "#fff", position: "relative", boxSizing: "border-box" }}
        >
          <div style={{ background: "linear-gradient(to right,#C94B4B,#dc2626)", borderRadius: 12, padding: 20, marginBottom: 20, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Laporan Infrastruktur</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Analisis AI BaliCivic - Kabupaten Gianyar</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>#{shortId}</div>
                <div style={{ fontSize: 10, opacity: 0.9 }}>{dateStr}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              {imgSrc && <img src={imgSrc} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />}
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Klasifikasi AI</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", textTransform: "capitalize" }}>{issueClass}</div>
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Metadata</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>Lokasi</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{data?.kecamatan || "-"}</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>Kabupaten</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{data?.kabupaten || "-"}</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>Tanggal</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{dateStr}</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>Koordinat</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{coords}</div>
                </div>
              </div>
              <div style={{ background: "linear-gradient(to right,#1e293b,#0f172a)", borderRadius: 10, padding: 14, color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>AI Severity Score</span>
                  <span style={{ fontSize: 28, fontWeight: 900, color: "#C94B4B" }}>{score}</span>
                </div>
                <div style={{ height: 8, background: "#475569", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "linear-gradient(to right,#34d399,#fbbf24,#ef4444)", width: `${score}%`, borderRadius: 4 }}></div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 20, borderLeft: "4px solid #C94B4B" }}>
            <div style={{ fontSize: 10, color: "#C94B4B", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Deskripsi AI</div>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, margin: 0 }}>{data?.description || "-"}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: "#92400e", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Risk Note</div>
              <div style={{ display: "inline-block", fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#fef3c7", color: "#d97706", marginBottom: 8 }}>{riskLevel}</div>
              <p style={{ fontSize: 11, color: "#78350f", lineHeight: 1.4, margin: 0 }}>{riskNotes}</p>
            </div>
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: "#065f46", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Recommended Action</div>
              <p style={{ fontSize: 11, color: "#064e3b", lineHeight: 1.4, margin: 0 }}>{recommendedAction}</p>
            </div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Status</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{data?.status || "PENDING"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Response Time</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{responseTime}</div>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: "15mm", left: "15mm", right: "15mm", paddingTop: 12, borderTop: "2px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#C94B4B" }}>BaliCivic AI</div>
            <div style={{ fontSize: 9, color: "#94a3b8" }}>Laporan digenerate otomatis oleh sistem AI - wwww.balicivicai.site</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bungkus dengan <Suspense> karena memakai useSearchParams().
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <i className="fas fa-lock text-2xl text-primary"></i>
            </div>
            <p className="text-slate-500 text-sm">Memuat…</p>
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}