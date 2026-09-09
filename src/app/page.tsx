"use client";

import { Ship, Globe2, CloudRain, ShieldCheck } from "lucide-react";
import BlockCard from "@/components/BlockCard";
import { useLanguage } from "@/context/LanguageContext";
import { useVesselData } from "@/context/VesselDataContext";
import { countries } from "@/data/countries";

export default function HomePage() {
  const { t } = useLanguage();
  const { allVessels } = useVesselData();

  // Two-tone headline like the reference: last word in bright sky-blue.
  const titleParts = t("heroTitle").trim().split(/\s+/);
  const titleTail = titleParts.length > 1 ? titleParts.pop()! : "";
  const titleHead = titleParts.join(" ");

  return (
    <div className="relative flex flex-col items-center pt-8 sm:pt-14">
      <div className="glass-panel mx-auto max-w-3xl rounded-3xl px-7 py-9 text-center sm:px-12 sm:py-12">
        <span className="glass-pill mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600 sm:mb-6">
          <ShieldCheck size={14} className="text-brand-500" />
          {t("tagline")}
        </span>
        <h1 className="brand-headline text-3xl leading-[1.05] text-ink sm:text-5xl">
          {titleHead}
          {titleTail && (
            <>
              {" "}
              <span style={{ color: "var(--brand-bright)" }}>{titleTail}</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{t("heroSubtitle")}</p>
      </div>

      <div className="mt-10 grid w-full grid-cols-1 gap-5 sm:grid-cols-3">
        <BlockCard
          href="/vessel"
          icon={Ship}
          title={t("blockVesselTitle")}
          desc={t("blockVesselDesc")}
          badge={`${allVessels.length} ${t("vesselCount")}`}
        />
        <BlockCard
          href="/offshore-area"
          icon={Globe2}
          title={t("blockOffshoreTitle")}
          desc={t("blockOffshoreDesc")}
          badge={`${countries.length}`}
        />
        <BlockCard
          href="/weather-downtime"
          icon={CloudRain}
          title={t("blockWeatherTitle")}
          desc={t("blockWeatherDesc")}
        />
      </div>
    </div>
  );
}
