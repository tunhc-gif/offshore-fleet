"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink, Copy, Check, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// Map a vessel's class-society text to its official public register / record portal.
// These pages let you look up class status, survey status and next drydock by IMO
// (some require pasting the IMO into their own search box).
const SOCIETY_REGISTERS: { match: RegExp; name: string; url: string }[] = [
  { match: /\babs\b|american bureau/i, name: "ABS Record", url: "https://www.eagle.org/portal/#/absrecord/search" },
  { match: /\bdnv\b|det norske|germanischer|\bgl\b/i, name: "DNV Vessel Register", url: "https://vesselregister.dnv.com/vesselregister/vesselregister.html" },
  { match: /lloyd|\blr\b/i, name: "Lloyd's Register – Class Direct", url: "https://www.lr.org/en/class-direct/" },
  { match: /bureau veritas|\bbv\b|veristar/i, name: "Bureau Veritas – VeriSTAR Info", url: "https://marine-offshore.bureauveritas.com/veristarinfo" },
  { match: /classnk|\bnk\b|nippon kaiji/i, name: "ClassNK Register", url: "https://www.classnk.or.jp/register/regstr/regstr_e.aspx" },
  { match: /\brina\b/i, name: "RINA Fleet Register", url: "https://www.rina.org/en/business/marine" },
  { match: /\bccs\b|china classification/i, name: "CCS Register", url: "https://www.ccs.org.cn/ccswzen/" },
  { match: /\bkr\b|korean register/i, name: "Korean Register", url: "https://www.krs.co.kr/eng/" },
  { match: /\birs\b|indian register/i, name: "Indian Register (IRS)", url: "https://www.irclass.org/" },
  { match: /việt|viet|\bvr\b|đăng kiểm/i, name: "Đăng kiểm Việt Nam (VR)", url: "https://www.vr.org.vn/" },
];

function ownRegister(society: string | undefined) {
  const s = String(society ?? "");
  return SOCIETY_REGISTERS.find((r) => r.match.test(s)) ?? null;
}

const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand-400";

export default function ClassSurvey({
  imo,
  society,
  notation,
  equasis,
}: {
  imo: string | null;
  society?: string;
  notation?: string;
  equasis?: {
    clsSociety?: string;
    clsStatus?: string;
    clsSince?: string;
    surveyLast?: string;
    surveyNext?: string;
    pni?: string;
  } | null;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const own = ownRegister(society);

  const clean = (v: string | undefined) => {
    const s = String(v ?? "").trim();
    return s && s !== "Không tìm thấy" && s !== "Không áp dụng" ? s : null;
  };
  const societyVal = clean(society);
  const notationVal = clean(notation);

  function copyImo() {
    if (!imo) return;
    navigator.clipboard?.writeText(imo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mb-6 rounded-xl2 border border-border bg-surface-2 p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck size={16} className="text-brand-400" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-400">{t("classTitle")}</h3>
      </div>
      <p className="mb-3 text-xs text-ink-soft">{t("classDesc")}</p>

      {(societyVal || notationVal) && (
        <dl className="mb-3 divide-y divide-border rounded-lg border border-border bg-surface-3/50">
          {societyVal && (
            <div className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <dt className="text-ink-soft">{t("classSocietyLabel")}</dt>
              <dd className="text-right font-medium text-ink">{societyVal}</dd>
            </div>
          )}
          {notationVal && (
            <div className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <dt className="text-ink-soft">{t("classNotationLabel")}</dt>
              <dd className="text-right font-medium text-ink">{notationVal}</dd>
            </div>
          )}
        </dl>
      )}

      {equasis && (() => {
        const rows: [string, string | undefined][] = [
          [t("clsStatusLabel"), [equasis.clsSociety, equasis.clsStatus].filter(Boolean).join(" — ") || undefined],
          [t("clsSinceLabel"), equasis.clsSince],
          [t("surveyLastLabel"), equasis.surveyLast],
          [t("surveyNextLabel"), equasis.surveyNext],
          [t("pniLabel"), equasis.pni],
        ].filter((r) => clean(r[1])) as [string, string][];
        if (rows.length === 0) return null;
        return (
          <>
            <dl className="mb-2 divide-y divide-border rounded-lg border border-border bg-surface-3/50">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mb-3 text-[11px] italic text-ink-soft">{t("equasisNote")}</p>
          </>
        );
      })()}

      {imo ? (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-ink-soft">IMO</span>
            <code className="rounded bg-surface-3 px-2 py-0.5 font-mono font-semibold text-ink">{imo}</code>
            <button type="button" onClick={copyImo} className={btnGhost} aria-label={t("classCopyImo")}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? t("classCopied") : t("classCopyImo")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Equasis: free aggregator — class society, class status, statutory & PSC by IMO */}
            <a
              href={`https://www.equasis.org/EquasisWeb/restricted/ShipInfo?fs=Search&P_IMO=${imo}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnPrimary}
            >
              Equasis (class status)
              <ExternalLink size={12} />
            </a>
            {own && (
              <a href={own.url} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                {own.name}
                <ExternalLink size={12} />
              </a>
            )}
            {/* GISIS – IMO global integrated shipping info (ship & company particulars) */}
            <a
              href="https://gisis.imo.org/Public/SHIPS/Default.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className={btnGhost}
            >
              IMO GISIS
              <ExternalLink size={12} />
            </a>
          </div>
        </>
      ) : (
        <p className="text-xs italic text-ink-soft">{t("classNoImo")}</p>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-ink-soft">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>{t("classWarn")}</span>
      </div>
    </div>
  );
}
