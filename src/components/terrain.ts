import { GameElement } from "../colorMapping";

// Build a per-tile height map from the color-based game map.
// Units are in world meters; positive raises ground, negative lowers.
export function buildHeightMap(gameMap: GameElement[][]): number[][] {
  // Default fallback heightmap when none is provided by the caller.
  // Do NOT derive height from tile types; return a flat zero map matching the grid size.
  const rows = gameMap.length;
  const cols = gameMap[0].length;
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

// Bilinear interpolation of ground height at fractional position
export function sampleHeightBilinear(heights: number[][], x: number, y: number): number {
  const cols = heights[0].length;
  const rows = heights.length;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = Math.min(1, Math.max(0, x - x0));
  const ty = Math.min(1, Math.max(0, y - y0));
  const h00 = heights[y0][x0];
  const h10 = heights[y0][x1];
  const h01 = heights[y1][x0];
  const h11 = heights[y1][x1];
  const hx0 = h00 * (1 - tx) + h10 * tx;
  const hx1 = h01 * (1 - tx) + h11 * tx;
  return hx0 * (1 - ty) + hx1 * ty;
}

// Basic 2D value-noise blended to mimic simplex; deterministic per seed
function createSimplexLikeNoise(seed: number) {
  const rand = mulberry32(seed);
  const gradients: Array<[number, number]> = [];
  for (let i = 0; i < 256; i++) {
    const a = rand() * Math.PI * 2;
    gradients.push([Math.cos(a), Math.sin(a)]);
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = (i & 255);
  // Simple shuffle
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
  }
  function dot(ix: number, iy: number, x: number, y: number) {
    const g = gradients[(perm[(ix + perm[iy & 255]) & 255])];
    return g[0] * x + g[1] * y;
  }
  function fade(t: number) { return t * t * (3 - 2 * t); }
  return (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const n00 = dot(x0, y0, tx, ty);
    const n10 = dot(x0 + 1, y0, tx - 1, ty);
    const n01 = dot(x0, y0 + 1, tx, ty - 1);
    const n11 = dot(x0 + 1, y0 + 1, tx - 1, ty - 1);
    const u = fade(tx), v = fade(ty);
    const nx0 = n00 * (1 - u) + n10 * u;
    const nx1 = n01 * (1 - u) + n11 * u;
    return (nx0 * (1 - v) + nx1 * v); // -1..1 range-ish
  };
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Detect if a tile is adjacent to water for foam banding
export function isWaterEdge(map: GameElement[][], x: number, y: number): boolean {
  if (map[y][x] !== GameElement.WATER) return false;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (ny>=0 && ny<map.length && nx>=0 && nx<map[0].length) {
      if (map[ny][nx] !== GameElement.WATER) return true;
    }
  }
  return false;
}

// Build per-tile ceiling height map. Returns absolute world Y values for the ceiling surface.
export function buildCeilingMap(gameMap: GameElement[][], floorHeights: number[][]): number[][] {
  const rows = gameMap.length;
  const cols = gameMap[0].length;
  const ceilings: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  // Use noise for gentle vaulting; widen over water, tighten over danger
  const noise = createSimplexLikeNoise(4242);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = x / Math.max(1, cols);
      const ny = y / Math.max(1, rows);
      const base = 2.3; // base clearance in meters
      const n = noise(nx * 1.2, ny * 1.2) * 0.35; // -0.35..0.35
      const minGap = 1.9;
      const maxGap = 3.1;
      const desiredGap = clamp(base + n, minGap, maxGap);
      ceilings[y][x] = floorHeights[y][x] + desiredGap;
    }
  }

  // Soft blur to avoid harsh steps
  const out: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0; let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (ny>=0 && ny<rows && nx>=0 && nx<cols) { sum += ceilings[ny][nx]; count++; }
        }
      }
      out[y][x] = sum / Math.max(1, count);
    }
  }
  return out;
}

export function sampleCeilingBilinear(ceilings: number[][], x: number, y: number): number {
  return sampleHeightBilinear(ceilings, x, y);
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }


