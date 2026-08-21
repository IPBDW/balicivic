"use client";

import Link from "next/link";

const LINKS = [
  { label: "Beranda", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Heatmap", href: "/peta" },
  { label: "Semua Laporan", href: "/laporan" },
  { label: "Bantuan", href: "/bantuan" },
];

/* variant:
   plain   = report/all-reports/help (sticky, lightBorder, logo kecil)
   glass   = dashboard (sticky, glass, font-display, rose gradient CTA)
   heatmap = peta (absolute overlay + sublabel di logo) */
export default function NavbarApp({ active = "", variant = "plain", sublabel = "" }) {
  if (variant === "glass") {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-white/50 bg-white/80 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="block group" aria-label="BaliCivic AI - Beranda">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-rose-400 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                <img src="/assets/BaliCivic_App_Icon_1_.png" alt="BaliCivic AI" className="relative h-9 w-9 rounded-lg object-cover shadow-sm" />
              </div>
            </Link>
            <span className="font-display font-bold tracking-tight text-xl text-slate-800 hidden sm:block">BaliCivic AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={active === l.href ? "px-4 py-2 text-sm font-bold text-primary bg-primary/5 rounded-lg transition-all" : "px-4 py-2 text-sm font-medium text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"}>
                {l.label}
              </Link>
            ))}
            <Link href="/lapor" className="ml-4 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary to-rose-500 rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5">
              <i className="fas fa-plus-circle mr-2"></i>Lapor
            </Link>
          </div>
          <Link href="/bantuan" className="md:hidden p-2.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-300">
            <i className="fas fa-question-circle text-lg"></i>
          </Link>
        </div>
      </header>
    );
  }

  if (variant === "heatmap") {
    return (
      <header className="absolute top-0 z-[1000] w-full border-b border-white/30 bg-white/80 backdrop-blur-xl transition-all duration-300 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="block transform transition-transform hover:scale-105" aria-label="BaliCivic AI - Beranda">
              <img src="/assets/BaliCivic_App_Icon_1_.png" alt="BaliCivic AI" className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-primary/20 ring-1 ring-white/50" />
            </Link>
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-tight text-lg text-textDark">BaliCivic AI</span>
              {sublabel && <span className="text-[10px] font-medium text-primary leading-none">{sublabel}</span>}
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={active === l.href ? "px-4 py-2 text-sm font-bold text-primary bg-primary/5 rounded-lg transition-all" : "px-4 py-2 text-sm font-medium text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"}>
                {l.label}
              </Link>
            ))}
            <Link href="/lapor" className="ml-4 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary to-rose-500 rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5">
              <i className="fas fa-plus-circle mr-2"></i>Lapor
            </Link>
          </div>
          <Link href="/bantuan" className="md:hidden p-2.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-300">
            <i className="fas fa-question-circle text-lg"></i>
          </Link>
        </div>
      </header>
    );
  }

  // plain (default)
  return (
    <header className="sticky top-0 z-50 w-full border-b border-lightBorder bg-white/90 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="block" aria-label="BaliCivic AI - Beranda">
            <img src="/assets/BaliCivic_App_Icon_1_.png" alt="BaliCivic AI" className="h-8 w-8 rounded-lg object-cover shadow-lg shadow-primary/30" width="32" height="32" />
          </Link>
          <span className="font-bold tracking-tight text-lg text-textDark">BaliCivic AI</span>
        </div>
        <div className="hidden md:flex items-center space-x-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active === l.href ? "px-4 py-2 text-sm font-bold text-primary bg-primary/5 rounded-lg transition-all" : "px-4 py-2 text-sm font-medium text-textSecondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"}>
              {l.label}
            </Link>
          ))}
          <Link href="/lapor" className="ml-4 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary to-primaryHover rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5">
            <i className="fas fa-plus-circle mr-2"></i>Lapor
          </Link>
        </div>
        <Link href="/bantuan" className="md:hidden p-2.5 text-textSecondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-300 group">
          <i className="fas fa-question-circle text-base group-hover:scale-110 transition-transform"></i>
        </Link>
      </div>
    </header>
  );
}