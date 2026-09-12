"use client";

import Link from "next/link";
import { Anchor } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import QRButton from "@/components/QRButton";
import { useLanguage } from "@/context/LanguageContext";

export default function Header() {
  const { t } = useLanguage();

  return (
    <header className="header-glass sticky top-0 z-40 border-b border-border backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-card">
            <Anchor size={18} />
          </span>
          <div className="leading-tight">
            <p className="brand-headline text-sm text-ink">{t("appName")}</p>
            <p className="hidden items-center gap-1.5 text-[11px] text-ink-soft sm:flex">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              {t("tagline")}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <QRButton />
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
