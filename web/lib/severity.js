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
  if (code === "HIGH") return "text-red-700 bg-red-50 border-red-200";
  if (code === "MEDIUM") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

/** Token warna detail (teks, gradient progress bar, shadow) */
export function getScoreColorTokens(score) {
  const code = getSeverityCode(score);
  if (code === "HIGH") {
    return {
      textColor: "text-red-700",
      gradient: "from-red-600 to-red-700",
      shadow: "shadow-[0_0_12px_rgba(185,28,28,0.25)]",
      hex: "#b91c1c",
      label: "Bahaya Tinggi",
    };
  }
  if (code === "MEDIUM") {
    return {
      textColor: "text-amber-700",
      gradient: "from-amber-500 to-amber-600",
      shadow: "shadow-[0_0_12px_rgba(217,119,6,0.25)]",
      hex: "#d97706",
      label: "Bahaya Sedang",
    };
  }
  return {
    textColor: "text-emerald-700",
    gradient: "from-emerald-500 to-emerald-600",
    shadow: "shadow-[0_0_12px_rgba(5,150,105,0.25)]",
    hex: "#059669",
    label: "Bahaya Rendah",
  };
}
