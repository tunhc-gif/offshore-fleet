// Offline marine router (A* over bundled land/sea bit-grids), client-side.
//  - Regional 0.1° grid (fleet area, lon 30–130E / lat -15–32N): fast & accurate,
//    used when BOTH endpoints are inside → all fleet routes incl. VN↔Middle East.
//  - Global 0.25° grid (Suez/Panama + key straits carved), loaded only when an
//    endpoint is outside the region → intercontinental / canal routes.
// Falls back to great-circle if no route or an endpoint is off-grid.

type Grid = {
  lon0: number; lat0: number; dLon: number; dLat: number; nx: number; ny: number; wrap: boolean;
  land: Uint8Array; gScore: Float32Array; gen: Int32Array; closed: Int32Array; genCounter: number;
};

const REGION = { lonMin: 30, lonMax: 130, latMin: -15, latMax: 32 };
const promises: Record<string, Promise<Grid> | undefined> = {};

function loadGrid(which: "regional" | "global"): Promise<Grid> {
  if (!promises[which]) {
    const imp = which === "regional" ? import("@/data/seaGrid.json") : import("@/data/seaGridGlobal.json");
    promises[which] = imp.then((m) => {
      const g = ((m as { default?: unknown }).default ?? m) as {
        lon0: number; lat0: number; dLon: number; dLat: number; nx: number; ny: number; wrap?: boolean; bits: string;
      };
      const bin = typeof atob === "function" ? atob(g.bits) : Buffer.from(g.bits, "base64").toString("binary");
      const land = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) land[i] = bin.charCodeAt(i);
      const N = g.nx * g.ny;
      return { lon0: g.lon0, lat0: g.lat0, dLon: g.dLon, dLat: g.dLat, nx: g.nx, ny: g.ny, wrap: !!g.wrap, land, gScore: new Float32Array(N), gen: new Int32Array(N), closed: new Int32Array(N), genCounter: 0 };
    });
  }
  return promises[which]!;
}

const R_NM = 3440.065;
const rad = (d: number) => (d * Math.PI) / 180;
function gc(ax: number, ay: number, bx: number, by: number): number {
  let dx = Math.abs(bx - ax); if (dx > 180) dx = 360 - dx;
  const dLat = rad(by - ay), dLng = rad(dx);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(ay)) * Math.cos(rad(by)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(s)));
}

class Heap {
  private a: { f: number; k: number }[] = [];
  get size() { return this.a.length; }
  clear() { this.a.length = 0; }
  push(f: number, k: number) { const a = this.a; a.push({ f, k }); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop(): number { const a = this.a; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let i = 0; const n = a.length; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < n && a[l].f < a[m].f) m = l; if (r < n && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top.k; }
}
const heap = new Heap();
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function route(grid: Grid, lon1: number, lat1: number, lon2: number, lat2: number, W: number, maxExp: number): number | null {
  const { lon0, lat0, dLon, dLat, nx, ny, wrap, land, gScore, gen, closed } = grid;
  const wx = (ix: number) => wrap ? ((ix % nx) + nx) % nx : ix;
  const isLand = (ix: number, iy: number) => { if (ix < 0 || ix >= nx || iy < 0 || iy >= ny) return true; const k = iy * nx + ix; return !!(land[k >> 3] & (1 << (k & 7))); };
  const cLon = (ix: number) => lon0 + (ix + 0.5) * dLon;
  const cLat = (iy: number) => lat0 + (iy + 0.5) * dLat;
  const cellX = (lon: number) => wx(Math.round((lon - lon0) / dLon - 0.5));
  const cellY = (lat: number) => Math.round((lat - lat0) / dLat - 0.5);
  const snap = (ix: number, iy: number): [number, number] | null => {
    if (!isLand(ix, iy)) return [ix, iy];
    for (let r = 1; r < 100; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = wx(ix + dx), y = iy + dy; if (!isLand(x, y)) return [x, y];
    }
    return null;
  };
  const s = snap(cellX(lon1), cellY(lat1)), gl = snap(cellX(lon2), cellY(lat2));
  if (!s || !gl) return null;
  const [sx, sy] = s, [gx, gy] = gl;
  const G = ++grid.genCounter;
  const goalK = gy * nx + gx;
  heap.clear();
  const kS = sy * nx + sx; gScore[kS] = 0; gen[kS] = G;
  heap.push(W * gc(cLon(sx), cLat(sy), cLon(gx), cLat(gy)), kS);
  let exp = 0, foundG: number | null = null;
  while (heap.size) {
    const ck = heap.pop();
    if (ck === goalK) { foundG = gScore[goalK]; break; }
    if (closed[ck] === G) continue;      // skip stale duplicate pops
    closed[ck] = G;
    if (++exp > maxExp) break;
    const cx = ck % nx, cy = (ck - (ck % nx)) / nx, cg = gScore[ck];
    for (const [dx, dy] of DIRS) {
      const y = cy + dy; if (y < 0 || y >= ny) continue;
      const x = wx(cx + dx); if (isLand(x, y)) continue;
      const nk = y * nx + x;
      const ng = cg + gc(cLon(cx), cLat(cy), cLon(x), cLat(y));
      if (gen[nk] !== G || ng < gScore[nk]) { gScore[nk] = ng; gen[nk] = G; heap.push(ng + W * gc(cLon(x), cLat(y), cLon(gx), cLat(gy)), nk); }
    }
  }
  if (foundG === null) return null;
  return foundG + gc(lon1, lat1, cLon(sx), cLat(sy)) + gc(lon2, lat2, cLon(gx), cLat(gy));
}

export type SeaRouteResult = { nm: number; method: "sea" | "great-circle" };

export async function seaDistance(lon1: number, lat1: number, lon2: number, lat2: number): Promise<SeaRouteResult> {
  const straight = gc(lon1, lat1, lon2, lat2);
  const inRegion = (lon: number, lat: number) => lon >= REGION.lonMin && lon <= REGION.lonMax && lat >= REGION.latMin && lat <= REGION.latMax;
  const useRegional = inRegion(lon1, lat1) && inRegion(lon2, lat2);
  try {
    const grid = await loadGrid(useRegional ? "regional" : "global");
    // Regional: exact A* (small grid, fast). Global: weighted A* + expansion cap.
    const nm = useRegional
      ? route(grid, lon1, lat1, lon2, lat2, 1.0, 800_000)
      : route(grid, lon1, lat1, lon2, lat2, 1.15, 1_500_000);
    if (nm !== null && nm >= straight * 0.95) return { nm, method: "sea" };
    return { nm: straight, method: "great-circle" };
  } catch {
    return { nm: straight, method: "great-circle" };
  }
}
