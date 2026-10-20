"use client";

import { MapPin } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type Row = { date: string; area: string; source?: string };

export default function VesselHistory({ rows }: { rows: Row[] }) {
  const { t } = useLanguage();
  if (!rows || rows.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl2 border border-border bg-surface-2 p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <MapPin size={16} className="text-brand-400" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-400">{t("historyTitle")}</h3>
        <span className="ml-auto text-[11px] text-ink-soft">{rows.length}</span>
      </div>
      <p className="mb-3 text-xs text-ink-soft">{t("historyDesc")}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-brand-500 text-left text-white">
              <th className="px-3 py-2 font-semibold">{t("historyDate")}</th>
              <th className="px-3 py-2 font-semibold">{t("historyArea")}</th>
              <th className="px-3 py-2 font-semibold">{t("historySource")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-surface-3/40" : ""}>
                <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{r.date}</td>
                <td className="px-3 py-2 text-ink">{r.area}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
