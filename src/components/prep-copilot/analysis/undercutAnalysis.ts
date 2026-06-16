import * as THREE from "three";
import { regionMask } from "./prepLabels";
import type { PrepRegion } from "./prepLabels";

const RAD2DEG = 180 / Math.PI;

export type UndercutAxisMode = "optimized" | "manual" | "saved";

export type UndercutResult = {
  insertionAxis: THREE.Vector3;
  center: THREE.Vector3;
  prepCount: number;
  undercutCount: number;
  undercutPct: number;
  prepAreaMm2: number;
  undercutAreaMm2: number;
  undercutAreaPct: number;
  maxUndercutDeg: number;
  meanUndercutDeg: number;
  optimized: boolean;
};

function perVertexAreaWorld(geom: THREE.BufferGeometry, matrix: THREE.Matrix4): Float32Array {
  const pos = geom.attributes.position;
  const area = new Float32Array(pos.count);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const addTri = (i0: number, i1: number, i2: number) => {
    a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
    ab.subVectors(b, a); ac.subVectors(c, a);
    const third = (ab.cross(ac).length() * 0.5) / 3;
    area[i0] += third; area[i1] += third; area[i2] += third;
  };
  const idx = geom.index;
  if (idx) {
    for (let i = 0; i + 2 < idx.count; i += 3)
      addTri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  } else {
    for (let i = 0; i + 2 < pos.count; i += 3) addTri(i, i + 1, i + 2);
  }
  return area;
}

function worldNormals(geom: THREE.BufferGeometry, matrix: THREE.Matrix4): Float32Array {
  if (!geom.attributes.normal) geom.computeVertexNormals();
  const nAttr = geom.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const out = new Float32Array(nAttr.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < nAttr.count; i++) {
    n.fromBufferAttribute(nAttr, i).applyMatrix3(nm).normalize();
    out[i * 3] = n.x; out[i * 3 + 1] = n.y; out[i * 3 + 2] = n.z;
  }
  return out;
}

export function analyzeUndercuts(
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  prepMask: Uint8Array,
  opts: {
    insertionAxis?: THREE.Vector3;
    optimize?: boolean;
    draftTolDeg?: number;
  } = {},
): { result: UndercutResult; colors: Float32Array } | null {
  const pos = geom.attributes.position;
  if (!pos) return null;

  const prepIdx: number[] = [];
  const n = Math.min(prepMask.length, pos.count);
  for (let i = 0; i < n; i++) if (prepMask[i]) prepIdx.push(i);
  if (prepIdx.length < 8) return null;

  const normals = worldNormals(geom, matrix);
  const areas = perVertexAreaWorld(geom, matrix);

  const center = new THREE.Vector3();
  const wp = new THREE.Vector3();
  for (const i of prepIdx) {
    wp.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    center.add(wp);
  }
  center.multiplyScalar(1 / prepIdx.length);

  const mean = new THREE.Vector3();
  for (const i of prepIdx)
    mean.set(
      mean.x + normals[i * 3] * areas[i],
      mean.y + normals[i * 3 + 1] * areas[i],
      mean.z + normals[i * 3 + 2] * areas[i],
    );
  if (mean.lengthSq() < 1e-9) mean.set(0, 0, 1);
  mean.normalize();

  const draftTol = opts.draftTolDeg ?? 0;
  const t0 = Math.sin((draftTol * Math.PI) / 180);

  const stride = Math.max(1, Math.floor(prepIdx.length / 4000));
  const undercutAreaFor = (ax: THREE.Vector3): number => {
    let s = 0;
    for (let k = 0; k < prepIdx.length; k += stride) {
      const i = prepIdx[k];
      const d = normals[i * 3] * ax.x + normals[i * 3 + 1] * ax.y + normals[i * 3 + 2] * ax.z;
      if (d < t0) s += areas[i];
    }
    return s;
  };

  const axis = opts.insertionAxis ? opts.insertionAxis.clone().normalize() : mean.clone();
  const optimize = opts.optimize ?? !opts.insertionAxis;

  if (optimize) {
    const best = axis.clone();
    let bestArea = undercutAreaFor(best);
    const ref = Math.abs(mean.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const e1 = new THREE.Vector3().crossVectors(mean, ref).normalize();
    const e2 = new THREE.Vector3().crossVectors(mean, e1).normalize();
    for (let coneDeg = 30; coneDeg >= 2; coneDeg /= 2) {
      const c0 = best.clone();
      const r = Math.tan((coneDeg * Math.PI) / 180);
      const N = 16;
      for (let a = 0; a < N; a++) {
        const ang = (a / N) * Math.PI * 2;
        for (const rr of [r * 0.5, r]) {
          const cand = c0.clone()
            .addScaledVector(e1, Math.cos(ang) * rr)
            .addScaledVector(e2, Math.sin(ang) * rr)
            .normalize();
          const ar = undercutAreaFor(cand);
          if (ar < bestArea) { bestArea = ar; best.copy(cand); }
        }
      }
    }
    axis.copy(best);
  }

  const colors = new Float32Array(pos.count * 3);
  let undercutCount = 0, prepAreaMm2 = 0, undercutAreaMm2 = 0, maxDeg = 0, sumDeg = 0;
  for (let i = 0; i < pos.count; i++) {
    if (!prepMask[i]) {
      colors[i * 3] = 0.55; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 0.58;
      continue;
    }
    const d = Math.max(-1, Math.min(1,
      normals[i * 3] * axis.x + normals[i * 3 + 1] * axis.y + normals[i * 3 + 2] * axis.z));
    prepAreaMm2 += areas[i];
    if (d < t0) {
      undercutCount++;
      undercutAreaMm2 += areas[i];
      const deg = draftTol - Math.asin(d) * RAD2DEG;
      if (deg > maxDeg) maxDeg = deg;
      sumDeg += deg;
      colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.11; colors[i * 3 + 2] = 0.11;
    } else {
      const draft = Math.asin(d) * RAD2DEG;
      const t = Math.min(1, draft / 30);
      colors[i * 3] = 0.46 - 0.24 * t;
      colors[i * 3 + 1] = 0.74 - 0.06 * t;
      colors[i * 3 + 2] = 0.46 - 0.12 * t;
    }
  }

  const result: UndercutResult = {
    insertionAxis: axis.clone(),
    center,
    prepCount: prepIdx.length,
    undercutCount,
    undercutPct: (undercutCount / prepIdx.length) * 100,
    prepAreaMm2,
    undercutAreaMm2,
    undercutAreaPct: prepAreaMm2 > 0 ? (undercutAreaMm2 / prepAreaMm2) * 100 : 0,
    maxUndercutDeg: maxDeg,
    meanUndercutDeg: undercutCount > 0 ? sumDeg / undercutCount : 0,
    optimized: optimize,
  };
  return { result, colors };
}

export function runUndercutAnalysis(
  txMesh: THREE.Mesh,
  geom: THREE.BufferGeometry,
  labels: Uint8Array,
  opts: {
    axisMode: UndercutAxisMode;
    draftTolDeg: number;
    manualAxis?: THREE.Vector3;
  },
): { result: UndercutResult; colors: Float32Array } | null {
  txMesh.updateMatrixWorld(true);
  const insertionAxis =
    opts.axisMode === "manual" || opts.axisMode === "saved"
      ? opts.manualAxis?.clone()
      : undefined;
  const prepMask = regionMask(labels, "all");
  return analyzeUndercuts(geom, txMesh.matrixWorld, prepMask, {
    insertionAxis,
    optimize: opts.axisMode === "optimized",
    draftTolDeg: opts.draftTolDeg,
  });
}
