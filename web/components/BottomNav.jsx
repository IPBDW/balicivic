import Link from "next/link";

const LINKS = [
  { href: "/", icon: "fas fa-home", label: "Beranda" },
  { href: "/peta", icon: "fas fa-map-marked-alt", label: "Peta" },
  { href: "/lapor", icon: "fas fa-camera", label: "Lapor", highlight: true },
  { href: "/dashboard", icon: "fas fa-chart-pie", label: "Dashboard" },
  { href: "/laporan", icon: "fas fa-list-check", label: "Laporan" },
];

export default function BottomNav({ raised = "" }) {
  return (
    <nav
      aria-label="Navigasi Bawah Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/90 z-50 px-2 pt-1.5 pb-[max(0.5rem,calc(env(safe-area-inset-bottom,0px)+0.35rem))] flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.07)]"
    >
      {LINKS.map((l) => {
        const active = raised === l.href || (l.href !== "/" && raised.startsWith(l.href));
        if (l.highlight) {
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center -mt-6 group focus:outline-none"
            >
              <div
                className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 group-active:scale-90 ${
                  active
                    ? "bg-primary text-white shadow-primary/40 ring-4 ring-white ring-offset-2 ring-offset-primary/30 scale-105"
                    : "bg-primary text-white shadow-primary/35 ring-4 ring-white hover:bg-primaryHover"
                }`}
              >
                <i className={`${l.icon} text-lg leading-none`}></i>
              </div>
              <span
                className={`text-[10px] font-bold mt-1 tracking-tight transition-colors ${
                  active ? "text-primary" : "text-slate-700"
                }`}
              >
                {l.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 px-1.5 rounded-xl transition-all duration-200 active:scale-95 focus:outline-none ${
              active
                ? "text-primary font-bold"
                : "text-slate-500 hover:text-slate-800 active:text-primary font-medium"
            }`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                active ? "bg-primary/10 text-primary scale-105" : "bg-transparent text-slate-500"
              }`}
            >
              <i className={`${l.icon} text-sm leading-none`}></i>
            </div>
            <span className="text-[10px] leading-tight mt-0.5 tracking-tight">
              {l.label}
            </span>
            {active && (
              <span className="w-1 h-1 rounded-full bg-primary mt-0.5"></span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
