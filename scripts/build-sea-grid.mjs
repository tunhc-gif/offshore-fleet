// Build an offline land/sea grid (bitmask) for marine A* routing.
// Rasterizes Natural-Earth land (world-atlas land-10m) over the fleet's
// operating region via scanline polygon fill, then packs 1 bit/cell (1=land).
// Output: src/data/seaGrid.json  { lon0, lat0, dLon, dLat, nx, ny, bits(base64) }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "src", "data", "seaGrid.json");
const require = createRequire(import.meta.url);
const world = require("world-atlas/land-10m.json");

// Region covering Middle East Gulf → Indian Ocean → SE Asia → South China Sea.
const LON0 = 30, LON1 = 130, LAT0 = -15, LAT1 = 32;
const D = 0.1;
const nx = Math.round((LON1 - LON0) / D);
const ny = Math.round((LAT1 - LAT0) / D);

const land = topojson.feature(world, world.objects.land);

// Collect polygon rings (outer + holes) whose bbox overlaps our region.
const rings = [];
for (const f of land.features) {
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const poly of polys) {
    for (const ring of poly) {
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      for (const [x, y] of ring) {
        if (x < minLon) minLon = x; if (x > maxLon) maxLon = x;
        if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
      }
      if (maxLon < LON0 - 1 || minLon > LON1 + 1 || maxLat < LAT0 - 1 || minLat > LAT1 + 1) continue;
      rings.push(ring);
    }
  }
}
console.log(`rings in region: ${rings.length}, grid ${nx}x${ny} = ${nx * ny} cells`);

// Pre-extract edges with their lat span for fast scanline lookup.
const edges = [];
for (const ring of rings) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    if (y1 === y2) continue;
    edges.push(y1 < y2 ? [y1, y2, x1, y1, x2, y2] : [y2, y1, x1, y1, x2, y2]);
  }
}
edges.sort((a, b) => a[0] - b[0]);
console.log(`edges: ${edges.length}`);

const bits = new Uint8Array(Math.ceil((nx * ny) / 8));
const setLand = (ix, iy) => { const k = iy * nx + ix; bits[k >> 3] |= 1 << (k & 7); };

for (let iy = 0; iy < ny; iy++) {
  const Y = LAT0 + (iy + 0.5) * D;
  const xs = [];
  for (const e of edges) {
    if (e[0] > Y) break;        // edges sorted by minLat; none further can cross
    if (e[1] <= Y) continue;    // maxLat <= Y → doesn't cross this scanline
    const [, , x1, y1, x2, y2] = e;
    const xi = x1 + (Y - y1) * (x2 - x1) / (y2 - y1);
    xs.push(xi);
  }
  if (!xs.length) continue;
  xs.sort((a, b) => a - b);
  for (let s = 0; s + 1 < xs.length; s += 2) {
    const xa = xs[s], xb = xs[s + 1];
    let ixa = Math.ceil((xa - LON0) / D - 0.5);
    let ixb = Math.floor((xb - LON0) / D - 0.5);
    if (ixa < 0) ixa = 0;
    if (ixb >= nx) ixb = nx - 1;
    for (let ix = ixa; ix <= ixb; ix++) setLand(ix, iy);
  }
}

// quick land stats
let landCount = 0;
for (let k = 0; k < nx * ny; k++) if (bits[k >> 3] & (1 << (k & 7))) landCount++;
console.log(`land cells: ${landCount} (${((landCount / (nx * ny)) * 100).toFixed(1)}%)`);

const b64 = Buffer.from(bits).toString("base64");
fs.writeFileSync(OUT, JSON.stringify({ lon0: LON0, lat0: LAT0, dLon: D, dLat: D, nx, ny, bits: b64 }));
console.log(`✔ wrote ${OUT} (${(b64.length / 1024).toFixed(0)} KB base64)`);

// ---- self-test: A* on the grid ----
const isLand = (ix, iy) => (ix < 0 || iy < 0 || ix >= nx || iy >= ny) ? true : !!(bits[(iy * nx + ix) >> 3] & (1 << ((iy * nx + ix) & 7)));
const cell = (lon, lat) => [Math.round((lon - LON0) / D - 0.5), Math.round((lat - LAT0) / D - 0.5)];
const R = 3440.065, rad = (d) => d * Math.PI / 180;
const cLon = (ix) => LON0 + (ix + 0.5) * D, cLat = (iy) => LAT0 + (iy + 0.5) * D;
function gc(ax, ay, bx, by) { const dLat = rad(by - ay), dLng = rad(bx - ax); const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(ay)) * Math.cos(rad(by)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))); }
function snap(ix, iy) { if (!isLand(ix, iy)) return [ix, iy]; for (let r = 1; r < 60; r++) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = ix + dx, y = iy + dy; if (!isLand(x, y)) return [x, y]; } } return null; }
function astar(lon1, lat1, lon2, lat2) {
  let [sx, sy] = cell(lon1, lat1), [gx, gy] = cell(lon2, lat2);
  const s = snap(sx, sy), g = snap(gx, gy); if (!s || !g) return null; [sx, sy] = s; [gx, gy] = g;
  const key = (x, y) => y * nx + x;
  const gScore = new Map(), came = new Map();
  const h = (x, y) => gc(cLon(x), cLat(y), cLon(gx), cLat(gy));
  const open = [[h(sx, sy), sx, sy]]; gScore.set(key(sx, sy), 0);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cx, cy] = open.splice(bi, 1)[0];
    if (cx === gx && cy === gy) { let d = gScore.get(key(gx, gy)); return d; }
    const cg = gScore.get(key(cx, cy));
    for (const [dx, dy] of dirs) {
      const x = cx + dx, y = cy + dy; if (isLand(x, y)) continue;
      const ng = cg + gc(cLon(cx), cLat(cy), cLon(x), cLat(y));
      if (ng < (gScore.get(key(x, y)) ?? Infinity)) { gScore.set(key(x, y), ng); came.set(key(x, y), key(cx, cy)); open.push([ng + h(x, y), x, y]); }
    }
  }
  return null;
}
console.log("\n--- A* self-test (NM) ---");
const tests = [["VT→Singapore", 107.08, 10.35, 103.83, 1.26], ["VT→Labuan", 107.08, 10.35, 115.24, 5.28], ["VT→Andaman(96.8E,15.9N)", 107.08, 10.35, 96.82, 15.9], ["VT→Jubail", 107.08, 10.35, 49.66, 27.02]];
for (const [n, a, b, c, d] of tests) { const km = astar(a, b, c, d); console.log(`${n}: ${km ? km.toFixed(0) + " NM" : "no route"}`); }
