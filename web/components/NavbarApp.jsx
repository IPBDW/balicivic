"use client";

import Link from "next/link";

const LINKS = [
  { label: "Beranda", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Peta Sebaran", href: "/peta" },
  { label: "Semua Laporan", href: "/laporan" },
  { label: "Panduan", href: "/bantuan" },
];

export default function NavbarApp({ active = "", sublabel = "" }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group" aria-label="BaliCivic AI - Beranda">
            <img
              src="/assets/BaliCivic_App_Icon_1_.png"
              alt="BaliCivic AI Logo"
              className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-black/5 group-hover:scale-105 transition-transform"
              width="36"
              height="36"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-bold tracking-tight text-base sm:text-lg text-slate-900 group-hover:text-primary transition-colors">
                BaliCivic AI
              </span>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide">
                {sublabel || "Sistem Infrastruktur Publik Bali"}
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Links (Hanya tampil di layar desktop md ke atas; mobile memakai BottomNav di bawah) */}
        <nav aria-label="Navigasi Utama" className="hidden md:flex items-center space-x-1">
          {LINKS.map((l) => {
            const isActive = active === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? "font-bold text-primary bg-primary/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/lapor"
            className="ml-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primaryHover shadow-sm shadow-primary/20 hover:shadow-md transition-all active:scale-95"
          >
            <i className="fas fa-camera text-xs"></i>
            <span>Lapor Kerusakan</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
