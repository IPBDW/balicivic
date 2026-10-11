"use client";

import Link from "next/link";

const LINKS = [
  { label: "Beranda", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Heatmap", href: "/peta" },
  { label: "Semua Laporan", href: "/laporan" },
  { label: "Bantuan", href: "/bantuan" },
];

/* NavbarApp — sticky di atas, semi-transparan, container max-w-7xl.
   Supaya posisi konsisten di semua halaman, tidak ada pergeseran layout. */
export default function NavbarApp({ active = "", sublabel = "" }) {
  return (
    <header className="sticky top-0 z-50 w-full h-16 border-b border-lightBorder bg-white/95 backdrop-blur-md shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="block" aria-label="BaliCivic AI - Beranda">
            <img
              src="/assets/BaliCivic_App_Icon_1_.png"
              alt="BaliCivic AI"
              className="h-9 w-9 rounded-lg object-cover shadow-md shadow-primary/20"
              width="36"
              height="36"
            />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="font-bold tracking-tight text-base sm:text-lg text-textDark">BaliCivic AI</span>
            {sublabel && (
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{sublabel}</span>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                active === l.href
                  ? "px-4 py-2 text-sm font-bold text-primary bg-primary/5 rounded-lg transition-all"
                  : "px-4 py-2 text-sm font-medium text-textSecondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
              }
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/lapor"
            className="ml-4 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary to-primaryHover rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5"
          >
            <i className="fas fa-plus-circle mr-2"></i>Lapor
          </Link>
        </div>

        <Link
          href="/bantuan"
          className="md:hidden p-2.5 text-textSecondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
          aria-label="Bantuan"
        >
          <i className="fas fa-question-circle text-lg"></i>
        </Link>
      </div>
    </header>
  );
}
