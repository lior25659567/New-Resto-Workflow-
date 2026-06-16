import * as THREE from "three";
import { isPrepLabel } from "./prepLabels";

export type ReductionStats = {
  vertexCount: number;
  minMm: number;
  meanMm: number;
  pctBelowMin: number;
  pctBelowTarget: number;
  pass: boolean;
};

export type PrepMaterial = {
  id: string;
  name: string;
  minReductionMm: number;
  targetReductionMm: number;
  accent: string;
};

export const MATERIALS: PrepMaterial[] = [
  { id: "zirconia", name: "Zirconia (monolithic)", minReductionMm: 0.5, targetReductionMm: 1.0, accent: "#7c9cc4" },
  { id: "emax", name: "Lithium disilicate (e.max)", minReductionMm: 1.0, targetReductionMm: 1.5, accent: "#c47c9c" },
  { id: "pfm", name: "Porcelain-fused-to-metal", minReductionMm: 1.3, targetReductionMm: 2.0, accent: "#c4a87c" },
  { id: "fullgold", name: "Full gold", minReductionMm: 0.5, targetReductionMm: 1.0, accent: "#c4b54c" },
];

export const REGION_TARGET_MM: Record<"marginal" | "occlusal", number> = {
  marginal: 0.7,
  occlusal: 1.5,
};

export function regionTargetMm(region: "all" | "marginal" | "occlusal", material: PrepMaterial): number {
  return region === "all" ? material.targetReductionMm : REGION_TARGET_MM[region];
}

export function regionMinMm(region: "all" | "marginal" | "occlusal", material: PrepMaterial): number {
  return region === "all" ? material.minReductionMm : Math.max(0.1, REGION_TARGET_MM[region] - 0.2);
}

export function computeReductionStats(
  txGeom: THREE.BufferGeometry,
  txMatrix: THREE.Matrix4,
  preGeom: THREE.BufferGeometry,
  preMatrix: THREE.Matrix4,
  labels: Uint8Array,
  minMm: number,
  targetMm: number,
  regionLabel?: number,
): ReductionStats | null {
  const tPos = txGeom.attributes.position;
  const rPos = preGeom.attributes.position;
  if (!tPos || !rPos) return null;
  const inRegion = (l: number) =>
    regionLabel === undefined ? isPrepLabel(l) : l === regionLabel;

  const REF_SAMPLE = 9000;
  const refStride = Math.max(1, Math.floor(rPos.count / REF_SAMPLE));
  const refPts: number[] = [];
  const rv = new THREE.Vector3();
  for (let i = 0; i < rPos.count; i += refStride) {
    rv.fromBufferAttribute(rPos, i).applyMatrix4(preMatrix);
    refPts.push(rv.x, rv.y, rv.z);
  }
  if (refPts.length === 0) return null;

  let prepTotal = 0;
  for (let i = 0; i < labels.length && i < tPos.count; i++) {
    if (inRegion(labels[i])) prepTotal++;
  }
  if (prepTotal === 0) return null;
  const tgtStride = Math.max(1, Math.floor(prepTotal / 5000));

  const p = new THREE.Vector3();
  let count = 0, sum = 0, min = Infinity, belowMin = 0, belowTarget = 0, seen = 0;
  for (let i = 0; i < tPos.count; i++) {
    if (!inRegion(labels[i])) continue;
    seen++;
    if (seen % tgtStride !== 0) continue;
    p.fromBufferAttribute(tPos, i).applyMatrix4(txMatrix);
    let best = Infinity;
    for (let j = 0; j < refPts.length; j += 3) {
      const ex = p.x - refPts[j];
      const ey = p.y - refPts[j + 1];
      const ez = p.z - refPts[j + 2];
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 < best) best = d2;
    }
    const d = Math.sqrt(best);
    count++;
    sum += d;
    if (d < min) min = d;
    if (d < minMm) belowMin++;
    if (d < targetMm) belowTarget++;
  }
  if (count === 0) return null;
  const pctBelowMin = (belowMin / count) * 100;
  return {
    vertexCount: count,
    minMm: min,
    meanMm: sum / count,
    pctBelowMin,
    pctBelowTarget: (belowTarget / count) * 100,
    pass: pctBelowMin < 2,
  };
}
