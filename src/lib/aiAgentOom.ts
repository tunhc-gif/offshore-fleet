// AI Agent — Q&A over the Saudi Aramco Offshore Operations Manual (OOM Rev.3).
//
// The manual is a controlled document and the repo is public, so NO manual content
// lives in this file: the knowledge base is fetched at question time from the gated
// endpoint /kb/oom (decrypted server-side for approved users only). This module only
// holds generic search logic + a Vietnamese→English maritime term dictionary.
//
// Deterministic retrieval, no generation: answers are (1) curated key facts that were
// verified verbatim against the manual, and (2) the manual's own passages ranked by
// BM25, always with section number + printed page.

export type OomFact = {
  id: string;
  k: string[][]; // keyword groups (normalized, no diacritics); every group must match
  vi: string;
  en: string;
  sec: string;
  title: string;
  page: number;
  quote: string;
};
type OomSection = { id: string; title: string; page: number };
type OomChunk = { s: number; t: string };
export type OomKb = {
  v: number;
  doc: { title: string; rev: string; date: string; classification: string; pages: number };
  sections: OomSection[];
  chunks: OomChunk[];
  facts: OomFact[];
};
export type OomHit = { secId: string; title: string; page: number; snippet: string; score: number };
export type OomResult = { facts: OomFact[]; hits: OomHit[]; docLabel: string };

export class OomAccessError extends Error {}
export class OomUnavailableError extends Error {}

/** lowercase, strip Vietnamese diacritics (đ→d), collapse spaces */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Intent -------------------------------------------------------------------
// Strong signals: clearly about the manual / Aramco operating rules.
const OOM_STRONG =
  /aramco|\boom\b|operations? manual|so tay van hanh|quy dinh|quy trinh|thu tuc|theo manual|theo tai lieu|ras tanura|tanajib|juaymah|abu ali|jizan|\bduba\b|jeddah|west pier|\bukc\b|under ?keel|safety zone|vung an toan|\bh2s\b|medevac|saudization|saudi hoa|iktva|double berth|cap doi|go ?\/? ?no ?go|on-?hire|critical lift|sea state|hours of (work|rest)|gio nghi|nuoc uong|drinking water|lan bao hoa|saturation|giam sat lan|diving supervisor|rig-?move|bunkering|tiep nhien lieu|pratique|isps|passage plan|vts\b/;
// Rule-question words — combined with a maritime topic they also route here.
const OOM_RULE = /(quy dinh|yeu cau|bat buoc|duoc phep|cho phep|co duoc|toi da|toi thieu|gioi han|phai|nhu the nao|the nao|bao lau|bao nhieu lan|required|requirement|allowed|maximum|minimum|must|shall|procedure|rule)/;
const OOM_TOPIC =
  /(lan|diving|dp\b|dinh vi|truc thang|helicopter|helideck|neo|anchor|keo|tow|sa lan|barge|jack|tu nang|chan|toc do|speed|cang|pier|nhien lieu|fuel|su co|incident|khan cap|emergency|chay|fire|cuu|rescue|thuyen truong|master|thuyen vien|crew|si quan|officer|hang|cargo|o nhiem|pollution|rac|waste|nang|lift|cau|crane|hanh khach|passenger|chuyen nguoi|transfer|ve sinh|y te|medical)/;

export function isOomStrong(q: string): boolean {
  return OOM_STRONG.test(norm(q));
}
export function isOomRuleQuestion(q: string): boolean {
  const n = norm(q);
  return OOM_RULE.test(n) && OOM_TOPIC.test(n);
}

// ---- Vietnamese → English term expansion -----------------------------------------
// Checked on the diacritic-PRESERVING text first (cẩu = crane vs cầu = pier/gangway).
const VI_EXACT: [RegExp, string][] = [
  [/cẩu/, "crane cranes lifting lift"],
  [/cầu cảng|cầu tàu/, "pier jetty berth wharf"],
  [/cầu dẫn|cầu thang|cầu bù/, "gangway"],
];
// Then on normalized (no-diacritic) text.
const VI_DICT: [RegExp, string][] = [
  [/toc do|chay nhanh/, "speed knots"],
  [/hai ly/, "knots nautical mile"],
  [/vung an toan/, "safety zone 500m"],
  [/ukc|duoi day|day tau|khoang nuoc/, "under keel clearance ukc"],
  [/duong ong|\bong\b/, "pipeline pipelines subsea"],
  [/cong trinh ngam/, "subsea installations"],
  [/tho lan/, "diver divers diving"],
  [/\blan\b/, "diving dive diver"],
  [/bao hoa/, "saturation"],
  [/nang ha|jacking/, "jacking jack"],
  [/\bnang\b/, "lift lifting"],
  [/truc thang|helicopter/, "helicopter helideck"],
  [/san do|bai dap/, "helideck"],
  [/mat neo|tuot neo|dut neo|roi neo/, "anchor loss lost emergency"],
  [/ket neo|vuong neo|neo mac/, "anchor fouled"],
  [/\bneo\b/, "anchor anchoring anchorage mooring"],
  [/tau keo|lai keo|\bkeo\b/, "towing tug tow"],
  [/sa lan/, "barge barges"],
  [/tu nang|\bjub\b|jack.?up/, "jack-up self-elevating barge jacking"],
  [/\bchan\b/, "legs leg spud"],
  [/\blun\b/, "penetration"],
  [/khao sat/, "survey"],
  [/day bien/, "seabed"],
  [/thoi tiet/, "weather forecast"],
  [/\bgio\b/, "wind"],
  [/\bsong\b/, "wave waves sea swell"],
  [/tam nhin|suong mu/, "visibility fog"],
  [/dong chay/, "current"],
  [/thuy trieu/, "tide tidal"],
  [/\bcang\b/, "port pier harbor facility"],
  [/cap cang|cap cau|cap tau/, "berthing alongside berth"],
  [/cap doi|cap ghep/, "double berthing"],
  [/nhien lieu|\bdau\b/, "fuel bunkering bunker"],
  [/nuoc uong|nuoc ngot/, "drinking water potable"],
  [/\brac\b|chat thai/, "waste garbage disposal"],
  [/o nhiem|tran dau|dau tran/, "pollution oil spill"],
  [/su co|tai nan/, "incident accident"],
  [/bao cao|thong bao/, "report reporting notification"],
  [/khan cap/, "emergency"],
  [/chua chay|cuu hoa|\bchay\b/, "fire firefighting"],
  [/cuu sinh|xuong cuu/, "lifeboat liferaft lifesaving"],
  [/ao phao|phao cuu/, "lifejacket pfd buoy"],
  [/dien tap/, "drill drills exercise"],
  [/roi xuong bien|nguoi roi/, "man overboard rescue"],
  [/\bcuu\b|cuu nan|cuu ho/, "rescue"],
  [/y te|so cuu|benh vien|thuoc/, "medical hospital first aid medicine"],
  [/cap cuu|so tan/, "medevac evacuation"],
  [/hanh khach/, "passenger passengers"],
  [/chuyen nguoi|dua nguoi/, "personnel transfer basket"],
  [/giay phep/, "permit work permit"],
  [/phan tich an toan|\bjsa\b/, "job safety analysis jsa"],
  [/khi doc|h2s/, "h2s hydrogen sulfide gas"],
  [/hut thuoc/, "smoking"],
  [/gio lam|gio nghi|nghi ngoi|met moi/, "hours rest work fatigue"],
  [/thuyen truong/, "master"],
  [/may truong/, "chief engineer"],
  [/si quan/, "officer officers"],
  [/thuyen vien/, "crew seafarers"],
  [/dao tao|huan luyen/, "training"],
  [/chung chi|chung nhan/, "certificate certificates certification"],
  [/giay to|tai lieu|ho so/, "documents documentation"],
  [/kiem tra|thanh tra|danh gia/, "inspection audit assessment"],
  [/bao duong|sua chua/, "maintenance repair"],
  [/hong may|su co may|tau hong/, "breakdown"],
  [/lien lac|vo tuyen|bo dam/, "communication communications radio vhf"],
  [/hanh trinh|tuyen duong/, "passage plan planning route"],
  [/hai do/, "chart charts"],
  [/bien gioi/, "border borders international"],
  [/dinh vi dong|\bdp\b/, "dp dynamic positioning"],
  [/vi tri/, "position location"],
  [/\blech\b/, "excursion drift"],
  [/canh bao|bao dong/, "warning alarm"],
  [/hop dong/, "contract contracts"],
  [/thay the tau|thay tau/, "substitution"],
  [/tau truc/, "standby"],
  [/hang hoa|\bhang\b/, "cargo manifest"],
  [/thu tuc cang|xuat nhap/, "clearance entry pratique"],
  [/an ninh/, "security isps"],
  [/lam quen/, "familiarization"],
  [/tieng on/, "noise"],
  [/an toan/, "safety safe"],
];

const STOP = new Set(
  "the a an of to and or in on for be is are shall should by with as at from any all this that which it its will may not if when than then other such their there these those has have been was were into per also can must".split(" ")
);

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

export function expandQuery(q: string): string[] {
  const lower = q.toLowerCase();
  const n = norm(q);
  const terms: string[] = [];
  for (const [re, en] of VI_EXACT) if (re.test(lower)) terms.push(...en.split(" "));
  for (const [re, en] of VI_DICT) if (re.test(n)) terms.push(...en.split(" "));
  // English words / abbreviations typed directly (ukc, dp, h2s, 500m, west pier…)
  terms.push(...tokens(n).filter((t) => /^[a-z0-9-]+$/.test(t) && t.length >= 2));
  return [...new Set(terms.flatMap((t) => tokens(t)))];
}

// ---- Index + search ---------------------------------------------------------------
type Index = { kb: OomKb; tf: Map<string, number>[]; len: number[]; df: Map<string, number>; avg: number };

export function buildIndex(kb: OomKb): Index {
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  const df = new Map<string, number>();
  for (const c of kb.chunks) {
    const sec = kb.sections[c.s];
    const toks = [...tokens(c.t), ...tokens(sec?.title ?? ""), ...tokens(sec?.title ?? "")]; // title counts double
    const m = new Map<string, number>();
    for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(m);
    len.push(toks.length);
  }
  const avg = len.reduce((a, b) => a + b, 0) / Math.max(1, len.length);
  return { kb, tf, len, df, avg };
}

function snippetFor(text: string, terms: string[], width = 420): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;
  const lower = flat.toLowerCase();
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < flat.length - 80; i += 40) {
    const win = lower.slice(i, i + width);
    const sc = terms.reduce((s, t) => s + (win.includes(t) ? 1 : 0), 0);
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  }
  const start = best === 0 ? 0 : flat.indexOf(" ", best) + 1;
  return (start > 0 ? "… " : "") + flat.slice(start, start + width).trim() + (start + width < flat.length ? " …" : "");
}

// Short keywords (≤4 chars, e.g. "lan", "dp", "ukc") must match a whole word so that
// "lan" does not fire inside "plan"/"islan…"; longer phrases match as substrings.
function hasAlt(n: string, alt: string): boolean {
  // Numbers match on digit boundaries so "500" hits "500m" / "500 m" but not "1500".
  if (/^\d+$/.test(alt)) return new RegExp(`(^|[^0-9])${alt}([^0-9]|$)`).test(n);
  if (alt.length > 4) return n.includes(alt);
  return new RegExp(`(^|[^a-z0-9])${alt.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^a-z0-9]|$)`).test(n);
}

function matchFacts(kb: OomKb, q: string): OomFact[] {
  const n = norm(q);
  const scored = kb.facts
    .map((f) => {
      let score = 0;
      for (const group of f.k) {
        const hit = group.filter((alt) => hasAlt(n, alt));
        if (hit.length === 0) return { f, score: 0 };
        // A matched number (500, 100, 48…) is far more specific than a generic word.
        score += Math.max(...hit.map((h) => (/^\d+$/.test(h) ? 12 : h.length)));
      }
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((x) => x.f);
}

let kbPromise: Promise<Index> | null = null;

async function fetchKb(): Promise<OomKb> {
  const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const res = await fetch(`${bp}/kb/oom`, { credentials: "same-origin", cache: "no-store" });
  const ct = res.headers.get("content-type") || "";
  if (res.status === 401) throw new OomAccessError("auth");
  if (res.ok && ct.includes("application/json")) return (await res.json()) as OomKb;
  // Local development (no Cloudflare functions): optional plaintext copy that is
  // git-ignored (public/kb-dev/ — never committed).
  if (process.env.NODE_ENV === "development") {
    const dev = await fetch(`${bp}/kb-dev/oom.json`, { cache: "no-store" });
    if (dev.ok) return (await dev.json()) as OomKb;
  }
  throw new OomUnavailableError(String(res.status));
}

export function loadOom(): Promise<Index> {
  if (!kbPromise) {
    kbPromise = fetchKb().then(buildIndex);
    kbPromise.catch(() => {
      kbPromise = null; // allow a retry after the user gets access
    });
  }
  return kbPromise;
}

export function searchOom(idx: Index, q: string, maxHits = 3): OomResult {
  const { kb } = idx;
  const facts = matchFacts(kb, q);
  const terms = expandQuery(q);
  const N = kb.chunks.length;
  const k1 = 1.4;
  const b = 0.75;
  const scores: { i: number; s: number }[] = [];
  for (let i = 0; i < N; i++) {
    const tf = idx.tf[i];
    let s = 0;
    for (const t of terms) {
      const f = tf.get(t);
      if (!f) continue;
      const df = idx.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      s += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * idx.len[i]) / idx.avg));
    }
    if (s > 0) scores.push({ i, s });
  }
  scores.sort((a, b2) => b2.s - a.s);

  // One passage per section, skip sections already covered by a matched fact.
  const factSecs = new Set(facts.flatMap((f) => f.sec.split("/").map((x) => x.trim())));
  const hits: OomHit[] = [];
  const usedSec = new Set<number>();
  const MIN_SCORE = 4;
  for (const { i, s } of scores) {
    if (hits.length >= maxHits || s < MIN_SCORE) break;
    const c = kb.chunks[i];
    if (usedSec.has(c.s)) continue;
    const sec = kb.sections[c.s];
    if (facts.length > 0 && factSecs.has(sec.id)) continue;
    usedSec.add(c.s);
    hits.push({ secId: sec.id, title: sec.title, page: sec.page, snippet: snippetFor(c.t, terms), score: Math.round(s * 10) / 10 });
  }
  return { facts, hits, docLabel: `Saudi Aramco Offshore Operations Manual — ${kb.doc.rev} (${kb.doc.date})` };
}
