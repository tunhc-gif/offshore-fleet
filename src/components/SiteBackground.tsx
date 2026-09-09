import { asset } from "@/lib/asset";

// Brand imagery fixed behind every screen: PTSC Guardian (DLB) with two tugs.
// Two viewport-fixed layers sit BEHIND all content (negative z-index):
//   • the photo, blurred + slightly scaled so blurred edges never reveal a seam;
//   • a theme-coloured scrim on top of it so text/cards stay fully readable.
// The image src goes through asset() so it resolves under the deploy basePath
// (e.g. /offshore-fleet/) on GitHub Pages, not just at the domain root.
export default function SiteBackground() {
  return (
    <>
      <div
        aria-hidden
        className="site-bg"
        style={{ backgroundImage: `url("${asset("/brand/ptsc-guardian-bg.webp")}")` }}
      />
      <div aria-hidden className="site-bg-scrim" />
    </>
  );
}
