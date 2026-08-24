"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, X, Send, ArrowRight, GitCompare, Download, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useVesselData } from "@/context/VesselDataContext";
import { JubVessel } from "@/data/jubVessels";
import { Vessel } from "@/data/vessels";
import {
  parseStructuredQuery,
  structuredConfidence,
  keywordConfidence,
  regionConfidence,
  hasRegionCondition,
  conditionLabel,
  sortLabel,
  Confidence,
} from "@/lib/aiAgentQuery";
import { detectField, detectMonth, matchVesselsToField, monthLabel } from "@/lib/aiAgentFieldMatch";
import { DictKey, Locale } from "@/lib/i18n";

type ChatMessage = {
  id: number;
  role: "user" | "ai";
  text: string;
  vessels?: Vessel[];
  allMatched?: Vessel[];
  describe?: (v: Vessel) => string;
  confidence?: Confidence;
};

function format(str: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((acc, [key, val]) => acc.replaceAll(`{${key}}`, String(val)), str);
}

function vesselHaystack(v: JubVessel): string {
  return [v.displayName, v.idType, v.idOwner, v.idFlag, v.idClassSociety, v.idNotation, v.idImo, v.idCallsign, v.idBuilder, v.pwrDpClass, v.craneMainSwl, v.opsFieldmoveBeaufort]
    .join(" ")
    .toLowerCase();
}

function keywordMatchReason(v: JubVessel, q: string): string {
  const ql = q.toLowerCase();
  if (String(v.idImo).toLowerCase().includes(ql)) return `IMO ${v.idImo}`;
  if (String(v.pwrDpClass).toLowerCase().includes(ql)) return String(v.pwrDpClass);
  if (String(v.idNotation).toLowerCase().includes(ql)) return String(v.idNotation);
  if (String(v.idType).toLowerCase().includes(ql)) return String(v.idType);
  return v.idOwner ? String(v.idOwner) : "";
}

// `vessels` = the (capped) list shown in chat; `allMatched` = the FULL result set
// used for CSV export so the file matches the headline count, not the display slice.
type Answer = { text: string; vessels: Vessel[]; allMatched: Vessel[]; describe: (v: Vessel) => string; confidence: Confidence };

const CLASS_ASK = /drydock|dry-dock|lên đà|len da|special survey|periodic survey|đăng kiểm định kỳ|còn class|con class|treo class|withdrawn|suspended|hết hạn|het han|class status|tình trạng class|tinh trang class|class certificate|chứng chỉ đăng kiểm|giấy chứng nhận class/i;

function answerFor(query: string, locale: Locale, tt: (key: DictKey) => string, allVessels: Vessel[]): Answer {
  // Group 7 — class / drydock / survey status is DYNAMIC data the platform does
  // not store; guide the user to the per-vessel "Class & Survey" lookup instead
  // of returning a misleading "not found".
  if (CLASS_ASK.test(query)) {
    return {
      text:
        locale === "vi"
          ? 'Trạng thái class, hạn lên đà (drydock) và hạn kiểm định là dữ liệu ĐỘNG — chỉ đăng kiểm mới có giá trị pháp lý, nền tảng không lưu. Hãy mở trang chi tiết một tàu → mục "Cấp tàu & Kiểm định (Class & Survey)" và bấm Equasis / cổng đăng kiểm để tra theo IMO (bản mới nhất).'
          : 'Class status, next drydock and survey windows are DYNAMIC — only the classification society is authoritative and the platform does not store them. Open a vessel detail page → "Class & Survey" and use the Equasis / society links to check by IMO (latest record).',
      vessels: [],
      allMatched: [],
      describe: () => "",
      confidence: {
        level: "low",
        reasonVi: "Thông tin class/drydock không lưu trên nền tảng — tra trực tiếp từ đăng kiểm theo IMO.",
        reasonEn: "Class/drydock info is not stored here — look it up from the society by IMO.",
      },
    };
  }

  // B#5 — vessel ↔ field/month matching (uses the weather engine).
  const field = detectField(query);
  if (field) {
    const monthIdx = detectMonth(query);
    const result = matchVesselsToField(field, monthIdx, allVessels);
    const top = result.rows.slice(0, 10);
    const fieldName = locale === "vi" ? field.nameVi : field.nameEn;
    const text = format(tt("aiAgentFieldMatchFound"), { n: result.rows.length, field: fieldName, month: monthLabel(monthIdx, locale) });
    const dtByVessel = new Map(result.rows.map((r) => [r.vessel.id, r.downtimePct]));
    return {
      text,
      vessels: top.map((r) => r.vessel),
      allMatched: result.rows.map((r) => r.vessel),
      describe: (v) => `${tt("aiAgentDowntimeShort")} ${dtByVessel.get(v.id) ?? "?"}% · ${v.idType}`,
      confidence: result.confidence,
    };
  }

  // A — structured filter (numeric / range / DP / category) + sort.
  const structured = parseStructuredQuery(query, allVessels);
  if (structured) {
    const { conditions, sort, vessels } = structured;
    const condText = conditions.map((c) => conditionLabel(c, locale)).join("; ");
    const sortText = sort ? format(tt("aiAgentSortNote"), { sort: sortLabel(sort, locale) }) : "";
    const base =
      vessels.length > 0
        ? format(tt("aiAgentFoundMulti"), { n: vessels.length, conditions: condText || sortLabel(sort!, locale) })
        : format(tt("aiAgentNoneMulti"), { conditions: condText || sortLabel(sort!, locale) });
    const isRegion = hasRegionCondition(conditions);
    return {
      text: base + sortText,
      vessels: vessels.slice(0, isRegion ? 30 : 12) as Vessel[],
      allMatched: vessels as Vessel[],
      describe: structured.describe as (v: Vessel) => string,
      confidence: isRegion ? regionConfidence(vessels.length) : structuredConfidence(structured),
    };
  }

  // Keyword fallback.
  const ql = query.trim().toLowerCase();
  const foundAll = allVessels.filter((v) => vesselHaystack(v).includes(ql));
  const text = foundAll.length > 0 ? format(tt("aiAgentFoundKeyword"), { n: foundAll.length, query }) : format(tt("aiAgentNoneKeyword"), { query });
  return { text, vessels: foundAll.slice(0, 8), allMatched: foundAll, describe: (v) => keywordMatchReason(v, query), confidence: keywordConfidence(foundAll.length) };
}

const CONF_STYLE: Record<Confidence["level"], string> = {
  high: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  low: "border-rose-500/40 bg-rose-500/10 text-rose-500",
};

const COMPARE_FIELDS: { key: keyof Vessel; vi: string; en: string }[] = [
  { key: "idType", vi: "Loại", en: "Type" },
  { key: "idFlag", vi: "Cờ", en: "Flag" },
  { key: "dimLoa", vi: "LOA", en: "LOA" },
  { key: "dimWidth", vi: "Rộng (beam)", en: "Beam" },
  { key: "accPobMax", vi: "POB", en: "POB" },
  { key: "craneMainSwl", vi: "Cẩu chính", en: "Main crane" },
  { key: "bollardPullT", vi: "Bollard pull", en: "Bollard pull" },
  { key: "pwrDpClass", vi: "Cấp DP", en: "DP class" },
  { key: "idYear", vi: "Năm đóng", en: "Built" },
  { key: "idImo", vi: "IMO", en: "IMO" },
  { key: "idOwner", vi: "Chủ tàu", en: "Owner" },
];

function cellVal(v: Vessel, key: keyof Vessel): string {
  const s = String(v[key] ?? "").trim();
  return s && !/không tìm thấy|không áp dụng/i.test(s) ? s : "—";
}

function exportCsv(vessels: Vessel[]) {
  const cols: (keyof Vessel)[] = ["displayName", "idType", "idFlag", "idImo", "dimLoa", "dimWidth", "accPobMax", "craneMainSwl", "bollardPullT", "pwrDpClass", "idOwner", "idYear", "category"];
  const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const head = cols.join(",");
  const rows = vessels.map((v) => cols.map((c) => esc(String(v[c] ?? ""))).join(","));
  const csv = "﻿" + [head, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vessels-${vessels.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AIAgent() {
  const { t, locale } = useLanguage();
  const { allVessels } = useVesselData();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [compare, setCompare] = useState<Vessel[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(raw: string) {
    const query = raw.trim();
    if (!query) return;
    idRef.current += 1;
    const userMsg: ChatMessage = { id: idRef.current, role: "user", text: query };
    const { text, vessels, allMatched, describe, confidence } = answerFor(query, locale, t, allVessels);
    idRef.current += 1;
    const aiMsg: ChatMessage = { id: idRef.current, role: "ai", text, vessels, allMatched, describe, confidence };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
  }

  function toggleCompare(v: Vessel) {
    setCompare((prev) => {
      if (prev.some((x) => x.id === v.id)) return prev.filter((x) => x.id !== v.id);
      if (prev.length >= 3) return [...prev.slice(1), v]; // keep max 3 (drop oldest)
      return [...prev, v];
    });
  }
  const inCompare = (v: Vessel) => compare.some((x) => x.id === v.id);

  // C#9 — dynamic suggestion chips from the real fleet.
  const chips = useMemo(() => {
    const dp2 = allVessels.filter((v) => /dp\s*-?\s*2|dps-?2/i.test(String(v.pwrDpClass))).length;
    const dp3 = allVessels.filter((v) => /dp\s*-?\s*3|dps-?3/i.test(String(v.pwrDpClass))).length;
    const vi = locale === "vi";
    return [
      // 1 — năng lực
      vi ? "Cẩu chính từ 150 tấn" : "Main crane from 150t",
      vi ? "Bollard pull trên 100 tấn" : "Bollard pull over 100t",
      `${vi ? "Tàu DP2" : "DP2 vessels"}${dp2 ? ` (${dp2})` : ""}`,
      `${vi ? "Tàu DP3" : "DP3 vessels"}${dp3 ? ` (${dp3})` : ""}`,
      vi ? "POB từ 200 người" : "POB from 200",
      vi ? "Chiều dài dưới 60m" : "Length under 60m",
      vi ? "Tốc độ trên 20 hải lý" : "Speed over 20 kn",
      // 2 — nhiều tiêu chí
      vi ? "Tàu tự nâng POB từ 150 và cẩu từ 100 tấn" : "Jack-up POB from 150 and crane from 100t",
      // 4 — siêu hạng / sắp xếp
      vi ? "Tàu tự nâng lớn nhất" : "Largest liftboat",
      vi ? "AHTS bollard pull mạnh nhất" : "Strongest AHTS bollard pull",
      // 5 — khu vực
      vi ? "JUB ở Trung Đông" : "JUB in the Middle East",
      vi ? "OCV ở Việt Nam" : "OCV in Vietnam",
      // 3 — năng lực / chức năng
      vi ? "Tàu đa nhiệm (multi-purpose)" : "Multi-purpose vessels",
      vi ? "Tàu rải ống (pipelay)" : "Pipelay vessels",
      vi ? "Tàu thi công ngầm / ROV" : "Subsea / ROV vessels",
      vi ? "Cẩu bù chuyển động (AHC)" : "Active-heave crane (AHC)",
      vi ? "Tàu chữa cháy (FiFi)" : "Fire-fighting (FiFi)",
      // 6 — mỏ/tháng
      vi ? "Lạc Đà Vàng tháng 7" : "Lac Da Vang in July",
      // 7 — class/drydock (ra hướng dẫn)
      vi ? "Kiểm tra class / lên đà" : "Check class / drydock",
    ];
  }, [allVessels, locale]);

  const nameQuery = input.trim().toLowerCase();
  const nameMatches = nameQuery.length >= 1 ? allVessels.filter((v) => v.displayName.toLowerCase().includes(nameQuery)).slice(0, 6) : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:brightness-90 sm:bottom-8 sm:right-8"
      >
        <Bot size={18} />
        <span className="hidden sm:inline">{t("aiAgentTitle")}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-0 sm:items-end sm:p-6" onClick={() => setOpen(false)}>
          <div
            className="flex h-[80vh] w-full flex-col rounded-t-2xl border border-border bg-surface-2 shadow-card sm:h-[600px] sm:w-[440px] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white">
                  <Bot size={18} />
                </span>
                <div>
                  <p className="brand-headline text-sm text-ink">{t("aiAgentTitle")}</p>
                  <p className="text-xs text-ink-soft">{t("aiAgentSubtitle")}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface-3 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto p-3">
              {messages.length === 0 && (
                <div>
                  <p className="px-1 py-3 text-sm text-ink-soft">{t("aiAgentEmpty")}</p>
                  <div className="flex flex-wrap gap-2 px-1 pt-1">
                    {chips.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand-500 hover:text-brand-400"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500 px-3 py-2 text-sm text-white"
                          : "max-w-[94%] rounded-2xl rounded-bl-sm border border-border bg-surface-3 px-3 py-2 text-sm text-ink"
                      }
                    >
                      <p>{m.text}</p>

                      {m.role === "ai" && m.confidence && (
                        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CONF_STYLE[m.confidence.level]}`}>
                          <ShieldCheck size={11} />
                          {t("aiAgentConfidence")}:{" "}
                          {m.confidence.level === "high" ? t("aiAgentConfHigh") : m.confidence.level === "medium" ? t("aiAgentConfMedium") : t("aiAgentConfLow")}
                        </div>
                      )}
                      {m.role === "ai" && m.confidence && (
                        <p className="mt-1 text-[11px] italic text-ink-soft">{locale === "vi" ? m.confidence.reasonVi : m.confidence.reasonEn}</p>
                      )}

                      {m.vessels && m.vessels.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {m.vessels.map((v) => (
                            <div key={v.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2">
                              <Link
                                href={`/vessel/${v.category}/${v.id}`}
                                onClick={() => setOpen(false)}
                                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-ink transition hover:text-brand-400"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold">{v.displayName}</p>
                                  <p className="mt-0.5 truncate text-[11px] text-ink-soft">{m.describe?.(v)}</p>
                                </div>
                                <ArrowRight size={14} className="shrink-0 text-brand-400" />
                              </Link>
                              <button
                                onClick={() => toggleCompare(v)}
                                title={t("aiAgentCompareAdd")}
                                className={`shrink-0 rounded-md border p-1.5 transition ${
                                  inCompare(v) ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border text-ink-soft hover:border-brand-400 hover:text-brand-400"
                                }`}
                              >
                                <GitCompare size={13} />
                              </button>
                            </div>
                          ))}
                          {(() => {
                            const full = m.allMatched && m.allMatched.length ? m.allMatched : m.vessels!;
                            const more = full.length - m.vessels!.length;
                            return (
                              <>
                                {more > 0 && (
                                  <p className="mt-1 text-[11px] italic text-ink-soft">
                                    {locale === "vi"
                                      ? `Hiển thị ${m.vessels!.length}/${full.length} tàu — bấm Xuất CSV để lấy đủ ${full.length}.`
                                      : `Showing ${m.vessels!.length}/${full.length} — click Export CSV for all ${full.length}.`}
                                  </p>
                                )}
                                <button
                                  onClick={() => exportCsv(full)}
                                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-ink-soft transition hover:border-brand-400 hover:text-brand-400"
                                >
                                  <Download size={12} />
                                  {t("aiAgentExport")} ({full.length})
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compare bar */}
            {compare.length > 0 && (
              <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2">
                <span className="text-[11px] text-ink-soft">{format(t("aiAgentCompareBar"), { n: compare.length })}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCompare([])} className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink">
                    {t("aiAgentCompareClear")}
                  </button>
                  <button
                    onClick={() => setShowCompare(true)}
                    disabled={compare.length < 2}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                  >
                    <GitCompare size={12} />
                    {t("aiAgentCompareOpen")}
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="relative border-t border-border p-3"
            >
              {nameMatches.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-card">
                  <p className="border-b border-border px-3 py-1.5 text-[11px] font-semibold text-ink-soft">{t("aiAgentNameMatches")}</p>
                  <div className="max-h-56 overflow-y-auto">
                    {nameMatches.map((v) => (
                      <Link
                        key={v.id}
                        href={`/vessel/${v.category}/${v.id}`}
                        onClick={() => {
                          setOpen(false);
                          setInput("");
                        }}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-ink transition hover:bg-surface-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{v.displayName}</p>
                          <p className="mt-0.5 truncate text-[11px] text-ink-soft">{v.idType}</p>
                        </div>
                        <ArrowRight size={14} className="shrink-0 text-brand-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("aiAgentPlaceholder")}
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-soft focus:outline-none"
                />
                <button type="submit" disabled={!input.trim()} className="text-brand-400 transition disabled:opacity-30">
                  <Send size={16} />
                </button>
              </div>
            </form>

            <div className="border-t border-border px-4 py-2">
              <p className="text-[11px] text-ink-soft">{t("aiAgentFooter")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison overlay */}
      {showCompare && compare.length >= 2 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCompare(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-surface-2 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <GitCompare size={16} className="text-brand-400" />
                <h3 className="brand-headline text-sm text-ink">{t("aiAgentCompareTitle")}</h3>
              </div>
              <button onClick={() => setShowCompare(false)} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface-3 hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-x-auto p-3">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-surface-2 p-2 text-left font-semibold text-ink-soft"></th>
                    {compare.map((v) => (
                      <th key={v.id} className="min-w-[120px] p-2 text-left align-bottom">
                        <Link href={`/vessel/${v.category}/${v.id}`} onClick={() => { setShowCompare(false); setOpen(false); }} className="font-bold text-brand-400 hover:underline">
                          {v.displayName}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_FIELDS.map((f) => (
                    <tr key={String(f.key)} className="border-t border-border">
                      <td className="sticky left-0 bg-surface-2 p-2 font-medium text-ink-soft">{locale === "vi" ? f.vi : f.en}</td>
                      {compare.map((v) => (
                        <td key={v.id} className="p-2 text-ink">{cellVal(v, f.key)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => exportCsv(compare)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-400 hover:text-brand-400"
              >
                <Download size={13} />
                {t("aiAgentExport")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
