// Build offline land/sea grids for marine A* routing.
//  - seaGrid.json        : REGIONAL 0.1° (fleet area) — fast & accurate, primary.
//  - seaGridGlobal.json  : GLOBAL 0.25° with Suez/Panama + key straits carved —
//                          used only when an endpoint is outside the region.
// Rasterizes Natural-Earth land (world-atlas 10m) via active-edge-table scanline.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "..", "src", "data");
const require = createRequire(import.meta.url);
const world = require("world-atlas/land-10m.json");
const land = topojson.feature(world, world.objects.land);

// All land edges once (segments with dy != 0), sorted by ymin.
const ALL_EDGES = [];
for (const f of land.features) {
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const poly of polys) for (const ring of poly) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      if (y1 === y2) continue;
      ALL_EDGES.push({ ymin: Math.min(y1, y2), ymax: Math.max(y1, y2), x1, y1, x2, y2 });
    }
  }
}
ALL_EDGES.sort((a, b) => a.ymin - b.ymin);

function buildGrid({ lon0, lon1, lat0, lat1, D, wrap, carves }) {
  const nx = Math.round((lon1 - lon0) / D), ny = Math.round((lat1 - lat0) / D);
  const bits = new Uint8Array(Math.ceil((nx * ny) / 8));
  const idx = (ix, iy) => iy * nx + ix;
  const setLand = (ix, iy) => { const k = idx(ix, iy); bits[k >> 3] |= 1 << (k & 7); };
  const clrLand = (ix, iy) => { const k = idx(ix, iy); bits[k >> 3] &= ~(1 << (k & 7)); };
  let ptr = 0, active = [];
  for (let iy = 0; iy < ny; iy++) {
    const Y = lat0 + (iy + 0.5) * D;
    while (ptr < ALL_EDGES.length && ALL_EDGES[ptr].ymin <= Y) active.push(ALL_EDGES[ptr++]);
    if (active.length) active = active.filter((e) => e.ymax > Y);
    if (!active.length) continue;
    const xs = [];
    for (const e of active) xs.push(e.x1 + (Y - e.y1) * (e.x2 - e.x1) / (e.y2 - e.y1));
    xs.sort((a, b) => a - b);
    for (let s = 0; s + 1 < xs.length; s += 2) {
      let ixa = Math.ceil((xs[s] - lon0) / D - 0.5), ixb = Math.floor((xs[s + 1] - lon0) / D - 0.5);
      if (ixa < 0) ixa = 0; if (ixb >= nx) ixb = nx - 1;
      for (let ix = ixa; ix <= ixb; ix++) setLand(ix, iy);
    }
  }
  // carve channels (open sea) along canal/strait centerlines
  const cellOf = (lon, lat) => [Math.round((lon - lon0) / D - 0.5), Math.round((lat - lat0) / D - 0.5)];
  for (const { pts, r } of carves || []) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [la1, lo1] = pts[i], [la2, lo2] = pts[i + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(la2 - la1, lo2 - lo1) / (D / 2)));
      for (let t = 0; t <= steps; t++) {
        const [cx, cy] = cellOf(lo1 + (lo2 - lo1) * t / steps, la1 + (la2 - la1) * t / steps);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, y = cy + dy; if (x >= 0 && x < nx && y >= 0 && y < ny) clrLand(x, y);
        }
      }
    }
  }
  ptr = 0; // (ALL_EDGES ptr already consumed for this grid; recreate fresh copy next call)
  let lc = 0; for (let k = 0; k < nx * ny; k++) if (bits[k >> 3] & (1 << (k & 7))) lc++;
  const b64 = Buffer.from(bits).toString("base64");
  return { meta: { lon0, lat0, dLon: D, dLat: D, nx, ny, wrap: !!wrap, bits: b64 }, landPct: (lc / (nx * ny) * 100).toFixed(1), sizeKB: (b64.length / 1024).toFixed(0) };
}

// scanline consumes ALL_EDGES.ptr; reset by re-sorting reference each call — simplest: re-sort not needed,
// just reset ptr via fresh closure. We restore ptr by re-sorting is overkill; instead re-run needs edges from 0.
// buildGrid uses local ptr starting 0 each call — OK because it reads ALL_EDGES by index from 0.

// --- REGIONAL 0.1° (fleet operating area) ---
const regional = buildGrid({ lon0: 30, lon1: 130, lat0: -15, lat1: 32, D: 0.1, wrap: false, carves: [] });
fs.writeFileSync(path.join(DATA, "seaGrid.json"), JSON.stringify(regional.meta));
console.log(`regional 0.1°: ${regional.meta.nx}x${regional.meta.ny}, land ${regional.landPct}%, ${regional.sizeKB} KB`);

// --- GLOBAL 0.25° with canals + key straits carved ---
const carves = [
  { pts: [[31.30, 32.31], [31.05, 32.35], [30.60, 32.34], [30.20, 32.55], [29.95, 32.57]], r: 1 }, // Suez
  { pts: [[9.38, -79.92], [9.20, -79.85], [9.05, -79.68], [8.95, -79.58], [8.88, -79.51]], r: 1 },   // Panama
  { pts: [[35.95, -5.9], [35.95, -5.6], [36.0, -5.3], [36.05, -5.0]], r: 1 },                        // Gibraltar
  { pts: [[12.5, 43.0], [12.6, 43.3], [12.7, 43.5]], r: 1 },                                          // Bab-el-Mandeb
  { pts: [[26.55, 56.2], [26.6, 56.5], [26.5, 56.8]], r: 1 },                                         // Hormuz
  { pts: [[1.2, 103.9], [2.5, 101.5], [4.5, 99.5], [6.0, 98.0]], r: 1 },                              // Malacca/Singapore
  { pts: [[-5.9, 105.9], [-6.1, 105.6]], r: 1 },                                                       // Sunda
  { pts: [[-8.5, 115.9], [-8.8, 115.6]], r: 1 },                                                       // Lombok
];
const global = buildGrid({ lon0: -180, lon1: 180, lat0: -78, lat1: 84, D: 0.25, wrap: true, carves });
fs.writeFileSync(path.join(DATA, "seaGridGlobal.json"), JSON.stringify(global.meta));
console.log(`global 0.25°: ${global.meta.nx}x${global.meta.ny}, land ${global.landPct}%, ${global.sizeKB} KB`);
console.log("✔ wrote seaGrid.json + seaGridGlobal.json");
