// Guard untuk Next.js dummy API routes (web/app/api/*).
//
// MASALAH YANG DICEGAH:
// Kalau `NEXT_PUBLIC_API_BASE` kosong saat deploy produksi, frontend akan
// diam-diam memakai dummy routes ini -> dashboard pemerintah menampilkan
// data FIKTIF seolah-olah asli, tanpa error apa pun. Itu berbahaya.
//
// Solusi: dummy routes menolak melayani request saat NODE_ENV=production,
// KECUALI sengaja di-opt-in lewat NEXT_PUBLIC_ALLOW_DUMMY=true (mis. untuk
// demo build produksi di laptop). Di dev (npm run dev) tetap jalan seperti biasa.

export const DUMMY_BLOCKED =
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_ALLOW_DUMMY !== 'true' &&
  process.env.NEXT_PUBLIC_ALLOW_DUMMY !== '1';

export function blockedResponse() {
  return Response.json(
    {
      detail:
        'Data contoh dinonaktifkan di produksi. Set NEXT_PUBLIC_API_BASE ke URL backend FastAPI, ' +
        'atau set NEXT_PUBLIC_ALLOW_DUMMY=true kalau memang mau memakai data dummy.',
      code: 'DUMMY_API_BLOCKED',
    },
    { status: 503 }
  );
}
