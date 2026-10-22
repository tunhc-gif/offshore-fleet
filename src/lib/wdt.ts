// Where the Weather Downtime tool lives.
//
// On the PUBLIC GitHub Pages build we set NEXT_PUBLIC_WDT_URL to the gated Cloudflare
// Pages copy (e.g. https://offshore-fleet.pages.dev/weather-downtime). Then the entry
// links point there and the GitHub-Pages /weather-downtime page just redirects to it,
// so the tool is only usable behind the Cloudflare access gate.
//
// Empty / unset (dev, and the Cloudflare build itself — where the middleware does the
// gating) ⇒ the local /weather-downtime route is used as normal.
export const WDT_EXTERNAL = process.env.NEXT_PUBLIC_WDT_URL || "";

/** Fully-resolved href for the Weather Downtime tool (absolute when external, else basePath-prefixed local route). */
export function wdtHref(query = ""): string {
  if (WDT_EXTERNAL) return WDT_EXTERNAL + query;
  const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${bp}/weather-downtime${query}`;
}
