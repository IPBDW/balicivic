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
      className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 px-3 py-1.5 flex justify-around items-center shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      {LINKS.map((l) => {
        const active = raised === l.href;
        if (l.highlight) {
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center -mt-5 group"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 group-active:scale-95 ${
                  active
                    ? "bg-primary text-white shadow-primary/40 ring-4 ring-primary/20"
                    : "bg-primary text-white shadow-primary/30 hover:bg-primaryHover"
                }`}
              >
                <i className={`${l.icon} text-lg leading-none`}></i>
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">
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
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 rounded-xl transition-colors duration-200 ${
              active
                ? "text-primary font-bold"
                : "text-slate-500 hover:text-slate-800 active:text-primary font-medium"
            }`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                active ? "bg-primary/10" : "bg-transparent"
              }`}
            >
              <i className={`${l.icon} text-base leading-none`}></i>
            </div>
            <span className="text-[10px] leading-tight mt-0.5">
              {l.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
