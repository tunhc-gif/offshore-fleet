// LLM assist layer for the AI Agent (optional; active only when a proxy is set).
//
// GROUNDING CONTRACT — the model never supplies vessel data:
//   • parse:     NL question -> conditions/sort chosen from AI_SCHEMA only.
//                Everything is re-validated in structuredFromSpecs; unknown
//                fields/tokens are dropped, and all numbers come from the dataset.
//   • summarize: a short prose answer written ONLY from the vessel rows we pass in
//                (name + the few fields already matched). It is advisory text shown
//                above the authoritative cards/CSV, which always come from the data.
//
// Any network/parse error returns null so the caller falls back to the
// deterministic rule-based engine — the agent must never break or stall.

import { JubVessel } from "@/data/jubVessels";
import { Vessel } from "@/data/vessels";
import { AI_PROXY_URL, AI_PROXY_ENABLED, AI_PROXY_TIMEOUT_MS } from "@/config/aiProxy";
import {
  AI_SCHEMA,
  LlmConditionSpec,
  LlmSortSpec,
  StructuredResult,
  structuredFromSpecs,
} from "@/lib/aiAgentQuery";
import { Locale } from "@/lib/i18n";

type ParsePayload = {
  intent?: "filter" | "advice" | "unknown";
  conditions?: LlmConditionSpec[];
  sort?: LlmSortSpec;
  canonicalVi?: string;
  canonicalEn?: string;
};

async function callProxy<T>(mode: string, body: Record<string, unknown>): Promise<T | null> {
  if (!AI_PROXY_ENABLED) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_PROXY_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_PROXY_URL.replace(/\/$/, "")}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ...body }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // timeout, offline, CORS, 5xx — silently fall back
  } finally {
    clearTimeout(timer);
  }
}

// Discriminated outcome so the UI can tell the three cases apart and stay honest:
//  • "ok"      — the model mapped the question and the engine found a filter.
//  • "unknown" — the model understood but this is NOT answerable from stored data
//                (or nothing valid survived validation) → the UI says "I don't know".
//  • "error"   — network/timeout/parse failure → silent fallback to rule-based.
export type LlmParseOutcome =
  | { status: "ok"; result: StructuredResult; canonical: string }
  | { status: "unknown" }
  | { status: "error" };

/** Ask the model to map a free-form question onto the allow-listed schema, then
 *  build a StructuredResult through the deterministic engine. */
export async function llmParseToStructured(
  query: string,
  locale: Locale,
  vessels: JubVessel[]
): Promise<LlmParseOutcome> {
  const payload = await callProxy<ParsePayload>("parse", { query, locale, schema: AI_SCHEMA });
  if (!payload) return { status: "error" };
  if (payload.intent === "unknown") return { status: "unknown" };
  const result = structuredFromSpecs(payload.conditions ?? [], payload.sort ?? null, vessels);
  // Model claimed a filter but nothing valid survived validation → be honest, not misleading.
  if (!result) return { status: "unknown" };
  const canonical = (locale === "vi" ? payload.canonicalVi : payload.canonicalEn) || "";
  return { status: "ok", result, canonical };
}

// Compact, data-only view of a vessel sent to the summarizer. No free text beyond
// what is already stored, so the model has nothing to invent from.
function vesselFacts(v: Vessel) {
  const pick = (x: unknown) => {
    const s = String(x ?? "").trim();
    return s && !/không tìm thấy|không áp dụng/i.test(s) ? s : null;
  };
  return {
    name: v.displayName,
    type: pick(v.idType),
    flag: pick(v.idFlag),
    owner: pick(v.idOwner),
    loa: pick(v.dimLoa),
    beam: pick(v.dimWidth),
    pob: pick(v.accPobMax),
    mainCrane: pick(v.craneMainSwl),
    bollardPull: pick(v.bollardPullT),
    dp: pick(v.pwrDpClass),
    year: pick(v.idYear),
  };
}

/** Grounded prose summary of an already-computed result set. Returns null on any
 *  failure. The caller still renders the real cards regardless of this text. */
export async function llmSummarize(
  query: string,
  locale: Locale,
  matched: Vessel[],
  conditionText: string
): Promise<string | null> {
  if (!AI_PROXY_ENABLED) return null;
  const facts = matched.slice(0, 20).map(vesselFacts);
  const payload = await callProxy<{ summary?: string }>("summarize", {
    query,
    locale,
    conditionText,
    total: matched.length,
    vessels: facts,
  });
  const s = (payload?.summary || "").trim();
  return s.length > 0 ? s : null;
}
