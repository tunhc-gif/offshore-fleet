"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Wind, Waves, CalendarDays, AlertTriangle, Info } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LocationMap from "@/components/LocationMap";
import { useLanguage } from "@/context/LanguageContext";
import {
  offshoreCountries,
  getField,
  getFieldWeather,
  windUnitLabel,
  MONTHS,
} from "@/data/offshoreAreas";
import {
  monthlyAvailability,
  combinedAvailability,
  typicalRange,
  seasonExtremes,
  cumulative,
} from "@/lib/weather";

function ratingColor(pct: number): string {
  if (pct >= 80) return "#16a34a";
  if (pct >= 60) return "#d9a406";
  if (pct >= 40) return "#ea7317";
  return "#e4002b";
}

// intensity 0..1 for a heatmap cell given the "effective occurrence" driving the colour
function heatIntensity(occ: number): number {
  return Math.min(1, occ / 25);
}
function heatColor(intensity: number): string {
  return `color-mix(in srgb, var(--brand-500) ${Math.round(intensity * 100)}%, transparent)`;
}

export default function FieldDetailPage({
  params,
}: {
  params: { country: string; field: string };
}) {
  const { t, locale } = useLanguage();
  const country = offshoreCountries.find((c) => c.slug === params.country);
  const field = getField(params.country, params.field);
  const weather = field ? getFieldWeather(field.slug) : undefined;

  const [windLimit, setWindLimit] = useState(
    field?.defaultWindLimit ?? (weather?.windUnit === "ms" ? 12 : 20)
  );
  const [hsLimit, setHsLimit] = useState(field?.defaultHsLimit ?? 1.5);
  const [tab, setTab] = useState<"wind" | "wave">("wind");
  const [mode, setMode] = useState<"heatmap" | "raw">("heatmap");
  const [freqMode, setFreqMode] = useState<"frequency" | "cumulative">("frequency");

  if (!country || !field) return notFound();

  const name = locale === "vi" ? field.nameVi : field.nameEn;

  if (!weather) {
    return (
      <div>
        <PageHeader backHref={`/offshore-area/${country.slug}`} backLabel={t("back")} title={name} subtitle={field.region} />
        <h2 className="brand-headline mb-3 text-sm text-ink">{t("mapTitle")}</h2>
        <div className="mb-6">
          <LocationMap lat={field.mapLat} lng={field.mapLng} name={name} />
        </div>
        <div className="rounded-xl2 border border-dashed border-border bg-surface-2 p-10 text-center text-sm text-ink-soft">
          {t("noDataDesc")}
        </div>
      </div>
    );
  }

  const wUnit = windUnitLabel(weather.windUnit);

  // ---- computed weather summaries ----
  const wr = typicalRange(weather.wind, weather.windBins);
  const hr = typicalRange(weather.wave, weather.waveBins);
  // Season favourability is ranked by wave height (Hs) — the governing parameter
  // for most marine operations — so the "rough season" reflects real operability
  // (e.g. monsoon/swell), not a secondary wind signal.
  const season = seasonExtremes(weather.wave, weather.waveBins, MONTHS);

  // per-month availability driven by the operational limits
  const rows = MONTHS.map((mo, m) => {
    const wa = monthlyAvailability(weather.wind[m], weather.windBins, windLimit);
    const ha = monthlyAvailability(weather.wave[m], weather.waveBins, hsLimit);
    const comb = combinedAvailability(wa, ha);
    return { mo, wa, ha, comb, down: Math.round((100 - comb) * 10) / 10 };
  });

  const bins = tab === "wind" ? weather.windBins : weather.waveBins;
  const dist = tab === "wind" ? weather.wind : weather.wave;

  return (
    <div>
      <PageHeader
        backHref={`/offshore-area/${country.slug}`}
        backLabel={t("back")}
        title={`${name.toUpperCase()} — ${country.flag} ${locale === "vi" ? country.nameVi : country.nameEn}`}
        subtitle={field.region}
      />

      {field.sample && (
        <div className="cta-accent mb-5 flex items-start gap-2 rounded-xl px-4 py-3 text-xs text-ink">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>{t("sampleDataBanner")}</span>
        </div>
      )}

      {/* Metadata */}
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl2 border border-border bg-surface-2 p-5 text-xs sm:grid-cols-3">
        {[
          [t("latLon"), `${field.lat} / ${field.lon}`],
          [t("waterDepth"), field.waterDepth],
          [t("nearestPort"), field.nearestPort],
          [t("dataKind"), field.dataKind],
          [t("statPeriod"), field.statPeriod],
          [t("lastUpdated"), field.lastUpdated],
          [t("windMeta"), field.windMeta],
          [t("waveMeta"), field.waveMeta],
          [t("dataSource"), field.dataSource],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-ink-soft">{k}</p>
            <p className="font-medium text-ink">{v}</p>
          </div>
        ))}
      </div>

      {/* Location map */}
      <h2 className="brand-headline mb-3 text-sm text-ink">{t("mapTitle")}</h2>
      <div className="mb-8">
        <LocationMap lat={field.mapLat} lng={field.mapLng} name={name} />
      </div>

      {/* Weather Overview */}
      <h2 className="brand-headline mb-3 text-sm text-ink">{t("weatherOverview")}</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewCard icon={<Wind size={16} />} label={t("typicalWind")} value={`${wr.label} ${wUnit}`} />
        <OverviewCard icon={<Waves size={16} />} label={t("typicalWave")} value={`${hr.label} m`} />
        <OverviewCard icon={<CalendarDays size={16} />} label={t("bestSeason")} value={season.bestMonths.join(", ")} />
        <OverviewCard icon={<AlertTriangle size={16} />} label={t("severeSeason")} value={season.severeMonths.join(", ")} accent />
      </div>

      {/* Annual Workability Calendar (driven by the limits below) */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="brand-headline text-sm text-ink">{t("annualWorkability")}</h2>
        <span className="text-[11px] text-ink-soft">
          {t("basedOnLimits")}: {t("wind")} ≤ {windLimit} {wUnit} · Hs ≤ {hsLimit} m
        </span>
      </div>
      <div className="mb-8 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {rows.map((r) => (
          <div key={r.mo} className="overflow-hidden rounded-lg border border-border text-center">
            <div className="py-1 text-[11px] font-semibold text-ink">{r.mo}</div>
            <div className="py-2 text-xs font-bold text-white" style={{ backgroundColor: ratingColor(r.comb) }}>
              {r.comb}%
            </div>
            <div className="py-1 text-[10px] text-ink-soft">↓ {r.down}%</div>
          </div>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap gap-3 text-[11px] text-ink-soft">
        <Legend c="#16a34a" label={`${t("availability")} ≥ 80%`} />
        <Legend c="#d9a406" label="60–79%" />
        <Legend c="#ea7317" label="40–59%" />
        <Legend c="#e4002b" label="< 40%" />
      </div>

      {/* Wind & Wave Distribution */}
      <h2 className="brand-headline mb-3 text-sm text-ink">{t("windWaveDistribution")}</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg options={[["wind", t("windDistribution")], ["wave", t("waveDistribution")]]} value={tab} onChange={(v) => setTab(v as "wind" | "wave")} />
        <Seg options={[["heatmap", t("heatmap")], ["raw", t("rawData")]]} value={mode} onChange={(v) => setMode(v as "heatmap" | "raw")} />
        {mode === "heatmap" && (
          <Seg options={[["frequency", t("frequency")], ["cumulative", t("cumulative")]]} value={freqMode} onChange={(v) => setFreqMode(v as "frequency" | "cumulative")} />
        )}
      </div>

      <div className="mb-8 overflow-x-auto rounded-xl2 border border-border bg-surface-2 p-3">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="p-1 text-left font-semibold text-ink-soft">{tab === "wind" ? `${t("wind")} (${wUnit})` : `Hs (m)`}</th>
              {MONTHS.map((mo) => (
                <th key={mo} className="p-1 text-center font-semibold text-ink-soft">{mo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bins.map((b, bi) => (
              <tr key={b.label}>
                <td className="whitespace-nowrap p-1 font-medium text-ink">{b.label}</td>
                {MONTHS.map((mo, m) => {
                  const val = freqMode === "cumulative" ? cumulative(dist[m])[bi] : dist[m][bi];
                  if (mode === "raw") {
                    return <td key={mo} className="p-1 text-center text-ink-soft">{val > 0 ? val : "·"}</td>;
                  }
                  // effective occurrence driving the colour (cumulative is 0–100, scaled down)
                  const intensity = heatIntensity(freqMode === "cumulative" ? val / 4 : val);
                  // keep the number readable: white on dark cells, ink on light cells
                  const textColor = intensity > 0.5 ? "#ffffff" : "var(--ink)";
                  return (
                    <td
                      key={mo}
                      className="p-1 text-center font-medium"
                      title={`${mo} · ${b.label} ${tab === "wind" ? wUnit : "m"} · ${t("occurrence")}: ${val}%`}
                      style={{ backgroundColor: heatColor(intensity), color: textColor }}
                    >
                      {val >= 10 ? Math.round(val) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Operational Limit Assessment */}
      <h2 className="brand-headline mb-3 text-sm text-ink">{t("operationalLimit")}</h2>
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl2 border border-border bg-surface-2 p-4">
        <label className="text-xs">
          <span className="mb-1 block text-ink-soft">{t("windLimit")} ({wUnit})</span>
          <input
            type="number"
            value={windLimit}
            onChange={(e) => setWindLimit(parseFloat(e.target.value) || 0)}
            className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-ink focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-ink-soft">{t("waveLimit")} (Hs, m)</span>
          <input
            type="number"
            step="0.1"
            value={hsLimit}
            onChange={(e) => setHsLimit(parseFloat(e.target.value) || 0)}
            className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-ink focus:border-brand-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-border bg-surface-2">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-ink-soft">
              <th className="p-2 text-left">{t("month")}</th>
              <th className="p-2 text-right">{t("windAvailability")}</th>
              <th className="p-2 text-right">{t("waveAvailability")}</th>
              <th className="p-2 text-right">{t("combined")}</th>
              <th className="p-2 text-right">{t("downtime")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mo} className="border-b border-border/50">
                <td className="p-2 font-medium text-ink">{r.mo}</td>
                <td className="p-2 text-right text-ink-soft">{r.wa}%</td>
                <td className="p-2 text-right text-ink-soft">{r.ha}%</td>
                <td className="p-2 text-right font-semibold" style={{ color: ratingColor(r.comb) }}>{r.comb}%</td>
                <td className="p-2 text-right text-ink-soft">{r.down}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-soft">
        <Info size={13} className="mt-0.5 shrink-0" />
        {t("combinedCaveat")}
      </p>
    </div>
  );
}

function OverviewCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl2 border border-border bg-surface-2 p-4">
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${accent ? "bg-accent text-white" : "bg-brand-500 text-white"}`}>
        {icon}
      </div>
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: c }} />
      {label}
    </span>
  );
}

function Seg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === v ? "bg-brand-500 text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
