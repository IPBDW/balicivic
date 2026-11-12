// lib/severity.js
// Standardisasi threshold keparahan & label yang selaras 100% dengan backend.
//
// Backend (utils.py: score_to_label):
//   score >= 75 -> HIGH
//   score >= 45 -> MEDIUM
//   score < 45  -> LOW

export const SEVERITY_HIGH_MIN = 75;
export const SEVERITY_MEDIUM_MIN = 45;

/** "HIGH" | "MEDIUM" | "LOW" */
export function getSeverityCode(score) {
  const s = Number(score) || 0;
  if (s >= SEVERITY_HIGH_MIN) return "HIGH";
  if (s >= SEVERITY_MEDIUM_MIN) return "MEDIUM";
  return "LOW";
}

/** "Bahaya Tinggi" | "Bahaya Sedang" | "Bahaya Rendah" */
export function getSeverityLabel(score) {
  const code = getSeverityCode(score);
  if (code === "HIGH") return "Bahaya Tinggi";
  if (code === "MEDIUM") return "Bahaya Sedang";
  return "Bahaya Rendah";
}

/** "RISIKO TINGGI" | "RISIKO SEDANG" | "RISIKO RENDAH" */
export function getRiskLevelLabel(score) {
  const code = getSeverityCode(score);
  if (code === "HIGH") return "RISIKO TINGGI";
  if (code === "MEDIUM") return "RISIKO SEDANG";
  return "RISIKO RENDAH";
}

/** Styling badge Tailwind yang konsisten di semua tabel & list */
export function getScoreBadgeClass(score) {
  const code = getSeverityCode(score);
  if (code === "HIGH") return "text-red-600 bg-red-50 border-red-100";
  if (code === "MEDIUM") return "text-amber-600 bg-amber-50 border-amber-100";
  return "text-emerald-600 bg-emerald-50 border-emerald-100";
}

/** Token warna detail (teks, gradient progress bar, shadow) */
export function getScoreColorTokens(score) {
  const code = getSeverityCode(score);
  if (code === "HIGH") {
    return {
      textColor: "text-red-600",
      gradient: "from-rose-500 to-red-600",
      shadow: "shadow-[0_0_20px_rgba(225,29,72,0.4)]",
      hex: "#ef4444",
      label: "Bahaya Tinggi",
    };
  }
  if (code === "MEDIUM") {
    return {
      textColor: "text-amber-600",
      gradient: "from-amber-400 to-orange-500",
      shadow: "shadow-[0_0_20px_rgba(245,158,11,0.4)]",
      hex: "#f59e0b",
      label: "Bahaya Sedang",
    };
  }
  return {
    textColor: "text-emerald-600",
    gradient: "from-emerald-400 to-teal-500",
    shadow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    hex: "#10b981",
    label: "Bahaya Rendah",
  };
}
