// AI Agent — "which vessel types are used in region X?"
//
// Answers from the fleet's OPERATING HISTORY (Equasis "areas where the ship was
// seen", monthly, sourced from MarineTraffic / AXS Marine / VesselTracker) stored
// in src/data/vesselEquasis.json. Deterministic: every number is counted from that
// file at question time — nothing is estimated or generated.
//
// "Time worked in a region" = number of distinct months a vessel was seen there
// (vessel-months). Types are ranked by vessel-months.
import { vesselTypes } from "@/data/vesselTypes";
import type { Vessel } from "@/data/vessels";
import type { Confidence } from "@/lib/aiAgentQuery";
import type { Locale } from "@/lib/i18n";

type GeoRow = { date: string; area: string; source?: string };
type EqRec = { geo?: GeoRow[] };
export type EquasisData = Record<string, EqRec>;

// The Equasis file is large (~1 MB raw) and the AI Agent lives on every page, so it
// is loaded lazily — only when someone actually asks a region-usage question.
let eqCache: EquasisData | null = null;
export async function loadEquasis(): Promise<EquasisData> {
  if (!eqCache) eqCache = (await import("@/data/vesselEquasis.json")).default as unknown as EquasisData;
  return eqCache;
}

export type UsageRegion = {
  token: string;
  labelVi: string;
  labelEn: string;
  triggers: RegExp;
  areas: string[]; // Equasis area labels that make up this region
  noteVi?: string;
  noteEn?: string;
};

// ORDER MATTERS: the first region whose trigger matches wins ("south east asia"
// contains "east asia", so Southeast Asia is tested before East Asia).
export const USAGE_REGIONS: UsageRegion[] = [
  {
    token: "middle-east",
    labelVi: "Trung Đông (Vịnh Ba Tư)",
    labelEn: "Middle East (Persian Gulf)",
    triggers: /trung\s*đông|trung\s*dong|middle\s*east|vịnh\s*ba\s*tư|vinh\s*ba\s*tu|persian\s*gulf|arabian\s*gulf|vùng\s*vịnh|vung\s*vinh|ả\s*rập|a\s*rap\s*xe\s*ut|saudi|qatar|\buae\b|emirat|abu\s*dhabi|dubai|kuwait|bahrain|\boman\b/i,
    areas: ["South Asia"],
    noteVi:
      'Equasis/MarineTraffic không có nhãn "Trung Đông" riêng: vùng Vịnh Ba Tư được báo cáo trong nhãn "South Asia" (nhãn này cũng gồm Ấn Độ/Nam Á). Đã kiểm chứng trên đội tàu: tàu cờ/chủ Qatar, Saudi, UAE có ~98% lần ghi nhận là "South Asia".',
    noteEn:
      'Equasis/MarineTraffic has no separate "Middle East" label: the Persian Gulf is reported under "South Asia" (which also covers India/South Asia). Verified on the fleet: Qatar/Saudi/UAE-flagged or -owned vessels are ~98% recorded as "South Asia".',
  },
  {
    token: "southeast-asia",
    labelVi: "Đông Nam Á (gồm Việt Nam, Biển Đông)",
    labelEn: "Southeast Asia (incl. Vietnam, South China Sea)",
    triggers: /đông\s*nam\s*á|dong\s*nam\s*a|south\s*-?\s*east\s*asia|việt\s*nam|viet\s*nam|vietnam|malaysia|singapore|indonesia|thái\s*lan|thai\s*lan|thailand|brunei|myanmar|biển\s*đông|bien\s*dong|south\s*china\s*sea/i,
    areas: ["South East Asia", "Singapore Strait", "Malacca Strait", "South China Sea", "Java Sea", "Makassar Strait", "Bali Sea", "Ceram Sea"],
    noteVi: "Equasis không tách riêng Việt Nam — vùng biển VN nằm trong \"South East Asia\" / \"South China Sea\".",
    noteEn: 'Equasis does not separate Vietnam — Vietnamese waters fall under "South East Asia" / "South China Sea".',
  },
  {
    token: "east-asia",
    labelVi: "Đông Á (Trung Quốc, Hàn Quốc, Nhật Bản)",
    labelEn: "East Asia (China, Korea, Japan)",
    triggers: /đông\s*á|dong\s*a\b|east\s*asia|trung\s*quốc|trung\s*quoc|\bchina\b|hàn\s*quốc|han\s*quoc|korea|nhật\s*bản|nhat\s*ban|japan|đài\s*loan|taiwan/i,
    areas: ["East Asia"],
  },
  {
    token: "west-africa",
    labelVi: "Tây Phi",
    labelEn: "West Africa",
    triggers: /tây\s*phi|tay\s*phi|west\s*africa|nigeria|angola|ghana|cameroon|gabon|congo/i,
    areas: ["West Africa"],
  },
  {
    token: "east-south-africa",
    labelVi: "Đông Phi & Nam Phi",
    labelEn: "East & South Africa",
    triggers: /đông\s*phi|dong\s*phi|nam\s*phi|nam\s*phi|east\s*africa|south\s*africa|mozambique|tanzania|kenya/i,
    areas: ["East Africa", "South_Africa", "South Africa"],
  },
  {
    token: "mediterranean",
    labelVi: "Địa Trung Hải",
    labelEn: "Mediterranean",
    triggers: /địa\s*trung\s*hải|dia\s*trung\s*hai|mediterranean/i,
    areas: ["Mediterranean Sea"],
  },
  {
    token: "europe",
    labelVi: "Châu Âu (Tây & Bắc Âu, Biển Bắc)",
    labelEn: "Europe (West & North, North Sea)",
    triggers: /châu\s*âu|chau\s*au|europe|biển\s*bắc|bien\s*bac|north\s*sea|na\s*uy|norway|hà\s*lan|ha\s*lan|netherlands|\buk\b|anh\s*quốc|scotland/i,
    areas: ["West Europe", "North Europe"],
  },
  {
    token: "americas",
    labelVi: "Châu Mỹ (Vịnh Mexico, Bắc & Nam Mỹ)",
    labelEn: "Americas (Gulf of Mexico, North & South America)",
    triggers: /vịnh\s*mexico|vinh\s*mexico|gulf\s*of\s*mexico|mexico|caribbean|châu\s*mỹ|chau\s*my|bắc\s*mỹ|bac\s*my|nam\s*mỹ|nam\s*my|north\s*america|south\s*america|americas?|brazil/i,
    areas: [
      "Middle America and Gulf of Mexico",
      "North America East Coast",
      "North America West Coast",
      "South America East Coast",
      "South America West Coast",
    ],
  },
  {
    token: "australia",
    labelVi: "Úc & New Zealand",
    labelEn: "Australia & New Zealand",
    triggers: /(^|\s)úc(\s|$|\?|,)|australia|new\s*zea?land|châu\s*đại\s*dương|chau\s*dai\s*duong/i,
    areas: ["Australia and New Zeeland"],
  },
];

// Question is about vessel TYPES / usage in a region (not "list vessels matching specs").
const USAGE_ASK =
  /(loại|kiểu|nhóm|dạng)\s*tàu|tàu\s*(gì|nào|loại\s*nào)|hay\s*(được\s*)?(dùng|sử\s*dụng|su\s*dung|hoạt\s*động|hoat\s*dong|làm\s*việc)|thường\s*(được\s*)?(dùng|sử\s*dụng|hoạt\s*động|làm\s*việc)|phổ\s*biến|pho\s*bien|chủ\s*yếu|chu\s*yeu|hoạt\s*động\s*nhiều|làm\s*việc\s*nhiều|vessel\s*types?|types?\s*of\s*(vessels?|ships?)|commonly|most\s*(common|used|active)|popular|frequently|usually|which\s*(vessels?|ships?)\s*(are\s*)?(used|operat|work)/i;

export function detectUsageRegion(query: string): UsageRegion | null {
  if (!USAGE_ASK.test(query)) return null;
  return USAGE_REGIONS.find((r) => r.triggers.test(query)) ?? null;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
function monthKey(date: string): number | null {
  const m = date.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  return mo ? Number(m[2]) * 100 + mo : null;
}
function keyLabel(k: number, locale: Locale): string {
  const y = Math.floor(k / 100);
  const mo = k % 100;
  return locale === "vi" ? `${String(mo).padStart(2, "0")}/${y}` : `${y}-${String(mo).padStart(2, "0")}`;
}

function eqFor(v: Vessel, EQ: EquasisData): { key: string; rec: EqRec } | null {
  const imo = String(v.idImo ?? "").trim();
  if (/^\d{7}$/.test(imo) && EQ[imo]) return { key: imo, rec: EQ[imo] };
  if (EQ[v.id]) return { key: v.id, rec: EQ[v.id] };
  return null;
}

export type UsageRow = {
  slug: string;
  code: string;
  nameVi: string;
  nameEn: string;
  vessels: number; // vessels of this type seen in the region
  fleetWithHistory: number; // vessels of this type that have any operating history
  months: number; // vessel-months in the region
  share: number; // % of all vessel-months in the region
  avgMonths: number;
  top: string[]; // most active vessel names in the region
};

export type RegionUsage = {
  region: UsageRegion;
  rows: UsageRow[];
  totalMonths: number;
  totalVessels: number;
  vesselsWithHistory: number;
  periodFrom: number | null;
  periodTo: number | null;
  seen: { vessel: Vessel; months: number }[]; // every vessel seen in the region, most active first
};

export function computeRegionUsage(region: UsageRegion, vessels: Vessel[], EQ: EquasisData): RegionUsage {
  const areaSet = new Set(region.areas);
  const usedKeys = new Set<string>(); // same hull listed twice → count once
  const perType = new Map<string, { vessels: number; fleet: number; months: number; ships: { name: string; months: number }[] }>();
  const seen: { vessel: Vessel; months: number }[] = [];
  let withHistory = 0;
  let from: number | null = null;
  let to: number | null = null;

  for (const v of vessels) {
    const eq = eqFor(v, EQ);
    if (!eq || !eq.rec.geo || eq.rec.geo.length === 0 || usedKeys.has(eq.key)) continue;
    usedKeys.add(eq.key);
    withHistory += 1;
    const t = perType.get(v.category) ?? { vessels: 0, fleet: 0, months: 0, ships: [] };
    t.fleet += 1;

    const months = new Set<number>();
    for (const g of eq.rec.geo) {
      const inRegion = g.area.split(",").some((a) => areaSet.has(a.trim()));
      const k = monthKey(g.date);
      if (inRegion && k !== null) months.add(k);
    }
    if (months.size > 0) {
      t.vessels += 1;
      t.months += months.size;
      t.ships.push({ name: v.displayName, months: months.size });
      seen.push({ vessel: v, months: months.size });
      for (const k of months) {
        if (from === null || k < from) from = k;
        if (to === null || k > to) to = k;
      }
    }
    perType.set(v.category, t);
  }

  const totalMonths = [...perType.values()].reduce((s, t) => s + t.months, 0);
  const rows: UsageRow[] = [...perType.entries()]
    .filter(([, t]) => t.months > 0)
    .map(([slug, t]) => {
      const vt = vesselTypes.find((x) => x.slug === slug);
      return {
        slug,
        code: vt?.code ?? slug.toUpperCase(),
        nameVi: vt?.nameVi ?? slug,
        nameEn: vt?.nameEn ?? slug,
        vessels: t.vessels,
        fleetWithHistory: t.fleet,
        months: t.months,
        share: totalMonths ? Math.round((1000 * t.months) / totalMonths) / 10 : 0,
        avgMonths: t.vessels ? Math.round((10 * t.months) / t.vessels) / 10 : 0,
        top: t.ships.sort((a, b) => b.months - a.months).slice(0, 3).map((s) => s.name),
      };
    })
    .sort((a, b) => b.months - a.months);

  seen.sort((a, b) => b.months - a.months);
  return { region, rows, totalMonths, totalVessels: seen.length, vesselsWithHistory: withHistory, periodFrom: from, periodTo: to, seen };
}

export function usageAnswerText(u: RegionUsage, locale: Locale): string {
  const vi = locale === "vi";
  const label = vi ? u.region.labelVi : u.region.labelEn;
  if (u.rows.length === 0) {
    return vi
      ? `Trong lịch sử hoạt động (Equasis) của ${u.vesselsWithHistory} tàu có dữ liệu, chưa có tàu nào được ghi nhận ở ${label}.`
      : `In the operating history (Equasis) of ${u.vesselsWithHistory} vessels with data, none was recorded in ${label}.`;
  }
  const period = u.periodFrom && u.periodTo ? `${keyLabel(u.periodFrom, locale)} – ${keyLabel(u.periodTo, locale)}` : "";
  const top = u.rows
    .slice(0, 3)
    .map((r, i) =>
      vi
        ? `${i + 1}) ${r.code} — ${r.vessels} tàu, ${r.months} tháng-tàu (${r.share}%)`
        : `${i + 1}) ${r.code} — ${r.vessels} vessels, ${r.months} vessel-months (${r.share}%)`
    )
    .join("; ");
  return vi
    ? `Theo lịch sử hoạt động (Equasis) của ${u.vesselsWithHistory} tàu có dữ liệu, ${u.totalVessels} tàu từng làm việc ở ${label}${period ? ` (${period})` : ""}, tổng ${u.totalMonths} tháng-tàu. Loại tàu dùng nhiều nhất: ${top}.`
    : `From the operating history (Equasis) of ${u.vesselsWithHistory} vessels with data, ${u.totalVessels} vessels worked in ${label}${period ? ` (${period})` : ""}, ${u.totalMonths} vessel-months in total. Most used types: ${top}.`;
}

export function usageConfidence(u: RegionUsage): Confidence {
  const isProxy = u.region.token === "middle-east";
  if (u.totalMonths === 0) {
    return {
      level: "low",
      reasonVi: "Không có bản ghi lịch sử hoạt động nào ở vùng này trong dữ liệu Equasis của nền tảng.",
      reasonEn: "No operating-history records for this region in the platform's Equasis data.",
    };
  }
  if (isProxy || u.totalVessels < 10) {
    return {
      level: "medium",
      reasonVi: isProxy
        ? "Đếm trực tiếp từ lịch sử Equasis; vùng Trung Đông dùng nhãn \"South Asia\" làm đại diện (xem ghi chú). Chỉ tính các tàu có IMO và có dữ liệu Equasis."
        : "Đếm trực tiếp từ lịch sử Equasis nhưng số tàu ít — tham khảo xu hướng.",
      reasonEn: isProxy
        ? 'Counted directly from Equasis history; the Middle East uses the "South Asia" label as a proxy (see note). Only vessels with an IMO and Equasis data are counted.'
        : "Counted directly from Equasis history but few vessels — indicative only.",
    };
  }
  return {
    level: "high",
    reasonVi: "Đếm trực tiếp từ lịch sử hoạt động Equasis (theo tháng) của các tàu có IMO.",
    reasonEn: "Counted directly from monthly Equasis operating history of vessels with an IMO.",
  };
}
