import Link from "next/link";
import { LucideIcon, ChevronRight, Sparkles } from "lucide-react";

type Props = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent?: boolean;
  badge?: string;
  // Prominent gold label (e.g. "Advanced feature") shown top-right instead of the badge.
  highlight?: string;
  // Force a real document navigation (plain <a>) instead of client-side routing.
  // Needed for gated routes so the Cloudflare access middleware actually runs.
  hardNav?: boolean;
};

const CARD_CLS =
  "glass-card group relative flex flex-col justify-between overflow-hidden rounded-xl2 p-6 transition hover:-translate-y-1 hover:shadow-2xl";

export default function BlockCard({ href, icon: Icon, title, desc, accent, badge, highlight, hardNav }: Props) {
  const inner = (
    <>
      <span className="absolute -right-8 -top-8 h-28 w-28 rotate-45 bg-brand-500/10 transition group-hover:bg-accent/15" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-card">
            <Icon size={22} />
          </span>
          {highlight ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-white/40">
              <Sparkles size={12} />
              {highlight}
            </span>
          ) : (
            badge && (
              <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                {badge}
              </span>
            )
          )}
        </div>
        <h3 className="brand-headline text-lg text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{desc}</p>
      </div>
      <div className="relative z-10 mt-5 flex items-center gap-1 text-sm font-semibold text-accent opacity-0 transition group-hover:opacity-100">
        <span>→</span>
        <ChevronRight size={14} />
      </div>
    </>
  );

  if (hardNav) {
    // href is already fully resolved by the caller (basePath-prefixed local route, or an
    // absolute external URL) — use it verbatim so the real document request runs the gate.
    return (
      <a href={href} className={CARD_CLS}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={CARD_CLS}>
      {inner}
    </Link>
  );
}
