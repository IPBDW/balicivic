import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "BaliCivic AI - Platform Pelaporan Lingkungan Cerdas",
  description:
    "Sistem pelaporan kerusakan infrastruktur berbasis AI untuk Bali. Deteksi jalan bolong, genangan, sampah liar, dan kabel semrawut dengan Vision AI.",
  icons: { icon: "/assets/BaliCivic_App_Icon_1_.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>
      <body className="bg-bgPage text-textDark selection:bg-primary/20 selection:text-primary">
        {children}
        {/* CDN script global (leaflet dipakai dashboard/peta/index) */}
        <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="afterInteractive" />
        <Script src="https://unpkg.com/leaflet.heat/dist/leaflet-heat.js" strategy="afterInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}