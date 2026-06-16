import * as THREE from "three";
import { computeDistanceField } from "./three-utils";
import { computePrepFrame, planeFrameFor, type Section } from "./prep-geometry";
import {
  LABEL_PREP,
  LABEL_MARGINAL,
  LABEL_OCCLUSAL,
} from "./prep-label";
import { type PreState, type SavedCamera } from "./pre-state";

// ---------------------------------------------------------------------------
// Prep → PreState. Two entry points share the same back half:
//   buildPreStateFromLabels — takes a prep mask the user PAINTED and derives the
//     frame, sub-regions, default cut, insertion axis and camera from it. This
//     is the primary path: the user marks the prep, the QC checks key off it.
//   buildAutoPreState — auto-detects the prep (where tx diverges from pre) and
//     then calls the same derivation. Kept as a fallback / "auto-detect".
//
// Everything is honest: every label and number traces back to measured
// geometry (the painted region or the measured reduction), nothing is faked.
// ---------------------------------------------------------------------------

const SECTION_COLOR = 0x00adef;

// Reduction band (mm) that counts as "prepped". Below LO is unchanged anatomy
// or alignment noise; above HI is almost always a scan-boundary mismatch (tx
// has surface where pre simply wasn't captured), not a real reduction.
const BAND_LO = 0.25;
const BAND_HI = 4.5;
const MAX_DIST = 5;
// Radius (mm) around the deepest reduction point we keep, to localize a single
// prepped tooth and drop scattered noise elsewhere on the arch.
const PREP_RADIUS = 9;

export function buildAutoPreState(
  preGeom: THREE.BufferGeometry,
  txGeom: THREE.BufferGeometry,
  preName: string,
  txName: string,
): PreState | null {
  // Both geometries are pre-centred by parsePly, and the bundled pre/tx are the
  // same case, so they already coincide — identity transforms are correct and
  // running ICP on the full arches only risks diverging the good alignment.
  const preMat = new THREE.Matrix4();
  const txMat = new THREE.Matrix4();
  const preMesh = new THREE.Mesh(preGeom);
  const txMesh = new THREE.Mesh(txGeom);
  preMesh.updateMatrixWorld(true);
  txMesh.updateMatrixWorld(true);

  // Per-vertex reduction depth over the whole tx surface.
  const dist = computeDistanceField(txGeom, txMat, preGeom, preMat, MAX_DIST);
  const tPos = txGeom.attributes.position;
  if (!tPos) return null;

  // Seed = deepest in-band reduction (the floor of the prep).
  let seed = -1;
  let seedD = -Infinity;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > BAND_LO && dist[i] < BAND_HI && dist[i] > seedD) {
      seedD = dist[i];
      seed = i;
    }
  }
  if (seed < 0) return null;
  const seedPos = new THREE.Vector3()
    .fromBufferAttribute(tPos, seed)
    .applyMatrix4(txMat);

  // Prep mask: in-band reduction within PREP_RADIUS of the seed.
  const labels = new Uint8Array(tPos.count);
  const p = new THREE.Vector3();
  const r2 = PREP_RADIUS * PREP_RADIUS;
  let prepCount = 0;
  // Track occlusal-height extent (along +Y world as a provisional axis) so we
  // can split sub-regions; refined below once the real frame is known.
  for (let i = 0; i < tPos.count; i++) {
    const d = dist[i];
    if (d <= BAND_LO || d >= BAND_HI) continue;
    p.fromBufferAttribute(tPos, i).applyMatrix4(txMat);
    if (p.distanceToSquared(seedPos) > r2) continue;
    labels[i] = LABEL_PREP;
    prepCount++;
  }
  if (prepCount < 30) return null;

  return buildPreStateFromLabels(preGeom, txGeom, labels, preName, txName);
}

// Derive a complete PreState from a prep mask (painted or detected). The mask
// only needs LABEL_PREP marked; this splits it into margin / wall / occlusal by
// occlusal height, fits the PCA frame, places a default axial cut, seeds the
// insertion axis and an occlusal camera.
export function buildPreStateFromLabels(
  preGeom: THREE.BufferGeometry,
  txGeom: THREE.BufferGeometry,
  rawLabels: Uint8Array,
  preName: string,
  txName: string,
): PreState | null {
  const preMat = new THREE.Matrix4();
  const txMat = new THREE.Matrix4();
  const txMesh = new THREE.Mesh(txGeom);
  txMesh.updateMatrixWorld(true);
  const tPos = txGeom.attributes.position;
  if (!tPos) return null;

  // Work on a copy so caller-owned paint state isn't mutated by the split.
  const labels = rawLabels.slice();
  // Normalize any pre-existing sub-labels back to generic prep before we split.
  let prepCount = 0;
  for (let i = 0; i < labels.length; i++) {
    if (
      labels[i] === LABEL_PREP ||
      labels[i] === LABEL_MARGINAL ||
      labels[i] === LABEL_OCCLUSAL
    ) {
      labels[i] = LABEL_PREP;
      prepCount++;
    }
  }
  if (prepCount < 30) return null;

  // PCA frame of the prepped blob (centroid, mesiodistal/buccolingual/occlusal).
  const frame = computePrepFrame(txMesh, txGeom, labels, new THREE.Vector3(0, 1, 0));
  if (!frame) return null;

  // Split the prep by height along the occlusal axis: the top band is the
  // occlusal table, the gingival band is the finish-line margin, the middle
  // stays as generic axial-wall prep. Heights are normalized to the prep's own
  // extent so the split adapts to any prep depth.
  const p = new THREE.Vector3();
  let hMin = Infinity;
  let hMax = -Infinity;
  const up = frame.up;
  const heightOf = (i: number) => {
    p.fromBufferAttribute(tPos, i).applyMatrix4(txMat).sub(frame.center);
    return p.dot(up);
  };
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== LABEL_PREP) continue;
    const h = heightOf(i);
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  const span = Math.max(hMax - hMin, 1e-3);
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== LABEL_PREP) continue;
    const t = (heightOf(i) - hMin) / span; // 0 = gingival, 1 = occlusal
    if (t > 0.62) labels[i] = LABEL_OCCLUSAL;
    else if (t < 0.28) labels[i] = LABEL_MARGINAL;
    // middle band stays LABEL_PREP (axial walls)
  }

  // Default cross-section: an axial cut through the prep center.
  const planeFrame = planeFrameFor(frame, "axial");
  const section: Section = {
    id: 0,
    origin: frame.center.clone(),
    quaternion: planeFrame.quaternion.clone(),
    color: SECTION_COLOR,
  };

  // Camera: frame the whole model with the prep centred. Distance is keyed to
  // the model's bounding sphere (not the small prep) so the camera always sits
  // well outside the arch. The view direction is the outward vector from the
  // model body to the prep — robustly the occlusal side, no PCA sign ambiguity.
  txGeom.computeBoundingSphere();
  const bs = txGeom.boundingSphere;
  const R = bs ? bs.radius : 30;
  const modelCenter = bs
    ? bs.center.clone().applyMatrix4(txMat)
    : frame.center.clone();
  const outward = frame.center.clone().sub(modelCenter);
  if (outward.lengthSq() < 1e-6) outward.copy(up);
  outward.normalize();
  // Bias toward the occlusal axis so we look at the prep face, not edge-on.
  outward.addScaledVector(up, 0.6).normalize();
  const dist3 = R * 2.4 + 10;
  const eye = frame.center.clone().addScaledVector(outward, dist3);
  // Up vector perpendicular to the view direction (avoid gimbal roll).
  const camUp =
    Math.abs(outward.y) > 0.92
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
  const camera: SavedCamera = {
    position: [eye.x, eye.y, eye.z],
    target: [frame.center.x, frame.center.y, frame.center.z],
    up: [camUp.x, camUp.y, camUp.z],
    near: Math.max(0.1, dist3 - R * 2.5),
    far: dist3 + R * 4,
  };

  return {
    preGeom,
    txGeom,
    preName,
    txName,
    preMatrix: preMat,
    txMatrix: txMat,
    labels,
    prepFrame: frame,
    insertionAxis: [up.x, up.y, up.z],
    undercutAxisMode: "optimized",
    sections: [section],
    defaultSectionId: 0,
    camera,
  };
}
