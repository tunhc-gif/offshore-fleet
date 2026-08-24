"use client";

import { useMemo, useState } from "react";
import { Route, ArrowRight, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { offshoreFields } from "@/data/offshoreAreas";

type Pt = { id: string; label: string; lat: number; lng: number; group: "port" | "field" };

// Common regional ports (approx. coordinates, decimal degrees).
const PORTS: Pt[] = [
  { id: "vungtau", label: "Vũng Tàu (VN)", lat: 10.35, lng: 107.08, group: "port" },
  { id: "haiphong", label: "Hải Phòng (VN)", lat: 20.86, lng: 106.68, group: "port" },
  { id: "singapore", label: "Singapore", lat: 1.26, lng: 103.83, group: "port" },
  { id: "portklang", label: "Port Klang (MY)", lat: 3.0, lng: 101.4, group: "port" },
  { id: "labuan", label: "Labuan (MY)", lat: 5.28, lng: 115.24, group: "port" },
  { id: "miri", label: "Miri (MY)", lat: 4.4, lng: 113.99, group: "port" },
  { id: "muara", label: "Muara (Brunei)", lat: 5.02, lng: 115.07, group: "port" },
  { id: "songkhla", label: "Songkhla (TH)", lat: 7.2, lng: 100.6, group: "port" },
  { id: "batam", label: "Batam (ID)", lat: 1.08, lng: 104.03, group: "port" },
  { id: "manila", label: "Manila (PH)", lat: 14.58, lng: 120.95, group: "port" },
  { id: "jubail", label: "Jubail (KSA)", lat: 27.02, lng: 49.66, group: "port" },
  { id: "rastanura", label: "Ras Tanura (KSA)", lat: 26.64, lng: 50.16, group: "port" },
  { id: "jebelali", label: "Jebel Ali / Dubai (UAE)", lat: 25.01, lng: 55.06, group: "port" },
  { id: "hamad", label: "Hamad / Doha (QA)", lat: 24.98, lng: 51.6, group: "port" },
];

const R_NM = 3440.065; // Earth radius in nautical miles

function haversineNm(a: Pt, b: Pt): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Parse "10.35, 107.08" or DMS "15°54'11\"N 96°49'00\"E" / "15 54 11 N 96 49 00 E".
function parseCoord(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  if (!s) return null;
  // decimal "lat, lng" or "lat lng"
  const dec = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (dec) {
    const lat = parseFloat(dec[1]);
    const lng = parseFloat(dec[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  // DMS: split on hemisphere letters
  const parts = s.toUpperCase().match(/(-?[\d.]+[^NSEW]*?)([NS])[,;\s]*(-?[\d.]+[^NSEW]*?)([EW])/);
  if (parts) {
    const toDeg = (chunk: string, hemi: string) => {
      const nums = (chunk.match(/[\d.]+/g) || []).map(Number);
      if (!nums.length) return NaN;
      const deg = (nums[0] || 0) + (nums[1] || 0) / 60 + (nums[2] || 0) / 3600;
      return hemi === "S" || hemi === "W" ? -deg : deg;
    };
    const lat = toDeg(parts[1], parts[2]);
    const lng = toDeg(parts[3], parts[4]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      return { lat, lng };
  }
  return null;
}

function fmtDuration(hours: number, vi: boolean): string {
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  if (vi) return d > 0 ? `${d} ngày ${h} giờ` : `${h} giờ`;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

const selCls =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-brand-400 focus:outline-none";

// Module-scope so it is NOT redefined each render (which would drop input focus).
function PointSelect({
  value,
  onChange,
  custom,
  onCustom,
  vi,
  fieldPts,
}: {
  value: string;
  onChange: (v: string) => void;
  custom: string;
  onCustom: (v: string) => void;
  vi: boolean;
  fieldPts: Pt[];
}) {
  return (
    <div className="flex-1 space-y-1">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selCls}>
        <optgroup label={vi ? "Cảng" : "Ports"}>
          {PORTS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </optgroup>
        {fieldPts.length > 0 && (
          <optgroup label={vi ? "Mỏ / vùng biển" : "Fields / areas"}>
            {fieldPts.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
        )}
        <option value="custom">{vi ? "— Toạ độ tự nhập —" : "— Custom coordinates —"}</option>
      </select>
      {value === "custom" && (
        <input
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          placeholder={vi ? 'VD: 10.35, 107.08  hoặc  15°54\'11"N 96°49\'00"E' : 'e.g. 10.35, 107.08  or  15°54\'11"N 96°49\'00"E'}
          className={selCls}
        />
      )}
    </div>
  );
}

export default function VoyageCalculator({ defaultSpeed }: { defaultSpeed: number | null }) {
  const { locale } = useLanguage();
  const vi = locale === "vi";

  const fieldPts: Pt[] = useMemo(
    () =>
      offshoreFields
        .filter((f) => !f.hidden && typeof f.mapLat === "number" && typeof f.mapLng === "number")
        .map((f) => ({
          id: `field:${f.slug}`,
          label: `${vi ? f.nameVi : f.nameEn} (${f.region})`,
          lat: f.mapLat as number,
          lng: f.mapLng as number,
          group: "field" as const,
        })),
    [vi]
  );
  const allPts = useMemo(() => [...PORTS, ...fieldPts], [fieldPts]);
  const findPt = (id: string) => allPts.find((p) => p.id === id) || null;

  const [fromId, setFromId] = useState<string>("vungtau");
  const [toId, setToId] = useState<string>("custom");
  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");
  const [speed, setSpeed] = useState<string>(defaultSpeed ? String(defaultSpeed) : "12");
  const [wf, setWf] = useState<string>("0");

  const resolve = (id: string, custom: string): Pt | null => {
    if (id === "custom") {
      const c = parseCoord(custom);
      return c ? { id: "custom", label: custom, lat: c.lat, lng: c.lng, group: "port" } : null;
    }
    return findPt(id);
  };

  const from = resolve(fromId, fromCustom);
  const to = resolve(toId, toCustom);
  const spd = parseFloat(speed);
  const wfPct = Math.min(50, Math.max(0, parseFloat(wf) || 0));

  const result = useMemo(() => {
    if (!from || !to || !(spd > 0)) return null;
    const nm = haversineNm(from, to);
    const effSpeed = spd * (1 - wfPct / 100);
    const hours = effSpeed > 0 ? nm / effSpeed : 0;
    return { nm, hours };
  }, [from, to, spd, wfPct]);

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-3/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Route size={14} className="text-brand-400" />
        <h4 className="text-xs font-bold uppercase tracking-wide text-brand-400">
          {vi ? "Tính thời gian hành trình (ước tính)" : "Voyage time estimate"}
        </h4>
      </div>

      <div className="flex items-start gap-2">
        <PointSelect value={fromId} onChange={setFromId} custom={fromCustom} onCustom={setFromCustom} vi={vi} fieldPts={fieldPts} />
        <ArrowRight size={14} className="mt-2 shrink-0 text-ink-soft" />
        <PointSelect value={toId} onChange={setToId} custom={toCustom} onCustom={setToCustom} vi={vi} fieldPts={fieldPts} />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          {vi ? "Tốc độ" : "Speed"}
          <input
            type="number"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-brand-400 focus:outline-none"
          />
          kn
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft" title={vi ? "Hệ số thời tiết: giảm tốc độ hiệu dụng" : "Weather factor: reduces effective speed"}>
          W.F
          <input
            type="number"
            value={wf}
            onChange={(e) => setWf(e.target.value)}
            className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-brand-400 focus:outline-none"
          />
          %
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 text-sm">
        {result ? (
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span>
              <span className="text-ink-soft">{vi ? "Quãng đường" : "Distance"}: </span>
              <span className="font-bold text-ink">{Math.round(result.nm).toLocaleString()} NM</span>
            </span>
            <span>
              <span className="text-ink-soft">{vi ? "Thời gian" : "Time"}: </span>
              <span className="font-bold text-brand-400">{fmtDuration(result.hours, vi)}</span>
              <span className="text-ink-soft"> ({(result.hours / 24).toFixed(2)} {vi ? "ngày" : "days"})</span>
            </span>
          </div>
        ) : (
          <p className="text-xs italic text-ink-soft">
            {vi
              ? "Chọn điểm đi/đến và tốc độ > 0 (nếu tự nhập toạ độ, dùng dạng thập phân hoặc độ-phút-giây)."
              : "Pick from/to points and a speed > 0 (for custom coordinates use decimal or DMS)."}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[11px] italic text-ink-soft">
        <AlertTriangle size={12} className="mt-0.5 shrink-0 text-accent" />
        <span>
          {vi
            ? "Ước tính theo đường vòng cung lớn (great-circle) trên mặt cầu — KHÔNG né đất liền, eo biển hay kênh đào, nên với tuyến có bờ chắn giữa quãng đường thực sẽ dài hơn. Dùng để tham khảo nhanh; lập kế hoạch chính thức hãy dùng phần mềm hải trình (vd Netpas)."
            : "Great-circle estimate on a sphere — does NOT avoid land, straits or canals, so real routes past a landmass are longer. For quick reference only; use routing software (e.g. Netpas) for formal planning."}
        </span>
      </div>
    </div>
  );
}
