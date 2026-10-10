import Link from "next/link";

const LINKS = [
  { href: "/peta", icon: "fas fa-map-marked-alt", label: "Heatmap" },
  { href: "/lapor", icon: "fas fa-plus-circle", label: "Lapor", fab: true },
  { href: "/dashboard", icon: "fas fa-chart-pie", label: "Dashboard" },
  { href: "/laporan", icon: "fas fa-list", label: "Laporan" },
];

export default function BottomNav({ raised = "" }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 z-50 px-4 py-3 flex justify-around items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {LINKS.map((l) =>
        raised === l.href ? (
          <Link key={l.href} href={l.href} className={`relative flex flex-col items-center gap-1 text-[var(--brand-primary)] transition-colors`}>
            <div className="absolute -top-6 bg-primary p-3 rounded-full shadow-lg shadow-primary/30 border-4 border-white">
              <i className={`${l.icon} text-white text-xl`}></i>
            </div>
            <span className="text-[10px] font-bold mt-6">{l.label}</span>
          </Link>
        ) : (
          <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[var(--brand-primary)] transition-colors">
            <i className={`${l.icon} text-xl`}></i>
            <span className="text-[10px] font-medium">{l.label}</span>
          </Link>
        )
      )}
    </nav>
  );
}