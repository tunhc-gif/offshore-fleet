"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Plus, X, Cloud, HardDrive, FileSpreadsheet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useVesselData } from "@/context/VesselDataContext";
import { vesselTypes } from "@/data/vesselTypes";
import { offshoreFields, getFieldWeather, OffshoreField } from "@/data/offshoreAreas";
import {
  defaultLimitsByType,
  resolveLimits,
  mechanicalRate,
  parseBuildYear,
  limitsFromCsvRows,
  mechFromCsvRows,
  defaultMechConfig,
  TypeLimits,
  MechConfig,
} from "@/data/weatherLimits";
import { monthDayCounts, weatherDowntimeDays, totalDays } from "@/lib/weather";
import { parseCsv } from "@/lib/csv";
import { WD_LIMITS_CSV_URL } from "@/config/weatherLimitsSource";

const REF_YEAR = new Date().getFullYear();

type Row = {
  id: number;
  type: string;
  vesselId: string; // "typical" or a vessel id
  area: string; // field slug
  start: string;
  finish: string;
  setupDays: number; // positioning/setup window from start
  relocProb: number;
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

// vessel types that can be weather-assessed (have a default-limits row)
const ASSESS_TYPES = vesselTypes.filter((vt) => defaultLimitsByType[vt.slug]);

// offshore fields that actually have wind/wave data
const AREAS: OffshoreField[] = offshoreFields.filter((f) => getFieldWeather(f.slug));

function newRow(id: number): Row {
  return {
    id,
    type: "jub",
    vesselId: "typical",
    area: AREAS[0]?.slug ?? "",
    start: `${REF_YEAR}-01-01`,
    finish: `${REF_YEAR}-03-31`,
    setupDays: 10,
    relocProb: 1,
  };
}

type VesselLite = { id: string; displayName: string; idYear?: string | number };

// Shared downtime computation — used by both the on-screen RowCard and the Excel export
// so the two never diverge.
function computeRow(
  r: Row,
  vesselsByType: Record<string, VesselLite[]>,
  limitsByType: Record<string, TypeLimits>,
  mechConfig: MechConfig
) {
  const weather = getFieldWeather(r.area);
  const vesselList = vesselsByType[r.type] ?? [];
  const vessel = r.vesselId === "typical" ? null : vesselList.find((v) => v.id === r.vesselId) ?? null;

  const limits = resolveLimits(vessel as never, r.type, limitsByType);
  const buildYear = vessel ? parseBuildYear(vessel.idYear) : null;
  const mechRate = vessel ? mechanicalRate(buildYear, REF_YEAR, mechConfig) : mechConfig.rateUnknown / 100;

  const startD = new Date(r.start);
  const finishD = new Date(r.finish);
  const dayCounts = monthDayCounts(startD, finishD);
  const duration = totalDays(dayCounts);

  const setup = Math.max(0, r.setupDays);
  const relocEnd = addDays(startD, setup - 1);
  const relocEndClamped = relocEnd > finishD ? finishD : relocEnd;
  const relocCounts = setup > 0 ? monthDayCounts(startD, relocEndClamped) : new Array(12).fill(0);
  const relocSpan = totalDays(relocCounts);
  const workStart = addDays(startD, setup);
  const workCounts = workStart <= finishD ? monthDayCounts(workStart, finishD) : new Array(12).fill(0);
  const workSpan = totalDays(workCounts);

  let relocWDT = 0, workingWDT = 0, mechDays = 0, totalDT = 0;
  if (weather && duration > 0) {
    relocWDT = weatherDowntimeDays(weather, limits.relocation.windKn, limits.relocation.hs, relocCounts, r.relocProb);
    workingWDT = weatherDowntimeDays(weather, limits.working.windKn, limits.working.hs, workCounts, 1);
    mechDays = Math.round(duration * mechRate * 100) / 100;
    totalDT = Math.round((relocWDT + workingWDT + mechDays) * 100) / 100;
  }
  return { vessel, limits, mechRate, duration, relocSpan, workSpan, relocWDT, workingWDT, mechDays, totalDT };
}

const pctOf = (d: number, span: number) => (span > 0 ? Math.round((d / span) * 1000) / 10 : 0);

// Build a styled .xls (HTML-table workbook Excel opens natively — no library needed) and download it.
function exportWeatherDowntimeXls(
  rows: Row[],
  vesselsByType: Record<string, VesselLite[]>,
  limitsByType: Record<string, TypeLimits>,
  mechConfig: MechConfig,
  locale: "vi" | "en"
) {
  const vi = locale === "vi";
  const typeCode = (slug: string) => ASSESS_TYPES.find((vt) => vt.slug === slug)?.code ?? slug;
  const areaName = (slug: string) => {
    const f = AREAS.find((a) => a.slug === slug);
    return f ? (vi ? f.nameVi : f.nameEn) : slug;
  };
  const esc = (s: unknown) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headers = vi
    ? ["#", "Loại tàu", "Tàu", "Vùng / Mỏ", "Bắt đầu", "Kết thúc", "Thời lượng (ngày)", "GH di chuyển (Hs≤m / gió≤kn)", "GH thi công (Hs≤m / gió≤kn)", "Downtime di chuyển (ngày)", "%", "Downtime thi công (ngày)", "%", "Mechanical (ngày)", "%", "TỔNG downtime (ngày)", "%", "Tổng thời gian (ngày)"]
    : ["#", "Vessel type", "Vessel", "Area / Field", "Start", "Finish", "Duration (days)", "Reloc limit (Hs≤m / wind≤kn)", "Working limit (Hs≤m / wind≤kn)", "Reloc downtime (days)", "%", "Working downtime (days)", "%", "Mechanical (days)", "%", "TOTAL downtime (days)", "%", "Total duration (days)"];

  const th = (label: string) =>
    `<th style="background:#1e4e79;color:#ffffff;font-weight:bold;border:1px solid #17324f;padding:6px 8px;text-align:center;vertical-align:middle">${esc(label)}</th>`;
  const td = (v: unknown, align = "center", extra = "") =>
    `<td style="border:1px solid #b9c6d4;padding:5px 8px;text-align:${align};${extra}">${esc(v)}</td>`;

  const body = rows
    .map((r, i) => {
      const m = computeRow(r, vesselsByType, limitsByType, mechConfig);
      const vesselName = r.vesselId === "typical" ? (vi ? "Điển hình" : "Typical") : m.vessel?.displayName ?? r.vesselId;
      const relocLim = `${m.limits.relocation.hs} / ${m.limits.relocation.windKn}`;
      const workLim = `${m.limits.working.hs} / ${m.limits.working.windKn}`;
      const zebra = i % 2 ? "background:#f4f8fb;" : "";
      return (
        "<tr>" +
        td(i + 1, "center", zebra) +
        td(typeCode(r.type), "center", zebra) +
        td(vesselName, "left", zebra) +
        td(areaName(r.area), "left", zebra) +
        td(r.start, "center", zebra) +
        td(r.finish, "center", zebra) +
        td(m.duration, "center", zebra + "font-weight:bold;") +
        td(relocLim, "center", zebra) +
        td(workLim, "center", zebra) +
        td(m.relocWDT.toFixed(1), "right", zebra) +
        td(pctOf(m.relocWDT, m.relocSpan) + "%", "right", zebra) +
        td(m.workingWDT.toFixed(1), "right", zebra) +
        td(pctOf(m.workingWDT, m.workSpan) + "%", "right", zebra) +
        td(m.mechDays.toFixed(1), "right", zebra) +
        td(Math.round(m.mechRate * 1000) / 10 + "%", "right", zebra) +
        td(m.totalDT.toFixed(1), "right", "background:#fce4d6;font-weight:bold;color:#c0504d;") +
        td(pctOf(m.totalDT, m.duration) + "%", "right", "background:#fce4d6;font-weight:bold;color:#c0504d;") +
        td((m.duration + m.totalDT).toFixed(1), "right", zebra + "font-weight:bold;") +
        "</tr>"
      );
    })
    .join("");

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const title = vi ? "PHÂN TÍCH WEATHER DOWNTIME" : "WEATHER DOWNTIME ANALYSIS";
  const note = vi
    ? `Xuất ngày ${stamp} · Offshore Fleet Platform (POS) · Mechanical downtime đồng đều ${mechConfig.rateUnknown}% cho mọi tàu · Downtime thời tiết = 100% − (khả dụng gió × khả dụng sóng).`
    : `Exported ${stamp} · Offshore Fleet Platform (POS) · Flat mechanical downtime ${mechConfig.rateUnknown}% for every vessel · Weather downtime = 100% − (wind availability × wave availability).`;

  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8">` +
    `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Weather Downtime</x:Name>` +
    `<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->` +
    `</head><body>` +
    `<table border="1" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">` +
    `<tr><td colspan="18" style="background:#0f2a43;color:#ffffff;font-size:16pt;font-weight:bold;padding:10px;text-align:center">${esc(title)}</td></tr>` +
    `<tr><td colspan="18" style="background:#eef3f8;color:#33475b;font-style:italic;padding:6px 8px">${esc(note)}</td></tr>` +
    `<tr>${headers.map(th).join("")}</tr>` +
    body +
    `</table></body></html>`;

  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weather-downtime-${stamp}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WeatherDowntimePage() {
  const { t, locale } = useLanguage();
  const { vesselsByType } = useVesselData();
  const idRef = useRef(1);
  const [rows, setRows] = useState<Row[]>(() => [newRow(idRef.current++)]);

  // Live limits table + mechanical coefficients from Google Sheets (falls back to bundled).
  const [limitsByType, setLimitsByType] = useState<Record<string, TypeLimits>>(defaultLimitsByType);
  const [mechConfig, setMechConfig] = useState<MechConfig>(defaultMechConfig);
  const [limitsRemote, setLimitsRemote] = useState(false);

  useEffect(() => {
    if (!WD_LIMITS_CSV_URL) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(WD_LIMITS_CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = parseCsv(await res.text());
        const parsed = limitsFromCsvRows(rows);
        if (!cancelled && parsed) {
          setLimitsByType({ ...defaultLimitsByType, ...parsed });
          setMechConfig(mechFromCsvRows(rows));
          setLimitsRemote(true);
        }
      } catch (e) {
        console.warn("[WeatherLimits] Không tải được từ Google Sheets, dùng mặc định:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill from a vessel detail page: /weather-downtime?type=<slug>&vessel=<id>
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const type = q.get("type");
    const vessel = q.get("vessel");
    if (!type && !vessel) return;
    const validType = type && defaultLimitsByType[type] ? type : null;
    const list = validType ? vesselsByType[validType] ?? [] : [];
    const vid = vessel && list.some((v) => v.id === vessel) ? vessel : "typical";
    setRows((rs) => rs.map((r, i) => (i === 0 ? { ...r, type: validType ?? r.type, vesselId: vid } : r)));
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(id: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <PageHeader backHref="/" backLabel={t("backHome")} title={t("wdTitle")} subtitle={t("wdSubtitle")} />

      {/* Method + rules */}
      <div className="mb-6 space-y-2 rounded-xl2 border border-border bg-surface-2 p-4 text-xs text-ink-soft">
        <p className="flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0 text-brand-400" />{t("wdMethodNote")}</p>
        <p className="flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0 text-brand-400" />{t("wdSetupNote")}</p>
        <p className="flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0 text-brand-400" />
          {locale === "vi"
            ? `Mechanical downtime: đồng đều ${mechConfig.rateUnknown}% cho mọi tàu (× thời lượng).`
            : `Mechanical downtime: flat ${mechConfig.rateUnknown}% for every vessel (× duration).`}
        </p>
      </div>

      {/* Default limits reference */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="brand-headline text-on-photo text-sm text-ink">{t("wdDefaultLimits")}</h2>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-ink-soft"
          title={limitsRemote ? t("wdLimitsLiveHint") : t("wdLimitsBundledHint")}
        >
          {limitsRemote ? <Cloud size={11} /> : <HardDrive size={11} />}
          {limitsRemote ? t("dataSourceLive") : t("dataSourceBundled")}
        </span>
      </div>
      <p className="text-on-photo mb-3 text-xs font-medium text-ink-soft">{t("wdDefaultLimitsNote")}</p>
      <div className="mb-8 overflow-x-auto rounded-xl2 border border-border bg-surface-2">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-ink-soft">
              <th className="p-2 text-left">{t("wdVesselType")}</th>
              <th className="p-2 text-right">{t("wdRelocation")} — Hs (m)</th>
              <th className="p-2 text-right">Wind (kn)</th>
              <th className="p-2 text-right">{t("wdWorking")} — Hs (m)</th>
              <th className="p-2 text-right">Wind (kn)</th>
            </tr>
          </thead>
          <tbody>
            {ASSESS_TYPES.map((vt) => {
              const l = limitsByType[vt.slug] ?? defaultLimitsByType[vt.slug];
              return (
                <tr key={vt.slug} className="border-b border-border/50">
                  <td className="p-2 font-medium text-ink">{vt.code}{!l.fromReference && <span className="ml-1 text-[10px] text-ink-soft">(giả định)</span>}</td>
                  <td className="p-2 text-right text-ink-soft">{l.relocation.hs}</td>
                  <td className="p-2 text-right text-ink-soft">{l.relocation.windKn}</td>
                  <td className="p-2 text-right text-ink-soft">{l.working.hs}</td>
                  <td className="p-2 text-right text-ink-soft">{l.working.windKn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {prefilled && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-2.5 text-xs text-ink">
          <Info size={14} className="mt-0.5 shrink-0 text-brand-400" />
          <span>{t("wdPrefillNote")}</span>
        </div>
      )}

      {/* Register */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="brand-headline text-on-photo text-sm text-ink">{t("wdRegister")}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportWeatherDowntimeXls(rows, vesselsByType, limitsByType, mechConfig, locale)}
            disabled={AREAS.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-40"
            title={t("wdExportExcelHint")}
          >
            <FileSpreadsheet size={14} /> {t("wdExportExcel")}
          </button>
          <button
            onClick={() => setRows((rs) => [...rs, newRow(idRef.current++)])}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
          >
            <Plus size={14} /> {t("wdAddRow")}
          </button>
        </div>
      </div>

      {AREAS.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-ink-soft">
          {t("wdNoAreas")}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <RowCard key={r.id} idx={i + 1} row={r} onChange={(p) => update(r.id, p)} onRemove={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} canRemove={rows.length > 1} vesselsByType={vesselsByType} limitsByType={limitsByType} mechConfig={mechConfig} />
          ))}
        </div>
      )}
    </div>
  );
}

function RowCard({
  idx,
  row,
  onChange,
  onRemove,
  canRemove,
  vesselsByType,
  limitsByType,
  mechConfig,
}: {
  idx: number;
  row: Row;
  onChange: (p: Partial<Row>) => void;
  onRemove: () => void;
  canRemove: boolean;
  vesselsByType: Record<string, { id: string; displayName: string }[]>;
  limitsByType: Record<string, TypeLimits>;
  mechConfig: MechConfig;
}) {
  const { t, locale } = useLanguage();
  const vesselList = vesselsByType[row.type] ?? [];
  const { limits, mechRate, duration, relocSpan, workSpan, relocWDT, workingWDT, mechDays, totalDT } = computeRow(
    row,
    vesselsByType,
    limitsByType,
    mechConfig
  );
  const fieldName = (f: OffshoreField) => (locale === "vi" ? f.nameVi : f.nameEn);

  return (
    <div className="rounded-xl2 border border-border bg-surface-2 p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">{idx}</span>
        {canRemove && (
          <button onClick={onRemove} className="rounded-lg p-1 text-ink-soft transition hover:bg-surface-3 hover:text-accent" title={t("wdRemove")}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Field label={t("wdVesselType")}>
          <select value={row.type} onChange={(e) => onChange({ type: e.target.value, vesselId: "typical" })} className={selCls}>
            {ASSESS_TYPES.map((vt) => <option key={vt.slug} value={vt.slug}>{vt.code}</option>)}
          </select>
        </Field>
        <Field label={t("wdVessel")}>
          <select value={row.vesselId} onChange={(e) => onChange({ vesselId: e.target.value })} className={selCls}>
            <option value="typical">{t("wdTypical")}</option>
            {vesselList.map((v) => <option key={v.id} value={v.id}>{v.displayName}</option>)}
          </select>
        </Field>
        <Field label={t("wdArea")}>
          <select value={row.area} onChange={(e) => onChange({ area: e.target.value })} className={selCls}>
            {AREAS.map((f) => <option key={f.slug} value={f.slug}>{fieldName(f)}</option>)}
          </select>
        </Field>
        <Field label={t("wdStart")}>
          <input type="date" value={row.start} onChange={(e) => onChange({ start: e.target.value })} className={selCls} />
        </Field>
        <Field label={t("wdFinish")}>
          <input type="date" value={row.finish} onChange={(e) => onChange({ finish: e.target.value })} className={selCls} />
        </Field>
        <Field label={t("wdSetupDays")}>
          <input type="number" step="1" min="0" value={row.setupDays} onChange={(e) => onChange({ setupDays: Math.max(0, parseInt(e.target.value) || 0) })} className={selCls} />
        </Field>
        <Field label={t("wdProbability")}>
          <input type="number" step="0.05" min="0" max="1" value={row.relocProb} onChange={(e) => onChange({ relocProb: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })} className={selCls} />
        </Field>
      </div>

      {/* Limits used */}
      <p className="mt-3 text-[11px] text-ink-soft">
        {t("wdRelocation")}: Hs ≤ {limits.relocation.hs} m, gió ≤ {limits.relocation.windKn} kn ({limits.relocationSource === "vessel" ? t("wdLimitsFromVessel") : t("wdLimitsFromType")}) · {t("wdWorking")}: Hs ≤ {limits.working.hs} m, gió ≤ {limits.working.windKn} kn ({limits.workingSource === "vessel" ? t("wdLimitsFromVessel") : t("wdLimitsFromType")})
        {" · "}Mechanical {Math.round(mechRate * 1000) / 10}%
      </p>

      {/* Results */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Result label={t("wdDuration")} value={`${duration}`} unit={t("wdDaysUnit")} />
        <Result label={`${t("wdRelocation")} (${relocSpan}d)`} value={relocWDT.toFixed(1)} unit={t("wdDaysUnit")} sub={`${pctOf(relocWDT, relocSpan)}%`} />
        <Result label={`${t("wdWorking")} (${workSpan}d)`} value={workingWDT.toFixed(1)} unit={t("wdDaysUnit")} sub={`${pctOf(workingWDT, workSpan)}%`} />
        <Result label={t("wdMechanical")} value={mechDays.toFixed(1)} unit={t("wdDaysUnit")} sub={`${Math.round(mechRate * 1000) / 10}%`} />
        <Result label={t("wdTotalDowntime")} value={totalDT.toFixed(1)} unit={t("wdDaysUnit")} sub={`${pctOf(totalDT, duration)}%`} accent />
        <Result label={t("wdTotalDuration")} value={(duration + totalDT).toFixed(1)} unit={t("wdDaysUnit")} accent />
      </div>
    </div>
  );
}

const selCls = "w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function Result({ label, value, unit, sub, accent }: { label: string; value: string; unit: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${accent ? "border-accent/40 bg-accent/10" : "border-border bg-surface"}`}>
      <p className="text-[10px] text-ink-soft">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${accent ? "text-accent" : "text-ink"}`}>{value} <span className="text-[10px] font-normal text-ink-soft">{unit}</span></p>
      {sub && <p className="text-[10px] text-ink-soft">{sub}</p>}
    </div>
  );
}
