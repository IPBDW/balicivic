import Link from "next/link";

const LINKS = [
  { href: "/", icon: "fas fa-home", label: "Beranda" },
  { href: "/peta", icon: "fas fa-map-marked-alt", label: "Heatmap" },
  { href: "/lapor", icon: "fas fa-plus-circle", label: "Lapor" },
  { href: "/dashboard", icon: "fas fa-chart-pie", label: "Dashboard" },
  { href: "/laporan", icon: "fas fa-list", label: "Laporan" },
];

export default function BottomNav({ raised = "" }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 px-2 py-2 flex justify-around items-center shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.06)]">
      {LINKS.map((l) => {
        const active = raised === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] py-1.5 rounded-xl transition-all duration-300 ${
              active
                ? "text-primary"
                : "text-slate-400 hover:text-slate-600 active:text-primary"
            }`}
          >
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${
                active ? "bg-primary/10" : "bg-transparent"
              }`}
            >
              <i className={`${l.icon} text-[20px] leading-none`}></i>
            </div>
            <span
              className={`text-[10px] leading-none transition-all ${
                active ? "font-bold" : "font-medium"
              }`}
            >
              {l.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
