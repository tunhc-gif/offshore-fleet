import Link from "next/link";
import { LucideIcon, ChevronRight } from "lucide-react";

type Props = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent?: boolean;
  badge?: string;
};

export default function BlockCard({ href, icon: Icon, title, desc, accent, badge }: Props) {
  return (
    <Link
      href={href}
      className="glass-card group relative flex flex-col justify-between overflow-hidden rounded-xl2 p-6 transition hover:-translate-y-1 hover:shadow-2xl"
    >
      <span className="absolute -right-8 -top-8 h-28 w-28 rotate-45 bg-brand-500/10 transition group-hover:bg-accent/15" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-card">
            <Icon size={22} />
          </span>
          {badge && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              {badge}
            </span>
          )}
        </div>
        <h3 className="brand-headline text-lg text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{desc}</p>
      </div>
      <div className="relative z-10 mt-5 flex items-center gap-1 text-sm font-semibold text-accent opacity-0 transition group-hover:opacity-100">
        <span>→</span>
        <ChevronRight size={14} />
      </div>
    </Link>
  );
}
