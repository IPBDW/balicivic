/** @type {import('next').NextConfig} */
const nextConfig = {
  // Izinkan akses dev server dari localhost maupun 127.0.0.1.
  // Tanpa ini, Next.js 16 memblokir chunk JS (halaman jadi tidak ter-hydrate).
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
