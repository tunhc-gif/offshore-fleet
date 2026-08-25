"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Info, Radar, ExternalLink, CloudRain, ChevronRight, Camera } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import VesselPhotos from "@/components/VesselPhotos";
import ClassSurvey from "@/components/ClassSurvey";
import VoyageCalculator from "@/components/VoyageCalculator";
import vesselPhotos from "@/data/vesselPhotos.json";
import { useLanguage } from "@/context/LanguageContext";
import { useVesselData } from "@/context/VesselDataContext";
import { formatVal } from "@/data/jubVessels";
import { vesselSections } from "@/lib/vesselFields";

function getCleanImo(idImo: string | number | undefined): string | null {
  if (idImo === undefined || idImo === null) return null;
  const digits = String(idImo).trim();
  return /^\d{7}$/.test(digits) ? digits : null;
}

// Average of the speeds stated in the spec's speed field (e.g. "14 knots (max);
// 10 knots (port)" → 12). Prefers knot-tagged values; falls back to any number
// in a plausible speed range. Returns null when no usable speed is present.
function averageSpeedKn(speedKn: string | number | undefined): number | null {
  const s = String(speedKn ?? "");
  if (!s || /không tìm thấy|không áp dụng/i.test(s)) return null;
  let vals = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:knots?|kts?|kn|hải\s*lý|hai\s*ly)/gi)]
    .map((m) => parseFloat(m[1].replace(",", ".")));
  if (!vals.length) {
    vals = [...s.matchAll(/(\d+(?:[.,]\d+)?)/g)]
      .map((m) => parseFloat(m[1].replace(",", ".")))
      .filter((n) => n >= 3 && n <= 40);
  }
  vals = vals.filter((n) => n >= 1 && n <= 45);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export default function VesselDetailPage({
  params,
}: {
  params: { type: string; vesselId: string };
}) {
  const { t, locale } = useLanguage();
  const { getVessel, vesselsForType, ready } = useVesselData();
  const vessel = getVessel(params.vesselId);

  // While remote (Google Sheets) data is still loading, a vessel that exists only
  // in the sheet won't be found yet — show a light loading state instead of 404.
  if (!vessel) {
    if (!ready) {
      return <div className="py-20 text-center text-sm text-ink-soft">…</div>;
    }
    return notFound();
  }

  const imo = getCleanImo(vessel.idImo);
  // Default speed: the vessel's own average of stated knots; if the spec has no
  // speed, fall back to the average speed of the same vessel group (from the
  // fleet), not a fixed number.
  const ownAvgSpeed = averageSpeedKn(vessel.speedKn);
  let groupAvgSpeed: number | null = null;
  if (ownAvgSpeed === null) {
    const peers = vesselsForType(vessel.category)
      .map((v) => averageSpeedKn(v.speedKn))
      .filter((n): n is number => n !== null);
    if (peers.length) groupAvgSpeed = Math.round((peers.reduce((a, b) => a + b, 0) / peers.length) * 10) / 10;
  }
  const defaultSpeed = ownAvgSpeed ?? groupAvgSpeed;
  const photoMap = vesselPhotos as Record<string, string[]>;
  const photos =
    (imo && photoMap[imo]) ||
    photoMap[vessel.id] ||
    photoMap[String(vessel.idImo).trim()] ||
    [];

  return (
    <div>
      <PageHeader
        backHref={`/vessel/${params.type}`}
        backLabel={t("back")}
        title={vessel.displayName}
        subtitle={vessel.idType}
      />

      {vessel.nameNote && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-3 text-xs text-ink-soft">
          <Info size={14} className="mt-0.5 shrink-0 text-brand-400" />
          <span>{vessel.nameNote}</span>
        </div>
      )}

      {photos.length > 0 && <VesselPhotos photos={photos} name={vessel.displayName} />}

      <div className="mb-6 rounded-xl2 border border-border bg-surface-2 p-5 shadow-card">
        <div className="mb-2 flex items-center gap-2">
          <Radar size={16} className="text-brand-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-400">
            {t("trackingTitle")}
          </h3>
        </div>
        <p className="mb-3 text-xs text-ink-soft">{t("trackingDesc")}</p>
        {imo ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
            >
              {t("trackOnMarineTraffic")}
              <ExternalLink size={12} />
            </a>
            <a
              href={`https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}/photos`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand-400"
            >
              <Camera size={12} />
              {t("viewPhotos")}
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <p className="text-xs italic text-ink-soft">{t("trackingNoImo")}</p>
        )}

        <VoyageCalculator defaultSpeed={defaultSpeed} />
      </div>

      <ClassSurvey imo={imo} society={vessel.idClassSociety} notation={vessel.idNotation} />

      <Link
        href={`/weather-downtime?type=${params.type}&vessel=${vessel.id}`}
        className="group mb-6 flex items-center justify-between gap-3 rounded-xl2 border border-accent/40 bg-accent/10 p-5 shadow-card transition hover:border-accent"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <CloudRain size={18} />
          </span>
          <div>
            <h3 className="brand-headline text-sm text-ink">{t("wdCtaTitle")}</h3>
            <p className="mt-1 text-xs text-ink-soft">{t("wdCtaDesc")}</p>
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-accent transition group-hover:translate-x-0.5" />
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {vesselSections
          .filter((section) =>
            section.fields.some((f) => {
              const val = vessel[f.key];
              if (val === undefined || val === null || val === "") return false;
              const s = String(val).trim();
              // Hide a whole section when every field is either N/A or genuinely unknown.
              return s !== "Không áp dụng" && s !== "Không tìm thấy";
            })
          )
          .map((section) => (
          <div key={section.titleKey} className="rounded-xl2 border border-border bg-surface-2 p-5 shadow-card">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-400">
              {t(section.titleKey)}
            </h3>
            <dl className="divide-y divide-border">
              {section.fields.map((f) => (
                <div key={String(f.key)} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <dt className="text-ink-soft">{locale === "vi" ? f.labelVi : f.labelEn}</dt>
                  <dd className="text-right font-medium text-ink">
                    {formatVal(vessel[f.key] as string | number, f.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
