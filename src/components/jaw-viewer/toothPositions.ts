import type * as THREE from 'three';

/**
 * Tooth centroid positions in PLY local coordinates (mm), before geo.center().
 * Enamel-first centroids — see .claude/skills/itero-tooth-positions/SKILL.md and scripts/analyze_itero_teeth.py.
 * Upper.ply → lower viewer slot (ADA #1–15). Lower.ply → upper viewer slot (ADA #17–32).
 */

export interface ToothCentroid {
  ada: number;
  label: string;
  x: number;
  y: number;
  z: number;
}

/** Lower.ply — upper viewer slot (v10 enamel-first, scripts/analyze_itero_teeth.py) */
export const LOWER_TEETH: ToothCentroid[] = [
  { ada: 17, label: '#17', x: -26.929, y:  16.873, z: 2.567 },
  { ada: 18, label: '#18', x: -26.070, y:   9.816, z: 2.010 },
  { ada: 19, label: '#19', x: -24.741, y:   1.307, z: 1.686 },
  { ada: 20, label: '#20', x: -22.601, y:  -4.672, z: 1.484 },
  { ada: 21, label: '#21', x: -19.828, y: -10.189, z: 1.893 },
  { ada: 22, label: '#22', x: -17.163, y: -15.759, z: 2.017 },
  { ada: 23, label: '#23', x: -13.340, y: -23.034, z: 2.740 },
  { ada: 24, label: '#24', x:  -5.369, y: -27.180, z: 2.345 },
  { ada: 25, label: '#25', x:   2.022, y: -27.648, z: 2.337 },
  { ada: 26, label: '#26', x:   8.141, y: -25.768, z: 2.119 },
  { ada: 27, label: '#27', x:  13.086, y: -22.237, z: 2.864 },
  { ada: 28, label: '#28', x:  16.629, y: -15.402, z: 2.037 },
  { ada: 29, label: '#29', x:  20.285, y:  -5.665, z: 1.286 },
  { ada: 30, label: '#30', x:  23.013, y:   0.360, z: 1.549 },
  { ada: 32, label: '#32', x:  24.829, y:   6.415, z: 1.465 },
];

/** Upper.ply — lower viewer slot (v10 enamel-first, scripts/analyze_itero_teeth.py) */
export const UPPER_TEETH: ToothCentroid[] = [
  { ada: 1,  label: '#1',  x:  32.059, y:   7.863, z: 10.847 },
  { ada: 2,  label: '#2',  x:  25.725, y:  -9.492, z:  9.171 },
  { ada: 3,  label: '#3',  x:  17.670, y:   3.239, z:  9.255 },
  { ada: 4,  label: '#4',  x:  13.739, y:  -2.605, z: 10.430 },
  { ada: 5,  label: '#5',  x:  11.225, y:  -9.147, z: 11.000 },
  { ada: 6,  label: '#6',  x:   6.985, y: -14.093, z: 11.079 },
  { ada: 7,  label: '#7',  x:   3.880, y: -21.932, z:  7.087 },
  { ada: 8,  label: '#8',  x:  -2.313, y: -21.819, z:  8.799 },
  { ada: 9,  label: '#9',  x:  -8.647, y: -18.984, z:  9.493 },
  { ada: 10, label: '#10', x: -11.054, y: -11.148, z:  9.814 },
  { ada: 11, label: '#11', x: -13.772, y:  -4.409, z:  9.915 },
  { ada: 12, label: '#12', x: -15.143, y:   2.795, z: 10.532 },
  { ada: 13, label: '#13', x: -22.000, y:   5.500, z:  9.500 },
  { ada: 14, label: '#14', x: -28.500, y:   8.000, z:  9.300 },
  { ada: 15, label: '#15', x: -31.410, y:   6.440, z:  8.400 },
];

export const GUM_PINKNESS_THRESHOLD = 0.28;
/** Min luminance for white enamel (matches scripts/analyze_itero_teeth.py) */
export const ENAMEL_LUMINANCE_MIN = 0.4;

export type JawKind = 'upper' | 'lower' | 'bite';

export function isGumVertex(
  vertexColors: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
  index: number,
): boolean {
  return !isEnamelVertex(vertexColors, index);
}

/** True for white tooth enamel; false for pink gingiva, palate, shadows */
export function isEnamelVertex(
  vertexColors: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
  index: number,
): boolean {
  if (!vertexColors) return true;
  const r = vertexColors.getX(index);
  const g = vertexColors.getY(index);
  const b = vertexColors.getZ(index);
  const pinkness = r - b;
  if (pinkness >= GUM_PINKNESS_THRESHOLD) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < ENAMEL_LUMINANCE_MIN) return false;
  if (pinkness > 0.22 && g > b * 1.05 && r > 0.58) return false;
  return true;
}

/** True for enamel / crown walls; false for gingiva and palate floor */
export function isToothSurfaceVertex(
  x: number,
  y: number,
  z: number,
  normalZ: number,
  toothCenter: { x: number; y: number; z: number },
  jawType: JawKind,
): boolean {
  const dx = x - toothCenter.x;
  const dy = y - toothCenter.y;
  const dz = z - toothCenter.z;
  const distXY = Math.hypot(dx, dy);

  if (jawType === 'lower') {
    // Lower.ply (viewer jawType="lower"): occlusal faces up
    if (normalZ < 0.15) return false;
    if (distXY > 6.0) return false;
    if (dz < -2.2) return false;
    return true;
  }

  if (jawType === 'upper') {
    // Upper.ply: same frame as Lower.ply — high Z = occlusal, nz > 0 on crown
    if (normalZ < 0.15) return false;
    if (distXY > 6.0) return false;
    if (dz < -2.2) return false;
    return true;
  }

  // bite / both
  const absNZ = Math.abs(normalZ);
  if (absNZ < 0.12) return false;
  if (distXY > 6.0) return false;
  return Math.abs(dz) < 2.5;
}

const MAX_REFINE_DRIFT_MM = 2.0;

/** Light refinement — stays near seed, uses tooth-surface vertices only */
export function refineToothCentroidsFromGeometry(
  pos: THREE.BufferAttribute,
  vertexColors: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
  normals: THREE.BufferAttribute | undefined,
  seeds: ToothCentroid[],
  jawType: JawKind,
  originalCenter?: THREE.Vector3,
): ToothCentroid[] {
  const count = pos.count;
  return seeds.map((seed) => {
    let sx = seed.x;
    let sy = seed.y;
    let sz = seed.z;
    if (originalCenter) {
      sx -= originalCenter.x;
      sy -= originalCenter.y;
      sz -= originalCenter.z;
    }

    const cluster: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      if (!isEnamelVertex(vertexColors, i)) continue;
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const nz = normals ? normals.getZ(i) : 0;
      const center = { x: sx, y: sy, z: sz };
      if (Math.hypot(x - sx, y - sy) > 5.5) continue;
      if (!isToothSurfaceVertex(x, y, z, nz, center, jawType)) continue;
      cluster.push({ x, y, z });
    }

    if (cluster.length < 25) return { ...seed };

    const zPeak = Math.max(...cluster.map((p) => p.z));
    let sw = 0;
    let wx = 0;
    let wy = 0;
    let wz = 0;
    for (const p of cluster) {
      const w = Math.exp((p.z - zPeak) * 0.35);
      wx += p.x * w;
      wy += p.y * w;
      wz += p.z * w;
      sw += w;
    }

    let rx = wx / sw;
    let ry = wy / sw;
    let rz = wz / sw;
    if (originalCenter) {
      rx += originalCenter.x;
      ry += originalCenter.y;
      rz += originalCenter.z;
    }

    const drift = Math.hypot(rx - seed.x, ry - seed.y);
    if (drift > MAX_REFINE_DRIFT_MM) {
      const t = MAX_REFINE_DRIFT_MM / drift;
      return {
        ...seed,
        x: seed.x + (rx - seed.x) * t,
        y: seed.y + (ry - seed.y) * t,
        z: seed.z + (rz - seed.z) * t,
      };
    }
    return { ...seed, x: rx, y: ry, z: rz };
  });
}
