"use client";

import { useState, useRef, useEffect } from "react";
import { QrCode } from "lucide-react";
import { asset } from "@/lib/asset";
import { useLanguage } from "@/context/LanguageContext";

// Small "QR" button in the header. Click to reveal a popover with the QR code
// that opens the site on a phone. Closes on outside-click / Escape.
export default function QRButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="QR"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
          open ? "border-brand-500 bg-brand-50 text-brand-600" : "border-border bg-surface-2 text-ink-soft hover:border-brand-500 hover:text-ink"
        }`}
        title={t("qrMobileLabel")}
      >
        <QrCode size={15} />
        <span className="font-semibold">QR</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-border bg-surface-2 p-3 shadow-card">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-600">
            <QrCode size={13} className="text-brand-500" />
            Mobile
          </p>
          <div className="rounded-xl bg-white p-2.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/brand/qr-mobile.svg")} alt="QR code" width={176} height={176} className="mx-auto block h-44 w-44" />
          </div>
          <p className="mt-2 text-center text-[11px] leading-tight text-ink-soft">{t("qrMobileLabel")}</p>
        </div>
      )}
    </div>
  );
}
