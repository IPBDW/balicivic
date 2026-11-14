/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  // Izinkan akses dev server dari localhost, IP lokal, dan tunnel (Cloudflare, dll).
  // Tanpa ini, Next.js 16 memblokir chunk JS/CSS saat diakses dari HP / tunnel.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.10.10.45",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.loca.lt",
  ],
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
