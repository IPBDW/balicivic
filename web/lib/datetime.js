// lib/datetime.js
// Format tanggal/jam terpusat untuk seluruh halaman.
//
// KENAPA HARUS timeZone EKSPLISIT:
// `toLocaleTimeString("id-ID")` memakai zona waktu MESIN yang menjalankan kode.
// Saat SSR itu server (biasanya UTC), saat hidrasi itu browser pengunjung
// (WITA/WIB/lain). Hasilnya teks berbeda antara HTML server dan render klien
// -> React melempar "Hydration failed" dan menandai halaman error.
//
// Semua laporan BaliCivic memakai WITA (UTC+8), jadi zona waktunya dikunci di
// sini. Server dan browser menghasilkan teks yang sama persis, dan pengunjung
// dari luar Indonesia tetap melihat jam WITA yang benar.

export const TZ_WITA = "Asia/Makassar";
export const LOCALE_ID = "id-ID";

/** "19.14" */
export function formatTimeWita(value) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString(LOCALE_ID, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_WITA,
  });
}

/** "19.14 WITA" */
export function formatTimeWitaLabel(value) {
  const t = formatTimeWita(value);
  return t === "-" ? t : `${t} WITA`;
}

/** "10 Nov 2026" */
export function formatDateWita(value, opts) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ_WITA,
    ...opts,
  };
  // Buang key yang sengaja di-null-kan supaya "tanpa tahun" benar-benar tanpa tahun.
  Object.keys(options).forEach((k) => options[k] === undefined && delete options[k]);
  return d.toLocaleDateString(LOCALE_ID, options);
}

/** "10 Nov" (tanpa tahun) */
export function formatDateShortWita(value) {
  return formatDateWita(value, { year: undefined });
}

/** "Selasa, 10 November 2026" */
export function formatDateLongWita(value) {
  return formatDateWita(value, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
