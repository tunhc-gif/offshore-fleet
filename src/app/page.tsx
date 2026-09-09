"use client";

import { Ship, Globe2, CloudRain } from "lucide-react";
import BlockCard from "@/components/BlockCard";
import { useLanguage } from "@/context/LanguageContext";
import { useVesselData } from "@/context/VesselDataContext";
import { countries } from "@/data/countries";

export default function HomePage() {
  const { t } = useLanguage();
  const { allVessels } = useVesselData();

  return (
    <div className="relative flex flex-col items-center pt-10 sm:pt-16">
      <span className="absolute right-0 top-0 -z-10 hidden h-64 w-64 rotate-12 bg-brand-500/5 diagonal-panel sm:block" />
      <div className="hero-veil max-w-2xl rounded-2xl px-6 py-5 text-center">
        <span className="diagonal-tag mx-auto mb-4 inline-block h-2 w-10 bg-accent" />
        <h1 className="brand-headline text-2xl text-ink sm:text-3xl">{t("heroTitle")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{t("heroSubtitle")}</p>
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
