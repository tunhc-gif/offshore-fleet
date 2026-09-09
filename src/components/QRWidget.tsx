"use client";

import { useState } from "react";
import { X, Smartphone } from "lucide-react";
import { asset } from "@/lib/asset";
import { useLanguage } from "@/context/LanguageContext";

// Floating "scan to open on mobile" card, fixed at the bottom-left corner.
// Desktop only (hidden on phones — you're already on mobile there). Dismissible.
export default function QRWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="glass-card fixed bottom-5 left-5 z-40 hidden w-[168px] flex-col items-center gap-2 rounded-2xl p-3 lg:flex">
      <button
        onClick={() => setOpen(false)}
        aria-label="Close"
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-ink-soft transition hover:bg-surface-3 hover:text-ink"
      >
        <X size={13} />
      </button>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-600">
        <Smartphone size={13} className="text-brand-500" />
        Mobile
      </div>
      <div className="rounded-lg bg-white p-2 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/brand/qr-mobile.svg")} alt="QR code" width={112} height={112} className="block h-28 w-28" />
      </div>
      <p className="text-center text-[10px] leading-tight text-ink-soft">{t("qrMobileLabel")}</p>
    </div>
  );
}
