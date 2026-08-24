// Offline marine router: A* over a bundled land/sea bit-grid (src/data/seaGrid.json)
// so distances follow the sea and go AROUND land, straits and continents.
// Grid + routing run client-side; the grid JSON is lazy-loaded on first use.

type Grid = { lon0: number; lat0: number; dLon: number; dLat: number; nx: number; ny: number; land: Uint8Array };

let gridPromise: Promise<Grid> | null = null;

async function loadGrid(): Promise<Grid> {
  if (!gridPromise) {
    gridPromise = import("@/data/seaGrid.json").then((m) => {
      const g = (m as { default?: unknown }).default ?? m;
      const raw = g as { lon0: number; lat0: number; dLon: number; dLat: number; nx: number; ny: number; bits: string };
      const bin = typeof atob === "function" ? atob(raw.bits) : Buffer.from(raw.bits, "base64").toString("binary");
      const land = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) land[i] = bin.charCodeAt(i);
      return { lon0: raw.lon0, lat0: raw.lat0, dLon: raw.dLon, dLat: raw.dLat, nx: raw.nx, ny: raw.ny, land };
    });
  }
  return gridPromise;
}

const R_NM = 3440.065;
const rad = (d: number) => (d * Math.PI) / 180;
function gc(ax: number, ay: number, bx: number, by: number): number {
  const dLat = rad(by - ay), dLng = rad(bx - ax);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(ay)) * Math.cos(rad(by)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Minimal binary min-heap keyed by f-score.
class Heap {
  private a: { f: number; k: number }[] = [];
  get size() { return this.a.length; }
  push(f: number, k: number) {
    const a = this.a; a.push({ f, k }); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): number {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) { a[0] = last; let i = 0; const n = a.length; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < n && a[l].f < a[m].f) m = l; if (r < n && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top.k;
  }
}

export type SeaRouteResult = { nm: number; method: "sea" | "great-circle" };

export async function seaDistance(lon1: number, lat1: number, lon2: number, lat2: number): Promise<SeaRouteResult> {
  const straight = gc(lon1, lat1, lon2, lat2);
  let g: Grid;
  try { g = await loadGrid(); } catch { return { nm: straight, method: "great-circle" }; }

  const { lon0, lat0, dLon, dLat, nx, ny, land } = g;
  const isLand = (ix: number, iy: number) => (ix < 0 || iy < 0 || ix >= nx || iy >= ny) ? true : !!(land[(iy * nx + ix) >> 3] & (1 << ((iy * nx + ix) & 7)));
  const cLon = (ix: number) => lon0 + (ix + 0.5) * dLon;
  const cLat = (iy: number) => lat0 + (iy + 0.5) * dLat;
  const toCell = (lon: number, lat: number): [number, number] => [Math.round((lon - lon0) / dLon - 0.5), Math.round((lat - lat0) / dLat - 0.5)];
  const inGrid = (lon: number, lat: number) => lon >= lon0 && lon <= lon0 + nx * dLon && lat >= lat0 && lat <= lat0 + ny * dLat;

  // Endpoints outside the covered region → fall back to great-circle.
  if (!inGrid(lon1, lat1) || !inGrid(lon2, lat2)) return { nm: straight, method: "great-circle" };

  const snap = (ix: number, iy: number): [number, number] | null => {
    if (!isLand(ix, iy)) return [ix, iy];
    for (let r = 1; r < 80; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = ix + dx, y = iy + dy; if (!isLand(x, y)) return [x, y];
      }
    }
    return null;
  };

  let [sx, sy] = toCell(lon1, lat1), [gx, gy] = toCell(lon2, lat2);
  const s = snap(sx, sy), gl = snap(gx, gy);
  if (!s || !gl) return { nm: straight, method: "great-circle" };
  [sx, sy] = s; [gx, gy] = gl;

  const N = nx * ny;
  const gScore = new Float64Array(N).fill(Infinity);
  const key = (x: number, y: number) => y * nx + x;
  const h = (x: number, y: number) => gc(cLon(x), cLat(y), cLon(gx), cLat(gy));
  const heap = new Heap();
  const startK = key(sx, sy);
  gScore[startK] = 0;
  heap.push(h(sx, sy), startK);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const goalK = key(gx, gy);

  let found = false;
  while (heap.size) {
    const ck = heap.pop();
    if (ck === goalK) { found = true; break; }
    const cx = ck % nx, cy = (ck - cx) / nx;
    const cg = gScore[ck];
    for (const [dx, dy] of dirs) {
      const x = cx + dx, y = cy + dy;
      if (isLand(x, y)) continue;
      const nk = key(x, y);
      const ng = cg + gc(cLon(cx), cLat(cy), cLon(x), cLat(y));
      if (ng < gScore[nk]) { gScore[nk] = ng; heap.push(ng + h(x, y), nk); }
    }
  }

  if (!found || !isFinite(gScore[goalK])) return { nm: straight, method: "great-circle" };
  // Add the short great-circle hops from real endpoints to their snapped sea cells.
  const endsExtra = gc(lon1, lat1, cLon(sx), cLat(sy)) + gc(lon2, lat2, cLon(gx), cLat(gy));
  return { nm: gScore[goalK] + endsExtra, method: "sea" };
}
