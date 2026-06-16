import * as THREE from "three";
import {
  analyzeUndercuts,
  computeOcclusalFrame,
  type UndercutResult,
} from "./three-utils";
import { LABEL_PREP, isPrepLabel, regionMask } from "./prep-label";

// ---------------------------------------------------------------------------
// Shared geometry + analysis primitives for the Prep QC tool.
//
// Both stages (Pre-Entry preprocessing and the analysis-only Main App) import
// from here so the cross-section, prep-frame, insertion-arrow and undercut
// logic lives in exactly one place. No React in this module.
// ---------------------------------------------------------------------------

export type Section = {
  id: number;
  // World-space center of the cutting plane.
  origin: THREE.Vector3;
  // Full orientation of the plane: local +Z = plane normal, local +X = in-plane
  // "dir" axis, local +Y = in-plane "up" axis.
  quaternion: THREE.Quaternion;
  color: number;
};

export type SectionSize = { width: number; height: number };

// Anatomical cut orientation, auto-derived from the prep's principal axes.
export type SectionPlane = "sagittal" | "coronal" | "axial";
// "overlay" = translucent plane over the full model; "clip" = actually slice
// the model so the cut face is revealed and updates live as the plane moves.
export type SectionViewMode = "overlay" | "clip";

// Prep's orthonormal frame in world space, computed once per placement and
// reused when switching anatomical planes (so we don't recompute the PCA).
export type PrepFrame = {
  center: THREE.Vector3;
  longDir: THREE.Vector3; // mesiodistal (PCA long axis)
  crossDir: THREE.Vector3; // buccolingual
  up: THREE.Vector3; // occlusal (camera-up at placement)
  longSpan: number;
  crossSpan: number;
  upSpan: number;
};

export type CrossSectionData = {
  id: number;
  color: number;
  // Flat [x0,y0, x1,y1, x0,y0, x1,y1, ...] pairs of segment endpoints in
  // plane-local coords (x = along dir, y = perpendicular to dir within plane).
  txSegments: Float32Array;
  preSegments: Float32Array;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  measurements: {
    tx: [number, number];
    pre: [number, number];
    mm: number;
  }[];
  // World-space frame of this cut, so 2D segments can be lifted back to 3D
  // for the on-model contour overlay in clip mode.
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  up: THREE.Vector3;
};

// Insertion-path selection is simplified to two user choices — "optimized"
// (auto-solved minimum-undercut axis) and "manual" (a draggable 3D arrow the
// user aims) — plus "saved", used internally when the Main App replays the
// axis resolved during Pre-Entry.
export type UndercutAxisMode = "optimized" | "manual" | "saved";

export const SECTION_SAMPLES = 5;

export function hasPrepLabels(labels: Uint8Array): boolean {
  for (let i = 0; i < labels.length; i++) {
    if (isPrepLabel(labels[i])) return true;
  }
  return false;
}

// Map an anatomical plane choice onto the prep frame: returns the plane
// orientation (local +Z = normal) plus a sensible default visual size.
export function planeFrameFor(
  frame: PrepFrame,
  plane: SectionPlane,
): { quaternion: THREE.Quaternion; width: number; height: number } {
  let normal: THREE.Vector3;
  let xAxis: THREE.Vector3;
  let width: number;
  let height: number;
  if (plane === "axial") {
    // Transverse cut: normal = occlusal axis; lies in (mesiodistal, buccolingual).
    normal = frame.up;
    xAxis = frame.longDir;
    width = frame.longSpan;
    height = frame.crossSpan;
  } else if (plane === "sagittal") {
    // Normal = mesiodistal; lies in (buccolingual, occlusal).
    normal = frame.longDir;
    xAxis = frame.crossDir;
    width = frame.crossSpan;
    height = frame.upSpan;
  } else {
    // Coronal: normal = buccolingual; lies in (mesiodistal, occlusal).
    normal = frame.crossDir;
    xAxis = frame.longDir;
    width = frame.longSpan;
    height = frame.upSpan;
  }
  const z = normal.clone().normalize();
  let x = xAxis.clone().normalize();
  // Re-orthogonalize x against z, then build a right-handed basis.
  x = x.sub(z.clone().multiplyScalar(x.dot(z)));
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3(1, 0, 0).cross(z);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);
  // Pad the plane modestly beyond the prep extent so it stays grabbable
  // without swamping the surrounding anatomy.
  const f = 1.15;
  return {
    quaternion,
    width: Math.max(width, 4) * f,
    height: Math.max(height, 4) * f,
  };
}

// Cross-section computation — triangle-vs-plane intersection. Returns a flat
// list of segment endpoints in plane-local 2D coords (x along `dir`, y along
// `upInPlane`).
export function computeCrossSection(
  mesh: THREE.Mesh,
  geom: THREE.BufferGeometry,
  plane: THREE.Plane,
  dir: THREE.Vector3,
  upInPlane: THREE.Vector3,
  origin: THREE.Vector3,
): number[] {
  const pos = geom.attributes.position as THREE.BufferAttribute | undefined;
  if (!pos) return [];
  const index = geom.index;
  const mat = mesh.matrixWorld;
  const out: number[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const project = (p: THREE.Vector3): [number, number] => {
    tmp.subVectors(p, origin);
    return [tmp.dot(dir), tmp.dot(upInPlane)];
  };
  const interp = (
    p: THREE.Vector3,
    q: THREE.Vector3,
    dp: number,
    dq: number,
  ): THREE.Vector3 => {
    const t = dp / (dp - dq);
    return new THREE.Vector3().lerpVectors(p, q, t);
  };
  const triCount = index ? index.count / 3 : pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    let ia: number;
    let ib: number;
    let ic: number;
    if (index) {
      ia = index.getX(t * 3);
      ib = index.getX(t * 3 + 1);
      ic = index.getX(t * 3 + 2);
    } else {
      ia = t * 3;
      ib = t * 3 + 1;
      ic = t * 3 + 2;
    }
    va.fromBufferAttribute(pos, ia).applyMatrix4(mat);
    vb.fromBufferAttribute(pos, ib).applyMatrix4(mat);
    vc.fromBufferAttribute(pos, ic).applyMatrix4(mat);
    const dA = plane.distanceToPoint(va);
    const dB = plane.distanceToPoint(vb);
    const dC = plane.distanceToPoint(vc);
    // All on the same side → no intersection.
    if (dA > 0 && dB > 0 && dC > 0) continue;
    if (dA < 0 && dB < 0 && dC < 0) continue;
    const pts: THREE.Vector3[] = [];
    if ((dA <= 0) !== (dB <= 0)) pts.push(interp(va, vb, dA, dB));
    if ((dB <= 0) !== (dC <= 0)) pts.push(interp(vb, vc, dB, dC));
    if ((dC <= 0) !== (dA <= 0)) pts.push(interp(vc, va, dC, dA));
    if (pts.length === 2) {
      const [x1, y1] = project(pts[0]);
      const [x2, y2] = project(pts[1]);
      out.push(x1, y1, x2, y2);
    }
  }
  return out;
}

// Compute 2D cross-section profiles (pre + tx) for each section. Triangle-vs-
// plane intersection on both meshes, projected into the plane's 2D basis
// (dir = x, in-plane up = y), plus five mm reduction measurements per cut.
export function computeCrossSectionProfiles(
  sections: Section[],
  preMesh: THREE.Mesh,
  preGeom: THREE.BufferGeometry,
  txMesh: THREE.Mesh,
  txGeom: THREE.BufferGeometry,
  fallbackWidth: number,
): CrossSectionData[] {
  txMesh.updateMatrixWorld(true);
  preMesh.updateMatrixWorld(true);
  return sections.map((sec) => {
    // Derive plane basis from the section's quaternion.
    // Local axes: +X = dir, +Y = upInPlane, +Z = normal.
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(sec.quaternion);
    const upInPlane = new THREE.Vector3(0, 1, 0).applyQuaternion(
      sec.quaternion,
    );
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(sec.quaternion);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      sec.origin,
    );
    const txSegs = computeCrossSection(
      txMesh,
      txGeom,
      plane,
      dir,
      upInPlane,
      sec.origin,
    );
    const preSegs = computeCrossSection(
      preMesh,
      preGeom,
      plane,
      dir,
      upInPlane,
      sec.origin,
    );

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const arr of [txSegs, preSegs]) {
      for (let i = 0; i < arr.length; i += 2) {
        if (arr[i] < xMin) xMin = arr[i];
        if (arr[i] > xMax) xMax = arr[i];
        if (arr[i + 1] < yMin) yMin = arr[i + 1];
        if (arr[i + 1] > yMax) yMax = arr[i + 1];
      }
    }
    if (!isFinite(xMin)) {
      const half = fallbackWidth / 2;
      xMin = -half;
      xMax = half;
      yMin = -1;
      yMax = 1;
    }

    const measurements: CrossSectionData["measurements"] = [];
    if (txSegs.length > 0 && preSegs.length > 0) {
      // Flatten segment endpoints into point lists.
      const txPts: [number, number][] = [];
      for (let i = 0; i < txSegs.length; i += 2)
        txPts.push([txSegs[i], txSegs[i + 1]]);
      const prePts: [number, number][] = [];
      for (let i = 0; i < preSegs.length; i += 2)
        prePts.push([preSegs[i], preSegs[i + 1]]);

      const ts = [0.15, 0.32, 0.5, 0.68, 0.85];
      for (const t of ts) {
        const targetX = xMin + t * (xMax - xMin);
        // Tx anchor: tx point with x nearest the target.
        let bestTx = txPts[0];
        let bestDx = Infinity;
        for (const p of txPts) {
          const dx = Math.abs(p[0] - targetX);
          if (dx < bestDx) {
            bestDx = dx;
            bestTx = p;
          }
        }
        // Pre anchor: pre point nearest the tx anchor in 2D.
        let bestPre = prePts[0];
        let bestD2 = Infinity;
        for (const p of prePts) {
          const d2 = (p[0] - bestTx[0]) ** 2 + (p[1] - bestTx[1]) ** 2;
          if (d2 < bestD2) {
            bestD2 = d2;
            bestPre = p;
          }
        }
        measurements.push({
          tx: bestTx,
          pre: bestPre,
          mm: Math.sqrt(bestD2),
        });
      }
    }

    return {
      id: sec.id,
      color: sec.color,
      txSegments: new Float32Array(txSegs),
      preSegments: new Float32Array(preSegs),
      bounds: { xMin, xMax, yMin, yMax },
      measurements,
      origin: sec.origin.clone(),
      dir: dir.clone(),
      up: upInPlane.clone(),
    };
  });
}

// World-space centroid of the painted prep vertices (or null if none).
export function prepCentroidWorld(
  geom: THREE.BufferGeometry,
  matrixWorld: THREE.Matrix4,
  labels: Uint8Array,
): THREE.Vector3 | null {
  const pos = geom.attributes.position;
  if (!pos) return null;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  let count = 0;
  for (let i = 0; i < labels.length; i++) {
    if (!isPrepLabel(labels[i])) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
    c.add(v);
    count++;
  }
  return count > 0 ? c.multiplyScalar(1 / count) : null;
}

// Compute the prep's principal-axis frame. PCA in the plane perpendicular to
// the occlusal axis yields the mesiodistal (long) and buccolingual (cross)
// axes; the occlusal axis (auto-detected, prep-centroid disambiguated) is the
// "up". `fallbackUp` is used only if the occlusal frame can't be computed.
export function computePrepFrame(
  txMesh: THREE.Mesh,
  geom: THREE.BufferGeometry,
  labels: Uint8Array,
  fallbackUp?: THREE.Vector3,
): PrepFrame | null {
  const pos = geom.attributes.position;
  if (!pos) return null;
  txMesh.updateMatrixWorld(true);

  const v = new THREE.Vector3();
  const prepVerts: THREE.Vector3[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (!isPrepLabel(labels[i])) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(txMesh.matrixWorld);
    prepVerts.push(v.clone());
  }
  if (prepVerts.length < SECTION_SAMPLES) return null;
  return frameFromVerts(txMesh, prepVerts, fallbackUp);
}

// Cross-section frame derived from the WHOLE prepared mesh (subsampled), used
// when no prep has been painted yet so the user can still place + save a
// cross-section. Centered on the mesh centroid in the same occlusal/PCA frame.
export function computeMeshFrame(
  txMesh: THREE.Mesh,
  geom: THREE.BufferGeometry,
  fallbackUp?: THREE.Vector3,
): PrepFrame | null {
  const pos = geom.attributes.position;
  if (!pos) return null;
  txMesh.updateMatrixWorld(true);

  const v = new THREE.Vector3();
  const verts: THREE.Vector3[] = [];
  const stride = Math.max(1, Math.floor(pos.count / 4000));
  for (let i = 0; i < pos.count; i += stride) {
    v.fromBufferAttribute(pos, i).applyMatrix4(txMesh.matrixWorld);
    verts.push(v.clone());
  }
  if (verts.length < SECTION_SAMPLES) return null;
  return frameFromVerts(txMesh, verts, fallbackUp);
}

// Shared PCA/occlusal frame computation over a set of world-space points.
function frameFromVerts(
  txMesh: THREE.Mesh,
  pts: THREE.Vector3[],
  fallbackUp?: THREE.Vector3,
): PrepFrame | null {
  const prepVerts = pts;
  const center = new THREE.Vector3();
  for (const p of prepVerts) center.add(p);
  center.multiplyScalar(1 / prepVerts.length);

  // Occlusal axis from the jaw's own geometry (camera-independent), with the
  // prep centroid disambiguating the biting side.
  const camUp = new THREE.Vector3();
  const oFrame = computeOcclusalFrame(txMesh, { towardBiting: center });
  if (oFrame) {
    camUp.copy(oFrame.occlusal);
  } else if (fallbackUp) {
    camUp.copy(fallbackUp);
  } else {
    camUp.set(0, 1, 0);
  }
  camUp.normalize();

  let u = new THREE.Vector3(1, 0, 0).cross(camUp);
  if (u.lengthSq() < 1e-6) u = new THREE.Vector3(0, 0, 1).cross(camUp);
  u.normalize();
  const w = new THREE.Vector3().crossVectors(camUp, u).normalize();

  let Sxx = 0;
  let Sxy = 0;
  let Syy = 0;
  const tmp = new THREE.Vector3();
  for (const p of prepVerts) {
    tmp.subVectors(p, center);
    const a = tmp.dot(u);
    const b = tmp.dot(w);
    Sxx += a * a;
    Sxy += a * b;
    Syy += b * b;
  }
  let evA: number;
  let evB: number;
  if (Math.abs(Sxy) > 1e-9) {
    const tau = (Sxx + Syy) / 2;
    const delta = Math.sqrt(((Sxx - Syy) / 2) ** 2 + Sxy * Sxy);
    const lambda = tau + delta;
    evA = lambda - Syy;
    evB = Sxy;
  } else if (Sxx >= Syy) {
    evA = 1;
    evB = 0;
  } else {
    evA = 0;
    evB = 1;
  }
  const evLen = Math.hypot(evA, evB) || 1;
  evA /= evLen;
  evB /= evLen;

  const longDir = new THREE.Vector3()
    .addScaledVector(u, evA)
    .addScaledVector(w, evB)
    .normalize();
  const crossDir = new THREE.Vector3()
    .addScaledVector(u, -evB)
    .addScaledVector(w, evA)
    .normalize();

  let longMin = Infinity;
  let longMax = -Infinity;
  let crossMin = Infinity;
  let crossMax = -Infinity;
  let upMin = Infinity;
  let upMax = -Infinity;
  for (const p of prepVerts) {
    tmp.subVectors(p, center);
    const l = tmp.dot(longDir);
    const c = tmp.dot(crossDir);
    const up = tmp.dot(camUp);
    if (l < longMin) longMin = l;
    if (l > longMax) longMax = l;
    if (c < crossMin) crossMin = c;
    if (c > crossMax) crossMax = c;
    if (up < upMin) upMin = up;
    if (up > upMax) upMax = up;
  }

  return {
    center: center.clone(),
    longDir: longDir.clone(),
    crossDir: crossDir.clone(),
    up: camUp.clone(),
    longSpan: longMax - longMin,
    crossSpan: crossMax - crossMin,
    upSpan: Math.max(upMax - upMin, 4),
  };
}

// Build the insertion-axis arrow group at the prep center. `radius` is the
// world-space radius of the model (bounding sphere * scale).
export function makeInsertionArrow(
  insertionAxis: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
): THREE.Group {
  const len = radius * 0.8;
  const dir = insertionAxis.clone().normalize();
  const origin = center.clone().addScaledVector(dir, -len * 0.5);
  const group = new THREE.Group();
  const arrow = new THREE.ArrowHelper(
    dir,
    origin,
    len,
    0x1d4ed8,
    len * 0.1,
    len * 0.045,
  );
  group.add(arrow);
  return group;
}

// Dispose an arrow group built by makeInsertionArrow.
export function disposeArrowGroup(group: THREE.Group): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

// The draggable insertion arrow's local shaft direction. The arrow geometry is
// built along this axis and centered on the group origin, so rotating the group
// (via a TransformControls rotate gizmo) re-aims the whole handle about its
// pivot. Read the live withdrawal direction back with arrowDirection().
const ARROW_LOCAL_DIR = new THREE.Vector3(0, 1, 0);

// A user-aimable insertion arrow for Manual mode. Unlike makeInsertionArrow
// (a static read-out anchored to a world axis), this builds the arrow along the
// group's local +Y, centered on the origin, then positions the group at the
// prep center and orients +Y to `initialAxis`. Attach a rotate TransformControls
// to the returned group and read arrowDirection(group) to get the live axis.
export function makeDraggableInsertionArrow(
  initialAxis: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
): THREE.Group {
  const len = radius * 0.8;
  const group = new THREE.Group();
  group.position.copy(center);
  group.quaternion.setFromUnitVectors(
    ARROW_LOCAL_DIR,
    initialAxis.clone().normalize(),
  );
  const arrow = new THREE.ArrowHelper(
    ARROW_LOCAL_DIR,
    new THREE.Vector3(0, -len * 0.5, 0),
    len,
    0x1d4ed8,
    len * 0.12,
    len * 0.055,
  );
  group.add(arrow);
  return group;
}

// The live withdrawal direction encoded by a draggable arrow's orientation.
export function arrowDirection(group: THREE.Group): THREE.Vector3 {
  return ARROW_LOCAL_DIR.clone().applyQuaternion(group.quaternion).normalize();
}

// Single entry point for undercut analysis: selects the insertion axis from
// the chosen mode and runs analyzeUndercuts. Both stages call this so the
// axis-selection logic is never duplicated.
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
  // "manual" supplies the user-aimed arrow direction; "saved" supplies the
  // resolved axis persisted upstream. Both use the provided vector verbatim.
  const insertionAxis =
    opts.axisMode === "manual" || opts.axisMode === "saved"
      ? opts.manualAxis?.clone()
      : undefined;
  // analyzeUndercuts treats any truthy mask entry as prep, so pass a clean
  // prep-only mask: the generic prep paint plus the Marginal/Occlusal
  // sub-regions count, while background/unlabeled are excluded.
  const prepMask = regionMask(labels, "all");
  return analyzeUndercuts(geom, txMesh.matrixWorld, prepMask, {
    insertionAxis,
    optimize: opts.axisMode === "optimized",
    draftTolDeg: opts.draftTolDeg,
  });
}

// Quantitative reduction sufficiency over the prep region. The distance from
// each prepared (tx) vertex to the nearest original (pre) surface point is the
// amount of material removed there, i.e. the reduction depth. We summarize that
// against the selected material's min/target thresholds so the Main App can
// answer "did I reduce enough?" instead of only showing a heatmap.
export type ReductionStats = {
  vertexCount: number;
  minMm: number;
  meanMm: number;
  pctBelowMin: number;
  pctBelowTarget: number;
  pass: boolean;
};

export function computeReductionStats(
  txGeom: THREE.BufferGeometry,
  txMatrix: THREE.Matrix4,
  preGeom: THREE.BufferGeometry,
  preMatrix: THREE.Matrix4,
  labels: Uint8Array,
  minMm: number,
  targetMm: number,
  // Restrict the readout to one prep region. Undefined = whole prep (any
  // prep-like label); a specific label value scopes to that sub-region.
  regionLabel?: number,
): ReductionStats | null {
  const tPos = txGeom.attributes.position;
  const rPos = preGeom.attributes.position;
  if (!tPos || !rPos) return null;
  const inRegion = (l: number) =>
    regionLabel === undefined ? isPrepLabel(l) : l === regionLabel;

  // Downsample the reference (pre) surface to keep the nearest-point search
  // cheap; this runs once per mode/material change, not per frame.
  const REF_SAMPLE = 9000;
  const refStride = Math.max(1, Math.floor(rPos.count / REF_SAMPLE));
  const refPts: number[] = [];
  const rv = new THREE.Vector3();
  for (let i = 0; i < rPos.count; i += refStride) {
    rv.fromBufferAttribute(rPos, i).applyMatrix4(preMatrix);
    refPts.push(rv.x, rv.y, rv.z);
  }
  if (refPts.length === 0) return null;

  // Cap the number of prep vertices we test for responsiveness.
  let prepTotal = 0;
  for (let i = 0; i < labels.length && i < tPos.count; i++) {
    if (inRegion(labels[i])) prepTotal++;
  }
  if (prepTotal === 0) return null;
  const tgtStride = Math.max(1, Math.floor(prepTotal / 5000));

  const p = new THREE.Vector3();
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let belowMin = 0;
  let belowTarget = 0;
  let seen = 0;
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
