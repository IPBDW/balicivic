/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  // Izinkan akses dev server dari localhost maupun 127.0.0.1.
  // Tanpa ini, Next.js 16 memblokir chunk JS (halaman jadi tidak ter-hydrate).
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${backend}/static/:path*`,
      },
      {
        source: "/health",
        destination: `${backend}/health`,
      },
    ];
  },
};

export default nextConfig;
