"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { waitForLeaflet } from "@/lib/leaflet";

/* ===== CSS asli index.html (1:1) ===== */
const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; }
* { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
a, button, .card, .btn { transition: all 0.3s ease; }
.card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.08); }
button:hover, .btn:hover, a[class*="bg-"]:hover { transform: translateY(-1px); box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.08); }
button:active, .btn:active, a[class*="bg-"]:active { transform: translateY(0px); }
a:not([class*="bg-"]):hover { color: #C94B4B; }
i:hover, .icon:hover { transform: scale(1.05); transition: transform 0.2s ease; }
img:hover { transform: scale(1.05); transition: transform 0.5s ease; }
input:focus, textarea:focus, select:focus { box-shadow: 0 0 0 3px rgba(201, 75, 75, 0.1); transition: all 0.2s ease; }
.scroll-reveal { opacity: 0; transform: translateY(30px); transition: opacity 0.8s cubic-bezier(0.5, 0, 0, 1), transform 0.8s cubic-bezier(0.5, 0, 0, 1); }
.scroll-reveal.active { opacity: 1; transform: translateY(0); }
.stagger-1 { transition-delay: 0.1s; } .stagger-2 { transition-delay: 0.2s; } .stagger-3 { transition-delay: 0.3s; } .stagger-4 { transition-delay: 0.4s; }
.blob-bg { position: absolute; filter: blur(80px); z-index: -1; opacity: 0.4; transition: transform 0.1s ease-out; }
.bbox-sim { position: absolute; border: 2px solid; background-color: rgba(255, 255, 255, 0.1); }
.bbox-label { position: absolute; top: -22px; left: -2px; padding: 2px 6px; font-size: 0.65rem; font-weight: 600; color: white; border-radius: 4px 4px 0 0; }
.text-gradient-shimmer { background: linear-gradient(to right, #C94B4B 20%, #1B9C85 40%, #1B9C85 60%, #C94B4B 80%); background-size: 200% auto; color: transparent; -webkit-background-clip: text; background-clip: text; animation: shimmer 4s linear infinite; }
details > summary { list-style: none; }
details > summary::-webkit-details-marker { display: none; }
details[open] summary ~ * { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.faq-icon { transition: transform 0.3s ease; }
details[open] .faq-icon { transform: rotate(180deg); }
.shrink-0 { flex-shrink: 0; }
`;

const RANK_BADGES = [
  { label: "PRIORITAS", bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
  { label: "SEDANG", bg: "#fef3c7", text: "#d97706", border: "#fcd34d" },
  { label: "MONITOR", bg: "#d1fae5", text: "#059669", border: "#6ee7b7" },
];

function getSeverityColor(percent) {
  if (percent >= 50) return "#dc2626";
  if (percent >= 25) return "#f59e0b";
  return "#9ca3af";
}

function MarketingNavbar() {
  const [open, setOpen] = useState(false);
  const navLinks = [
    { href: "#problems", label: "Masalah" },
    { href: "#methodology", label: "Metodologi" },
    { href: "#gallery", label: "Hasil" },
    { href: "#video", label: "Video" },
    { href: "#dashboard-preview", label: "Dashboard" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-50 w-full h-16 border-b border-lightBorder bg-white/90 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="block" aria-label="BaliCivic AI - Beranda">
            <img
              src="/assets/BaliCivic_App_Icon_1_.png"
              onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/32?text=B")}
              alt="BaliCivic AI"
              className="h-9 w-9 rounded-lg object-cover shadow-lg shadow-primary/30"
              width="36"
              height="36"
              loading="lazy"
            />
          </Link>
          <span className="font-bold tracking-tight text-base sm:text-lg">BaliCivic AI</span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-textSecondary">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-primary transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex gap-3">
          <a href="#" className="text-sm font-medium text-textSecondary hover:text-textDark px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lightBorder rounded-lg">
            Dokumentasi
          </a>
          <Link
            href="/dashboard"
            className="rounded-lg bg-textDark px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-textDark transform hover:scale-105 active:scale-95"
          >
            Coba Sekarang
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2.5 text-textSecondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-300 group"
          aria-label="Menu"
        >
          <i className="fas fa-bars text-lg group-hover:scale-110 group-hover:rotate-90 transition-transform duration-300"></i>
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`${open ? "" : "hidden"} md:hidden bg-white border-t border-lightBorder shadow-lg`}>
        <nav className="flex flex-col py-2">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="relative overflow-hidden px-4 py-3 text-sm font-medium text-textSecondary hover:text-primary hover:bg-primary/5 hover:translate-x-2 transition-all duration-300 border-l-2 border-transparent hover:border-primary group"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>
              <span className="relative z-10">{l.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function FloatingHelp() {
  return (
    <a
      href="/bantuan"
      className="absolute bottom-6 right-6 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/40 flex items-center justify-center hover:bg-primaryHover hover:scale-110 transition-all active:scale-95 group"
      aria-label="Bantuan"
    >
      <i className="fas fa-question text-xl group-hover:rotate-12 transition-transform"></i>
    </a>
  );
}

export default function HomePage() {
  const [topLocs, setTopLocs] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [barWidths, setBarWidths] = useState({});
  const [lastUpdate, setLastUpdate] = useState("");
  const mapInitRef = useRef(false);

  async function fetchTopLocations() {
    try {
      const res = await fetch(`${API_BASE}/api/top-locations`);
      setTopLocs(await res.json());
    } catch (e) {
      console.error("Gagal load lokasi:", e);
    }
  }

  async function fetchDistribution() {
    try {
      const res = await fetch(`${API_BASE}/api/issues`);
      const issues = await res.json();
      const counts = { jalan_bolong: 0, sampah_liar: 0, genangan_air: 0, kabel_semrawut: 0 };
      issues.forEach((issue) => {
        if (counts[issue.issue_class] !== undefined) counts[issue.issue_class]++;
      });
      const total = issues.length || 1;
      const data = [
        { label: "Jalan Bolong", count: counts.jalan_bolong, percent: Math.round((counts.jalan_bolong / total) * 100) },
        { label: "Sampah Liar", count: counts.sampah_liar, percent: Math.round((counts.sampah_liar / total) * 100) },
        { label: "Genangan Air", count: counts.genangan_air, percent: Math.round((counts.genangan_air / total) * 100) },
        { label: "Kabel Berantakan", count: counts.kabel_semrawut, percent: Math.round((counts.kabel_semrawut / total) * 100) },
      ];
      data.sort((a, b) => b.percent - a.percent);
      setDistribution(data);
      setLastUpdate(new Date().toLocaleTimeString());
      // animasi bar bertahap
      const widths = {};
      data.forEach((item, index) => {
        setTimeout(() => {
          setBarWidths((prev) => ({ ...prev, [`bar-${index}`]: item.percent + "%" }));
        }, 100 + index * 100);
      });
    } catch (e) {
      console.error("Gagal load distribusi:", e);
    }
  }

  async function initLandingHeatmap() {
    const mapContainer = document.getElementById("mini-heatmap");
    if (!mapContainer || mapContainer.offsetWidth === 0) return;
    if (mapInitRef.current) return; // sudah di-init (hindari double-init)
    try {
      const L = await waitForLeaflet();
      if (mapInitRef.current) return;
      if (mapContainer._leaflet_id) return;
      mapInitRef.current = true;
      const map = L.map(mapContainer, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: true,
      }).setView([-8.4095, 115.1889], 9);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        subdomains: "abcd",
      }).addTo(map);
      setTimeout(() => map.invalidateSize(), 100);
      const res = await fetch(`${API_BASE}/api/issues`);
      const points = await res.json();
      const heatData = points
        .filter((p) => (p.latitude || p.lat) && (p.longitude || p.long || p.lon))
        .map((p) => {
          const score = p.final_score || p.severity_score || p.score || 0;
          return [p.latitude || p.lat, p.longitude || p.long || p.lon, Math.max(score / 100, 0.2)];
        });
      if (heatData.length > 0) {
        L.heatLayer(heatData, {
          radius: 20,
          blur: 15,
          maxZoom: 14,
          gradient: { 0.2: "blue", 0.4: "cyan", 0.6: "lime", 0.8: "yellow", 1.0: "red" },
        }).addTo(map);
      }
    } catch (e) {
      console.error("Landing heatmap error:", e);
    }
  }

  useEffect(() => {
    // Scroll reveal + counter
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("active")),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll(".scroll-reveal").forEach((el) => observer.observe(el));

    const counters = document.querySelectorAll(".counter-anim");
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = parseFloat(entry.target.getAttribute("data-target"));
        const isDecimal = entry.target.getAttribute("data-decimal") === "true";
        animateValue(entry.target, 0, target, 2000, isDecimal);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach((c) => counterObserver.observe(c));

    function animateValue(obj, start, end, duration, isDecimal) {
      let startTs = null;
      const step = (ts) => {
        if (!startTs) startTs = ts;
        const progress = Math.min((ts - startTs) / duration, 1);
        const value = progress * (end - start) + start;
        obj.innerHTML = isDecimal ? value.toFixed(2) : Math.floor(value);
        if (progress < 1) requestAnimationFrame(step);
        else obj.innerHTML = isDecimal ? end.toFixed(2) : end;
      };
      requestAnimationFrame(step);
    }

    // Parallax blobs
    const blob1 = document.getElementById("blob-1");
    const blob2 = document.getElementById("blob-2");
    const onMove = (e) => {
      const moveX = (e.pageX * -1) / 60;
      const moveY = (e.pageY * -1) / 60;
      if (blob1) blob1.style.transform = `translate(${moveX}px, ${moveY}px)`;
      if (blob2) blob2.style.transform = `translate(${moveX * 1.5}px, ${moveY * 1.5}px)`;
    };
    document.addEventListener("mousemove", onMove);

    // Live widgets
    // Fetch on mount: setState terjadi setelah await, bukan render berjenjang.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTopLocations();
    fetchDistribution();
    initLandingHeatmap();
    const interval = setInterval(() => {
      fetchTopLocations();
      fetchDistribution();
    }, 30000);

    return () => {
      observer.disconnect();
      counterObserver.disconnect();
      document.removeEventListener("mousemove", onMove);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="pb-24 md:pb-0 relative">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      {/* Skip Link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[100] bg-white text-primary border border-primary px-4 py-2 rounded-lg shadow-xl font-medium transition-all">
        Loncat ke konten utama
      </a>

      {/* Background Blobs */}
      <div id="blob-1" className="blob-bg bg-primary/20 w-96 h-96 top-0 left-0 rounded-full mix-blend-multiply animate-pulse"></div>
      <div id="blob-2" className="blob-bg bg-accentGreen/20 w-96 h-96 top-20 right-0 rounded-full mix-blend-multiply animate-pulse delay-1000"></div>

      <MarketingNavbar />

      <main id="main-content" role="main">
        {/* HERO */}
        <section id="hero-section" className="relative mx-auto max-w-6xl px-4 min-h-screen flex items-center overflow-hidden py-24">
          <div className="grid gap-12 lg:grid-cols-[1.2fr,1fr] items-center w-full">
            <div className="space-y-6 scroll-reveal z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-accentTeal/20 bg-accentTealSoft px-3 py-1 pr-4 cursor-default">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accentTeal opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accentTeal"></span>
                </span>
                <span className="text-xs font-semibold text-accentTeal tracking-wide">Riset Pilot: Gianyar, Bali</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-textDark md:text-5xl lg:text-6xl leading-[1.1]">
                Deteksi Masalah Lingkungan dengan <span className="text-gradient-shimmer">Vision AI</span>
              </h1>
              <p className="max-w-lg text-lg text-textSecondary leading-relaxed">
                Sistem pelaporan cerdas yang mengubah foto warga menjadi data geospasial terstruktur menggunakan{" "}
                <strong>YOLOv8</strong> dan <strong>LLM</strong>.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link href="/dashboard" className="relative overflow-hidden rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primaryHover transition-all hover:-translate-y-1">
                  <span className="relative z-10">Coba Deteksi Sekarang</span>
                </Link>
                <a href="#methodology" className="relative overflow-hidden rounded-xl border border-lightBorder bg-white px-6 py-3.5 text-sm font-medium text-textDark hover:bg-cardGrey transition-all hover:-translate-y-1">
                  <span className="relative z-10">Pelajari Metodologi</span>
                </a>
              </div>
              <div className="flex items-center gap-6 border-t border-lightBorder pt-6 text-sm text-textSecondary">
                <div className="group cursor-default">
                  <strong className="block text-xl text-textDark font-bold counter-anim group-hover:text-primary transition-colors" data-target="22.718">0</strong>
                  Dataset
                </div>
                <div className="h-8 w-px bg-lightBorder"></div>
                <div className="group cursor-default">
                  <strong className="block text-xl text-textDark font-bold counter-anim group-hover:text-accentGreen transition-colors" data-target="0.7543" data-decimal="true">0</strong>
                  mAP Score
                </div>
                <div className="h-8 w-px bg-lightBorder"></div>
                <div className="group cursor-default">
                  <strong className="block text-xl text-textDark font-bold counter-anim group-hover:text-accentTeal transition-colors" data-target="4">0</strong>
                  Kelas Deteksi
                </div>
              </div>
            </div>

            <div className="relative lg:h-[450px] w-full flex items-center justify-center scroll-reveal delay-100 z-10">
              <div className="relative w-full max-w-md bg-white rounded-2xl border border-lightBorder shadow-2xl overflow-hidden z-10 animate-float">
                <div className="bg-white border-b border-lightBorder px-4 py-3 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="text-[10px] font-mono text-textSecondary bg-cardGrey px-2 py-1 rounded">inference_engine.py</div>
                </div>
                <div className="p-4 space-y-4 bg-white/90 backdrop-blur-sm">
                  <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-lightBorder flex items-center justify-center group cursor-crosshair">
                    <img src="/assets/1240c19a_detected.jpg" alt="YOLO Detection Demo" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none"></div>
                  </div>
                  <div className="font-mono text-[10px] bg-slate-900 text-slate-300 p-3 rounded-lg space-y-1 shadow-inner">
                    <div className="flex gap-2"><i className="fas fa-chevron-right text-emerald-400 text-[10px]"></i> <span>Loading YOLOv11s weights...</span></div>
                    <div className="flex gap-2"><i className="fas fa-triangle-exclamation text-yellow-400 text-[10px]"></i> <span>Detected: &apos;genangan_air&apos;</span></div>
                    <div className="flex gap-2 border-t border-slate-700 pt-1 mt-1"><i className="fas fa-circle-info text-blue-400 text-[10px]"></i> <span>Generating summary with Gemini Flash...</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PARALLAX QUOTE */}
        <section className="relative py-32 bg-gray-900 text-white overflow-hidden">
          <div className="absolute inset-0 w-full h-full bg-fixed bg-center bg-cover" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=2038&auto=format&fit=crop')", filter: "brightness(0.6)" }}></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-primary/20 to-black/60 mix-blend-multiply"></div>
          <div className="relative mx-auto max-w-4xl px-4 text-center scroll-reveal z-10">
            <div className="inline-block mb-6 opacity-60 animate-float">
              <svg className="w-16 h-16 mx-auto text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21L14.017 18C14.017 16.896 14.353 15.974 15.025 15.234C15.697 14.494 16.726 14.124 18.113 14.124H19.676V12.115C19.676 11.599 19.631 11.18 19.541 10.859C19.451 10.538 19.254 10.155 18.951 9.709C18.648 9.263 18.189 8.82 17.574 8.379C16.959 7.938 16.125 7.5 15.07 7.064L16.047 4.78C18.215 5.618 19.82 6.753 20.861 8.185C21.902 9.617 22.423 11.672 22.423 14.35V21H14.017ZM5.005 21L5.005 18C5.005 16.896 5.341 15.974 6.013 15.234C6.685 14.494 7.714 14.124 9.101 14.124H10.664V12.115C10.664 11.599 10.619 11.18 10.529 10.859C10.439 10.538 10.242 10.155 9.939 9.709C9.636 9.263 9.177 8.82 8.562 8.379C7.947 7.938 7.113 7.5 6.058 7.064L7.035 4.78C9.203 5.618 10.808 6.753 11.849 8.185C12.89 9.617 13.411 11.672 13.411 14.35V21H5.005Z"></path>
              </svg>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-8 text-white tracking-tight drop-shadow-2xl">
              &quot;Bali yang Lebih Baik,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accentGreen via-white to-accentTeal">Bersama Kecerdasan Buatan&quot;</span>
            </h2>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12 max-w-3xl mx-auto shadow-2xl transform hover:scale-[1.02] transition-all duration-500">
              <p className="text-lg md:text-xl text-gray-100 leading-relaxed font-light italic tracking-wide">
                &quot;Teknologi bukan hadir untuk menggantikan tradisi, melainkan untuk melindunginya. Dengan BaliCivic AI, kita wujudkan pengawasan lingkungan yang transparan demi menjaga kelestarian dan harmoni Pulau Dewata.&quot;
              </p>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section id="problems" className="py-20 bg-white border-y border-lightBorder/50">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="scroll-reveal">
                <h2 className="text-3xl font-bold text-textDark mb-4">Kenapa Bali Perlu Sistem Ini?</h2>
                <p className="text-textSecondary mb-6 leading-relaxed">
                  Saat ini, ribuan laporan warga tentang infrastruktur dan lingkungan tercecer di media sosial tanpa penanganan yang terukur.
                </p>
                <div className="space-y-4">
                  {["Laporan Manual Tercecer: Pengaduan via WhatsApp/Instagram sulit dipetakan lokasinya secara akurat.", "Tanpa Prioritas Objektif: Sulit membedakan mana lubang kecil vs lubang berbahaya tanpa standar visual."].map((t, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl bg-red-50 border border-red-100 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-default">
                      <div className="text-primary text-xl font-bold"><i className="fas fa-xmark"></i></div>
                      <div className="text-sm text-textDark">
                        {t.split(":")[0]}: {t.split(":")[1]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-cardGrey to-white rounded-2xl border border-lightBorder p-6 md:p-10 scroll-reveal delay-100 shadow-lg transition-transform duration-500 hover:-translate-y-2 hover:shadow-2xl">
                <h3 className="font-bold text-textDark mb-4 text-lg">Solusi BaliCivic AI</h3>
                <ul className="space-y-4 text-sm">
                  {["Automasi pencatatan lokasi (Geo-tagging).", "Penilaian tingkat keparahan (Severity Scoring).", "Data siap olah untuk dinas terkait."].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <span className="w-6 h-6 rounded-full bg-accentGreen/20 text-accentGreen flex items-center justify-center font-bold text-xs group-hover:bg-accentGreen group-hover:text-white transition-colors"><i className="fas fa-check text-xs"></i></span>
                      <span className="group-hover:text-textDark transition-colors text-textSecondary">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* METHODOLOGY */}
        <section id="methodology" className="py-20 bg-bgPage">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 md:text-center max-w-2xl mx-auto scroll-reveal">
              <h2 className="text-3xl font-bold text-textDark mb-4">Metodologi & Teknologi</h2>
              <p className="text-textSecondary">Pipeline Machine Learning yang dikembangkan khusus untuk konteks infrastruktur tropis Bali.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3 mb-12">
              {[
                { num: 1, color: "bg-primary/10 text-primary group-hover:bg-primary", title: "Dataset Lokal", desc: "±22.718 citra gabungan dari foto lapangan mandiri dan dataset publik yang dianotasi ulang via Roboflow." },
                { num: 2, color: "bg-accentTeal/10 text-accentTeal group-hover:bg-accentTeal", title: "Fine-Tuning YOLOv8", desc: "Model Nano dilatih untuk efisiensi edge device, mencapai mAP@50 ~0.7543 pada pengujian data validasi." },
                { num: 3, color: "bg-purple-100 text-purple-600 group-hover:bg-purple-600", title: "Integrasi LLM", desc: "Gemini 2.5 Flash digunakan untuk merangkum deteksi teknis menjadi laporan naratif yang human-readable." },
              ].map((c, i) => (
                <div key={i} className={`group p-6 rounded-2xl bg-white border border-lightBorder card-hover scroll-reveal stagger-${i + 1} transition-all duration-300 hover:shadow-lg hover:-translate-y-2 cursor-default`}>
                  <div className={`w-12 h-12 rounded-xl ${c.color} flex items-center justify-center mb-4 font-bold text-lg group-hover:scale-110 group-hover:text-white transition-all duration-300`}>{c.num}</div>
                  <h3 className={`font-semibold text-textDark mb-2 text-lg ${i === 1 ? "group-hover:text-accentTeal transition-colors" : i === 2 ? "group-hover:text-purple-600 transition-colors" : "group-hover:text-primary transition-colors"}`}>{c.title}</h3>
                  <p className="text-sm text-textSecondary leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
            <div className="py-8 border-t border-lightBorder/50 scroll-reveal">
              <p className="text-center text-xs font-semibold text-textSecondary uppercase tracking-widest mb-6">Tech Stack</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 cursor-default">
                {[
                  { src: "https://upload.wikimedia.org/wikipedia/commons/1/10/PyTorch_logo_icon.svg", name: "PyTorch", h: "h-8" },
                  { src: "https://cdn.prod.website-files.com/680a070c3b99253410dd3dcf/68e4eb5ed38d35e8270d5b55_Ultralytics%20Icon.svg", name: "YOLOv8", h: "h-8" },
                  { src: "https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light/aistudio.png", name: "Google AI Studio", h: "h-6" },
                  { src: "https://iconlogovector.com/uploads/images/2024/11/lg-6728a31f548b4-Leaflet.webp", name: "Leaflet", h: "h-8" },
                  { src: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg", name: "Tailwind", h: "h-5" },
                ].map((t) => (
                  <div key={t.name} className="flex items-center gap-2 font-bold text-slate-700 group/tech">
                    <img src={t.src} alt={t.name} className={`${t.h} w-auto group-hover/tech:scale-110 transition-transform`} />
                    <span>{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* DATASET */}
        <section id="dataset" className="py-16 bg-white border-y border-lightBorder/60">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-textDark mb-6 scroll-reveal">Dataset Penelitian</h2>
            <p className="text-textSecondary text-sm mb-8 leading-relaxed scroll-reveal stagger-1">
              Dataset yang digunakan dalam penelitian ini terdiri dari gabungan <strong>±1.000 foto lapangan</strong> dari wilayah Gianyar, Denpasar, Badung, serta dataset publik berlisensi bebas yang telah kami anotasi ulang. Seluruh citra difokuskan pada infrastruktur jalan dan lingkungan publik (tanpa menampilkan data sensitif).
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { t: "Lokal", d: "± 1.000 foto hasil dokumentasi lapangan di Gianyar, Denpasar, dan Badung." },
                { t: "Publik", d: "± 21.718 foto dari dataset open-source (CC0/Creative Commons) untuk memperluas variasi." },
                { t: "Anotasi", d: "Seluruh gambar dianotasi ulang dengan Roboflow untuk 4 kelas deteksi: jalan bolong, sampah liar, genangan, dan kabel berantakan." },
              ].map((c, i) => (
                <div key={i} className={`rounded-xl border border-lightBorder bg-bgPage p-5 shadow-sm scroll-reveal stagger-${i + 1}`}>
                  <h3 className="text-sm font-semibold text-textDark mb-1">{c.t}</h3>
                  <p className="text-xs text-textSecondary">{c.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-textSecondary italic scroll-reveal stagger-4">
              Catatan Etika Dataset: Seluruh foto yang digunakan dalam pelatihan model telah melalui proses <i>filtering</i> untuk menghapus wajah manusia dan plat nomor kendaraan. Beberapa dataset tidak dibuka untuk publik demi menjaga privasi lokasi dan identitas, namun seluruh proses anotasi dan sumber data dijelaskan secara transparan.
            </p>
          </div>
        </section>

        {/* METRICS */}
        <section id="metrics" className="py-20 bg-white border-y border-lightBorder/60">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4 scroll-reveal">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-textDark">Performa Model</h2>
                <p className="text-textSecondary mt-2 text-sm md:text-base">Ringkasan metrik utama setelah training pada dataset gabungan lokal + publik.</p>
              </div>
              <div className="text-xs text-textSecondary bg-cardGrey px-3 py-2 rounded-lg border border-lightBorder">
                <span className="font-semibold text-textDark">Konfigurasi:</span> YOLOv8n · 100 epoch · split 80/20 (train/val)
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4 mb-8 scroll-reveal stagger-1">
              {[["mAP@50", "0.7543"], ["Precision", "0.979"], ["Recall", "0.738"], ["Latency", "~14 ms"]].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-lightBorder bg-bgPage p-4 shadow-sm">
                  <div className="text-xs font-medium text-textSecondary mb-1">{k}</div>
                  <div className="text-2xl font-bold text-textDark">{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-lightBorder bg-white p-4 md:p-6 shadow-sm scroll-reveal stagger-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-textDark">Performa per Kelas</h3>
                <span className="text-[11px] text-textSecondary bg-cardGrey px-2 py-0.5 rounded-full">Val set (20% data)</span>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] text-textSecondary border-b border-lightBorder">
                      <th className="py-2 pr-4">Kelas</th><th className="py-2 pr-4">mAP@50</th><th className="py-2 pr-4">Precision</th><th className="py-2 pr-4">Recall</th><th className="py-2">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {[
                      ["jalan_bolong", "0.99", "0.98", "0.99", "Perform terbaik."],
                      ["sampah_liar", "0.75", "0.80", "0.99", "Miss pada sampah kecil."],
                      ["genangan", "0.61", "0.65", "0.63", "Sensitif pantulan."],
                      ["kabel_semrawut", "0.35", "0.36", "0.34", "Butuh dataset lokal+."],
                    ].map((r) => (
                      <tr key={r[0]} className="border-b border-lightBorder/60">
                        <td className="py-2 pr-4 font-medium text-textDark">{r[0]}</td>
                        <td className="py-2 pr-4">{r[1]}</td>
                        <td className="py-2 pr-4">{r[2]}</td>
                        <td className="py-2 pr-4">{r[3]}</td>
                        <td className="py-2 text-[11px] text-textSecondary">{r[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl border border-lightBorder bg-white/90 backdrop-blur-sm p-5 shadow-sm scroll-reveal stagger-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">i</span>
                <span className="text-[15px] font-semibold text-textDark">Cara membaca performa model</span>
              </div>
              <p className="text-xs text-textSecondary leading-relaxed">
                Secara sederhana, angka-angka pada tabel di atas berarti bahwa dari setiap 100 foto yang diuji, sistem mampu mengenali sekitar <strong>75–82 kasus dengan benar</strong> tergantung jenis masalahnya. Untuk tingkat sekarang dengan kondisi lapangan yang beragam, akurasi ini sudah cukup stabil untuk membantu pemetaan masalah dan menentukan prioritas penanganan oleh dinas terkait.
              </p>
            </div>
          </div>
        </section>

        {/* CLASSES */}
        <section id="classes" className="py-20 bg-white border-y border-lightBorder">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 flex justify-between items-end scroll-reveal">
              <h2 className="text-2xl md:text-3xl font-bold text-textDark">Kelas Deteksi Utama</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-4">
              {[
                { icon: "fa-triangle-exclamation", badge: "KESELAMATAN", bc: "bg-amber-100 text-amber-600", bb: "text-amber-600 bg-amber-50 border-amber-100", title: "Jalan Bolong", desc: "Deteksi lubang (potholes)." },
                { icon: "fa-trash-can", badge: "KEBERSIHAN", bc: "bg-red-100 text-red-600", bb: "text-red-600 bg-red-50 border-red-100", title: "Sampah Liar", desc: "Deteksi tumpukan sampah liar." },
                { icon: "fa-droplet", badge: "BANJIR", bc: "bg-blue-100 text-blue-600", bb: "text-blue-600 bg-blue-50 border-blue-100", title: "Genangan Air", desc: "Indikasi drainase buruk." },
                { icon: "fa-bolt", badge: "INFRA", bc: "bg-slate-200 text-slate-600", bb: "text-slate-600 bg-slate-100 border-slate-200", title: "Kabel Berantakan", desc: "Utilitas udara yang tak terurus." },
              ].map((c, i) => (
                <div key={i} className={`group rounded-2xl border border-lightBorder bg-bgPage p-5 card-hover scroll-reveal stagger-${i + 1} transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:bg-white cursor-default`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-10 h-10 rounded-full ${c.bc} flex items-center justify-center text-lg group-hover:scale-110 transition-transform`}>
                      <i className={`fas ${c.icon}`}></i>
                    </div>
                    <span className={`text-[10px] font-bold ${c.bb} px-2 py-1 rounded border`}>{c.badge}</span>
                  </div>
                  <h3 className="font-semibold text-textDark">{c.title}</h3>
                  <p className="text-xs text-textSecondary mt-2 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GALLERY */}
        <section id="gallery" className="py-20 bg-bgPage overflow-hidden">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 scroll-reveal">
              <h2 className="text-2xl md:text-3xl font-bold text-textDark">Hasil Deteksi Lapangan</h2>
              <p className="text-textSecondary mt-2">Visualisasi output model (Bounding Box & Confidence Score).</p>
            </div>
            <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
              {[
                { label: "[Image: Jalan Aspal]", box: "border-severityMed", style: { top: "40%", left: "30%", width: "30%", height: "20%" }, bbox: "bg-severityMed", tag: "jalan_bolong 0.88", loc: "Ubud, Gianyar", sev: "MEDIUM", sevCls: "bg-amber-100 text-amber-700 border-amber-200" },
                { label: "[Image: Sampah]", box: "border-severityHigh", style: { top: "25%", left: "45%", width: "40%", height: "50%" }, bbox: "bg-severityHigh", tag: "sampah_liar 0.92", loc: "Denpasar", sev: "HIGH", sevCls: "bg-red-100 text-red-700 border-red-200" },
                { label: "[Image: Genangan]", box: "border-accentTeal", style: { top: "55%", left: "10%", width: "80%", height: "30%" }, bbox: "bg-accentTeal", tag: "genangan 0.81", loc: "Kuta, Badung", sev: "LOW", sevCls: "bg-teal-100 text-teal-700 border-teal-200" },
              ].map((g, i) => (
                <div key={i} className="flex-shrink-0 w-[85vw] md:w-[calc(33.333%-1rem)] snap-center group relative aspect-square rounded-2xl bg-white border border-lightBorder overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                  <div className="absolute inset-0 bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-medium">{g.label}</div>
                  <div className={`bbox-sim ${g.box}`} style={g.style}>
                    <div className={`bbox-label ${g.bbox}`}>{g.tag}</div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-lightBorder flex flex-col gap-2 items-start">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-semibold text-textDark">{g.loc}</span>
                      <span className={`px-2 py-0.5 rounded-full ${g.sevCls} text-[10px] font-bold border`}>{g.sev}</span>
                    </div>
                    <Link href="/dashboard" className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary hover:text-white transition-colors">
                      <span>Lihat Dashboard</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VIDEO */}
        <section id="video" className="py-24 bg-gray-900 text-white text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50"></div>
          <div className="mx-auto max-w-5xl px-4 relative z-10 scroll-reveal">
            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/5 border border-white/10 text-xs font-medium tracking-wide mb-6 text-gray-300 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              LIVE DEMO
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">Lihat Sistem Bekerja</h2>
            <p className="text-gray-400 mb-12 max-w-xl mx-auto text-lg leading-relaxed font-light">
              Saksikan bagaimana AI memproses laporan warga secara <i>real-time</i>, mulai dari upload foto hingga analisis di dashboard pemerintah.
            </p>
            <div className="relative rounded-2xl bg-gray-800/40 border border-white/10 p-3 shadow-2xl backdrop-blur-md ring-1 ring-white/5">
              <div className="hidden md:flex items-center px-4 pb-3 pt-1 border-b border-white/5 mb-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/20 border border-white/5 text-[10px] font-mono text-gray-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                    balicivic-platform-demo.mp4
                  </div>
                </div>
              </div>
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-inner border border-white/5 group">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                    <i className="fas fa-play text-white text-xl ml-1"></i>
                  </div>
                  <p className="text-sm text-white/70 font-medium">Video demo sedang disiapkan</p>
                  <p className="text-[11px] text-white/40">balicivic-platform-demo.mp4</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DASHBOARD PREVIEW */}
        <section id="dashboard-preview" className="py-20 bg-white border-y border-lightBorder">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 scroll-reveal">
              <h2 className="text-3xl font-bold text-textDark">Dashboard & Heatmap</h2>
              <p className="text-textSecondary mt-2">Contoh tampilan agregasi laporan di level kecamatan untuk membantu pengambilan keputusan.</p>
            </div>
            <div className="grid lg:grid-cols-[1.5fr,1fr] gap-8 items-start">
              <div className="bg-white rounded-2xl border border-lightBorder p-6 shadow-sm scroll-reveal">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-textDark">Peta Heatmap Masalah</h3>
                    <p className="text-xs text-textSecondary">Sebaran real-time jalan rusak, sampah, genangan & kabel.</p>
                  </div>
                  <Link href="/peta" className="text-[10px] font-bold text-primary hover:text-primaryHover flex items-center gap-1 transition-colors">
                    Buka Peta Penuh <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>
                <div className="relative aspect-video bg-slate-100 rounded-xl border border-dashed border-slate-200 overflow-hidden flex items-center justify-center group-hover:border-primary/20 transition-colors">
                  <div id="mini-heatmap" className="absolute inset-0 z-10 hidden lg:block rounded-xl"></div>
                  <div className="absolute inset-0 z-0 lg:hidden flex items-center justify-center bg-slate-200/50 backdrop-blur-md">
                    <Link href="/peta" className="px-6 py-3 bg-white text-slate-800 font-bold rounded-xl shadow-lg border border-white/50 hover:scale-105 transition-transform flex items-center gap-2">
                      <i className="fas fa-map-marked-alt text-primary"></i> Buka Heatmap
                    </Link>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 justify-center">
                  <div className="flex items-center gap-2 text-[10px] text-textSecondary"><span className="w-2 h-2 rounded-full bg-red-500"></span> Jalan bolong</div>
                  <div className="flex items-center gap-2 text-[10px] text-textSecondary"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Sampah liar</div>
                  <div className="flex items-center gap-2 text-[10px] text-textSecondary"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Genangan</div>
                  <div className="flex items-center gap-2 text-[10px] text-textSecondary"><span className="w-2 h-2 rounded-full bg-slate-600"></span> Kabel berantakan</div>
                </div>
              </div>

              <div className="space-y-6 scroll-reveal delay-100">
                <div className="bg-white rounded-2xl border border-lightBorder p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-textDark text-sm">Top 3 Kecamatan (jumlah laporan)</h3>
                    <span className="text-[10px] font-medium text-textSecondary bg-gray-100 px-2 py-1 rounded-full border border-gray-200">Sampel uji</span>
                  </div>
                  <div id="top-locations-container" className="space-y-3">
                    {topLocs === null && (
                      <div className="animate-pulse space-y-3">
                        <div className="h-14 bg-gray-50 rounded-xl border border-gray-100"></div>
                        <div className="h-14 bg-gray-50 rounded-xl border border-gray-100"></div>
                        <div className="h-14 bg-gray-50 rounded-xl border border-gray-100"></div>
                      </div>
                    )}
                    {topLocs !== null && topLocs.length === 0 && <p className="text-center text-gray-400 py-4">Belum ada data lokasi.</p>}
                    {topLocs !== null &&
                      topLocs.map((item, index) => {
                        const style = RANK_BADGES[index] || RANK_BADGES[2];
                        return (
                          <div key={index} className="hover:-translate-y-1 hover:shadow-md" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 15, border: "1px solid #e5e7eb", borderRadius: 12, backgroundColor: "#fff", transition: "transform 0.2s" }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: "1rem", color: "#1f2937", fontWeight: 600 }}>{item.kabupaten}</h4>
                              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Total: <strong>{item.total}</strong> Laporan</span>
                            </div>
                            <div style={{ backgroundColor: style.bg, color: style.text, padding: "6px 12px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700, border: `1px solid ${style.border}`, letterSpacing: "0.5px" }}>
                              {style.label}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-lightBorder p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-textDark text-sm">Distribusi Jenis Masalah</h3>
                    <span id="last-update" className="text-[10px] text-textSecondary font-medium">
                      {distribution && lastUpdate ? `Update: ${lastUpdate}` : ""}
                    </span>
                  </div>
                  <div id="distribution-container" className="space-y-4">
                    {distribution === null && (
                      <div className="animate-pulse space-y-3">
                        <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                        <div className="h-2 bg-slate-200 rounded col-span-1"></div>
                      </div>
                    )}
                    {distribution !== null &&
                      distribution.map((item, index) => {
                        const dynamicColor = getSeverityColor(item.percent);
                        return (
                          <div key={index} style={{ marginBottom: 15, opacity: 0, animation: `fadeIn 0.5s forwards ${index * 100}ms` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontWeight: 600, fontSize: "0.9rem" }}>
                              <span style={{ color: "#374151" }}>{item.label}</span>
                              <span style={{ color: dynamicColor }}>{item.percent}%</span>
                            </div>
                            <div style={{ backgroundColor: "#f3f4f6", borderRadius: 99, height: 8, width: "100%", overflow: "hidden" }}>
                              <div style={{ backgroundColor: dynamicColor, width: barWidths[`bar-${index}`] || "0%", height: "100%", borderRadius: 99, boxShadow: `0 0 10px ${dynamicColor}80`, transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }}></div>
                            </div>
                            <small style={{ color: "#9ca3af", fontSize: 11, marginTop: 2, display: "block" }}>{item.count} Laporan masuk</small>
                          </div>
                        );
                      })}
                  </div>
                  <div className="mt-6 pt-4 border-t border-lightBorder">
                    <Link href="/dashboard" className="w-full block text-center bg-primary text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primaryHover hover:-translate-y-1 transition-all">
                      <i className="fas fa-columns mr-2"></i> Buka Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STAKEHOLDERS */}
        <section id="stakeholders" className="py-20 bg-white border-y border-lightBorder">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 text-center scroll-reveal">
              <h2 className="text-2xl md:text-3xl font-bold text-textDark">Untuk Siapa Sistem Ini?</h2>
              <p className="text-textSecondary mt-2">Menghubungkan partisipasi warga dengan tindak lanjut pemerintah yang efektif.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              {[
                { icon: "fa-seedling", title: "Untuk Masyarakat", accent: "group-hover:text-primary", iconWrap: "group-hover:bg-primary/10", dot: "text-primary", items: [
                  ["Akses Mudah Melapor", "Warga cukup upload foto atau isi form tanpa birokrasi panjang sehingga partisipasi meningkat."],
                  ["Pantau Status Laporan", "Status laporan (pending, diproses, selesai) bisa dipantau langsung secara transparan dari aplikasi/web."],
                  ["Lingkungan Aman & Nyaman", "Perbaikan lebih cepat berarti jalan aman, sampah berkurang, dan banjir teratasi demi kualitas hidup warga."],
                ] },
                { icon: "fa-bullseye", title: "Untuk Pemerintah", accent: "group-hover:text-accentTeal", iconWrap: "group-hover:bg-accentTeal/10", dot: "text-accentTeal", items: [
                  ["Monitoring Real-time", "Melihat sebaran masalah (jalan, sampah, genangan, dan utilitas udara taktertata) cepat & akurat tanpa harus mengirim petugas survei manual."],
                  ["Prioritas Berbasis Data", "Dashboard memberi skor severity & peringkat kecamatan, agar anggaran fokus ke area paling kritis."],
                  ["Efisiensi & Transparansi", "Data yang rapi dan otomatis mempermudah evaluasi kinerja dinas serta meningkatkan kepercayaan publik."],
                ] },
              ].map((c, idx) => (
                <div key={idx} className={`rounded-2xl border border-lightBorder p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-1 scroll-reveal stagger-${idx + 1} group cursor-default bg-white`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 rounded-full bg-gray-100 ${c.iconWrap} transition-colors flex items-center justify-center text-xl`}>
                      <i className={`fas ${c.icon}`}></i>
                    </div>
                    <h3 className={`text-xl font-bold text-textDark ${c.accent} transition-colors`}>{c.title}</h3>
                  </div>
                  <ul className="space-y-4 text-sm text-textSecondary">
                    {c.items.map(([t, d]) => (
                      <li key={t} className="flex items-start gap-3">
                        <span className={`${c.dot} mt-0.5 text-base`}>•</span>
                        <div>
                          <strong className="block text-textDark mb-1">{t}</strong>
                          <span>{d}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-2xl rounded-xl bg-white/90 backdrop-blur-sm p-4 border border-lightBorder shadow-sm text-xs text-textSecondary leading-relaxed">
              <strong className="text-textDark">Transparansi Data Lingkungan:</strong> Seluruh data mengenai jenis masalah, lokasi umum, dan tingkat keparahan dibuka untuk publik sebagai bentuk edukasi dan keterlibatan masyarakat. Data ini hanya memuat informasi non-pribadi di ruang publik, sehingga aman dan sesuai etika riset. Tujuannya bukan menilai kinerja pihak tertentu, melainkan meningkatkan kesadaran bersama terhadap kondisi lingkungan.
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-bgPage border-y border-lightBorder/50">
          <div className="mx-auto max-w-3xl px-4">
            <div className="text-center mb-12 scroll-reveal">
              <h2 className="text-3xl font-bold text-textDark">Pertanyaan Umum (FAQ)</h2>
            </div>
            <div className="space-y-4 scroll-reveal stagger-1">
              {[
                ["Bagaimana akurasi deteksi pada kondisi malam hari?", "Model dilatih dengan teknik augmentasi kecerahan untuk mengakomodasi variasi cahaya. Namun, performa optimal saat ini berada pada kondisi pencahayaan cukup (siang/sore). Untuk malam hari, disarankan menggunakan flash saat pengambilan foto agar fitur objek terlihat jelas oleh model YOLO."],
                ["Apakah data privasi warga (wajah/plat nomor) aman?", "Ya, privasi adalah prioritas. Sebelum gambar masuk ke database publik atau dashboard pemerintah, sistem memiliki layer preprocessing otomatis yang mendeteksi dan memburamkan (blur) wajah orang serta plat nomor kendaraan, sesuai dengan prinsip etika AI."],
                ["Apa keunggulan sistem ini dibanding pelaporan manual?", "Sistem konvensional hanya mencatat laporan, seringkali tanpa data lokasi yang presisi atau standar keparahan yang jelas. BaliCivic AI melakukan analisis otomatis (validasi objek, scoring tingkat kerusakan, dan geotagging), sehingga pemerintah menerima data yang sudah terstruktur, terverifikasi, dan terprioritas untuk penanganan lebih cepat."],
              ].map(([q, a], i) => (
                <details key={i} className="group border border-lightBorder rounded-xl bg-white overflow-hidden hover:border-primary/30 transition-colors cursor-pointer">
                  <summary className="flex items-center justify-between w-full p-5 text-left font-semibold text-textDark text-sm hover:bg-gray-50 transition-colors select-none">
                    {q}
                    <svg className="w-5 h-5 text-textSecondary faq-icon transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </summary>
                  <div className="p-5 pt-0 text-sm text-textSecondary leading-relaxed border-t border-transparent group-open:border-lightBorder/50">{a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section id="roadmap" className="py-20 bg-white border-y border-lightBorder">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-2xl font-bold text-textDark mb-8">Status Pengembangan</h2>
            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-lightBorder -z-10 -translate-y-1/2"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4">
                {[
                  { n: 1, t: "Riset & Desain", s: "SELESAI", cls: "bg-primary text-white", badge: "text-primary bg-primary/10" },
                  { n: 2, t: "Model AI", s: "SELESAI", cls: "bg-primary text-white", badge: "text-primary bg-primary/10" },
                  { n: 3, t: "Uji Lapangan", s: "BERJALAN", cls: "bg-white border-2 border-primary text-primary animate-pulse", badge: "text-primary border border-primary" },
                  { n: 4, t: "Integrasi", s: "MENDATANG", cls: "bg-gray-200 text-gray-500", badge: "text-textSecondary bg-gray-100" },
                ].map((r, i) => (
                  <div key={i} className={`p-4 rounded-xl border border-lightBorder shadow-sm flex flex-col items-center relative z-10 ${i === 2 ? "border-2 border-primary/50 scale-105" : ""} ${i === 3 ? "bg-white/50 border-dashed grayscale opacity-70" : "bg-white"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-3 ${r.cls}`}>{r.n}</div>
                    <h3 className={`text-sm font-bold ${i === 3 ? "text-textSecondary font-semibold" : "text-textDark"}`}>{r.t}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ${r.badge}`}>{r.s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LIMITATIONS & FUTURE */}
        <section id="limitations-future" className="py-20 bg-bgPage border-y border-lightBorder/50">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center scroll-reveal">
              <h2 className="text-2xl md:text-3xl font-bold text-textDark">Tantangan & Masa Depan</h2>
              <p className="text-textSecondary mt-2">Transparansi mengenai batasan sistem saat ini dan peta jalan pengembangan.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <div className="group rounded-2xl border border-lightBorder bg-white p-6 card-hover scroll-reveal stagger-1 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    <i className="fas fa-triangle-exclamation"></i>
                  </div>
                  <h3 className="text-lg font-bold text-textDark group-hover:text-amber-600 transition-colors">Limitasi Sistem Saat Ini</h3>
                </div>
                <ul className="space-y-3 text-sm text-textSecondary list-disc list-inside marker:text-amber-400 leading-relaxed">
                  <li>Kesulitan mendeteksi objek di kondisi malam atau cahaya ekstrem.</li>
                  <li>Genangan kadang tertukar dengan bayangan atau aspal basah.</li>
                  <li>Sampah kecil sulit dideteksi jika menyatu dengan background.</li>
                  <li>Belum terkoneksi API resmi pemerintah.</li>
                  <li>Ketergantungan pada kualitas kamera perangkat pengguna.</li>
                </ul>
              </div>
              <div className="group rounded-2xl border border-lightBorder bg-white p-6 card-hover scroll-reveal stagger-2 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-accentTeal/10 text-accentTeal flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    <i className="fas fa-rocket"></i>
                  </div>
                  <h3 className="text-lg font-bold text-textDark group-hover:text-accentTeal transition-colors">Rencana Pengembangan</h3>
                </div>
                <ul className="space-y-3 text-sm text-textSecondary list-disc list-inside marker:text-accentTeal leading-relaxed">
                  <li>Menambah dataset lokal hingga 2.500+ foto untuk akurasi tinggi.</li>
                  <li>Pilot testing lapangan bersama sekolah atau komunitas desa.</li>
                  <li>Fitur upload langsung ke peta interaktif publik.</li>
                  <li>Integrasi tracking progres perbaikan per kecamatan.</li>
                  <li>Fine-tuning model khusus untuk kondisi malam hari.</li>
                </ul>
              </div>
            </div>

            <div className="max-w-4xl mx-auto group rounded-2xl border border-lightBorder bg-white p-6 card-hover scroll-reveal stagger-3 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-default relative overflow-hidden">
              <div className="flex justify-between items-center mb-6 border-b border-lightBorder pb-4">
                <h3 className="text-base font-bold text-textDark uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Contoh Output Laporan AI
                </h3>
                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full border border-green-200">VERIFIED RESULT</span>
              </div>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-full md:w-64 aspect-video bg-gray-100 rounded-xl overflow-hidden relative border border-lightBorder group-hover:border-primary/30 transition-colors flex-shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 font-medium bg-slate-50">[FOTO LAPANGAN]</div>
                  <div className="absolute top-4 left-4 right-4 bottom-8 border-2 border-primary rounded-lg bg-primary/5 flex items-start justify-center">
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-b shadow-sm">Jalan Rusak 92%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-textDark bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      </svg>
                      Jl. Raya Ubud, Gianyar
                    </span>
                    <span className="text-xs font-semibold text-white bg-amber-500 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                      Severity: Medium
                    </span>
                  </div>
                  <div className="bg-cardGrey p-5 rounded-xl border border-lightBorder relative">
                    <div className="absolute -top-2 left-8 w-4 h-4 bg-cardGrey border-t border-l border-lightBorder transform rotate-45"></div>
                    <p className="text-sm text-textDark leading-relaxed font-medium italic text-justify">
                      &quot;Terdeteksi lubang jalan berukuran sedang dengan kedalaman estimasi sekitar 8–12 cm. Terletak di pinggir jalur kendaraan roda dua sehingga berpotensi menyebabkan slip. Disarankan penanganan level medium dalam 2–5 hari.&quot;
                    </p>
                    <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-textSecondary font-mono">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      Analysis by Gemini 2.5 Flash
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primaryHover/90 z-0"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0"></div>
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-accentTeal/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
          <div className="mx-auto max-w-4xl px-4 relative z-10 text-center text-white scroll-reveal">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">Jadilah Bagian dari Perubahan</h2>
            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
              Dukung riset ini untuk menciptakan Bali yang lebih tertata, aman, dan nyaman bagi kita semua. Partisipasi Anda sangat berarti.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="px-8 py-4 bg-white text-primary font-bold rounded-xl shadow-lg hover:bg-gray-100 hover:-translate-y-1 transition-all duration-300 text-sm md:text-base animate-bounce-slow">
                Dukung Riset Ini
              </button>
              <button className="px-8 py-4 bg-transparent border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 text-sm md:text-base backdrop-blur-sm">
                Hubungi Tim Peneliti
              </button>
            </div>
          </div>
        </section>

        {/* TEAM + FOOTER */}
        <section className="py-12 bg-white border-t border-lightBorder">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 flex flex-wrap justify-center gap-8 md:gap-12 opacity-80">
              {[
                { img: "/assets/Screenshot 2025-11-30 223809.png", name: "RioFer", role: "Ai Engineer • Backend Dev" },
                { img: "/assets/Screenshot 2025-11-30 223914.png", name: "Bagus Dharma", role: "Frontend Dev • Data Engineer" },
              ].map((m) => (
                <div key={m.name} className="flex items-center gap-3 transition-transform hover:scale-105">
                  <img
                    src={m.img}
                    alt={m.name}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling.style.display = "flex";
                    }}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                  />
                  <div style={{ display: "none" }} className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm ring-2 ring-white shadow-sm">
                    A
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-textDark">{m.name}</div>
                    <div className="text-xs text-textSecondary">{m.role}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-8 text-xs text-textSecondary border border-lightBorder/50 text-center max-w-3xl mx-auto">
              <span className="font-semibold text-textDark">Catatan Etika:</span> Data citra difokuskan pada infrastruktur publik. Wajah & privasi disamarkan sesuai etika AI.
            </div>

            <footer className="border-t border-lightBorder pt-16 mt-16 bg-white">
              <div className="mx-auto max-w-6xl px-4">
                <div className="flex flex-col items-center text-center gap-6 mb-10">
                  <div className="flex items-center gap-2">
                    <img src="/assets/BaliCivic_App_Icon_1_.png" alt="BaliCivic AI" className="h-9 w-9 rounded-lg" />
                    <span className="font-bold text-textDark text-lg">BaliCivic AI</span>
                  </div>
                  <p className="text-sm text-textSecondary leading-relaxed max-w-md">
                    Platform pelaporan cerdas berbasis Vision AI untuk lingkungan Bali yang lebih baik.
                  </p>
                  <div className="flex gap-3">
                    <a
                      href="#"
                      aria-label="GitHub"
                      className="group w-10 h-10 rounded-full bg-slate-100 hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center text-slate-600 hover:scale-110 hover:shadow-md"
                    >
                      <i className="fab fa-github text-base group-hover:scale-110 transition-transform duration-300"></i>
                    </a>
                    <a
                      href="#"
                      aria-label="Email"
                      className="group w-10 h-10 rounded-full bg-slate-100 hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center text-slate-600 hover:scale-110 hover:shadow-md"
                    >
                      <i className="fas fa-envelope text-base group-hover:scale-110 transition-transform duration-300"></i>
                    </a>
                  </div>
                </div>

                <div className="border-t border-lightBorder/60 pt-6 flex flex-col-reverse md:flex-row justify-between items-center gap-3 text-xs text-textSecondary">
                  <div>
                    BaliCivic AI &copy; 2025 &middot; Proyek Karya Tulis Ilmiah
                  </div>
                  <div className="flex gap-5">
                    <a href="#" className="hover:text-primary transition-colors">Kebijakan Privasi</a>
                    <a href="#" className="hover:text-primary transition-colors">Syarat & Ketentuan</a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </section>
      </main>

      <FloatingHelp />
    </div>
  );
}