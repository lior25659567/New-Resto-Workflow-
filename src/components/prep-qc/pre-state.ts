import * as THREE from "three";
import type { SceneHandle } from "./three-utils";
import type { PrepFrame, Section, UndercutAxisMode } from "./prep-geometry";
import type { PrepRegion } from "./prep-label";

// ---------------------------------------------------------------------------
// PreState — the single in-memory hand-off model between the guided Pre-Entry
// stage and the analysis-only Main App. Geometry + labels are shared by
// reference; transforms/camera are captured so the app can faithfully restore
// the prepared view without re-running any preprocessing.
// ---------------------------------------------------------------------------

// A restorable crown material with reduction thresholds (mm). Extensible:
// add entries to MATERIALS to support more materials.
export type PrepMaterial = {
  id: string;
  name: string;
  // Minimum safe occlusal/axial reduction for adequate strength.
  minReductionMm: number;
  // Ideal/target reduction (comfortably adequate).
  targetReductionMm: number;
  accent: string;
};

export const MATERIALS: PrepMaterial[] = [
  {
    id: "zirconia",
    name: "Zirconia (monolithic)",
    minReductionMm: 0.5,
    targetReductionMm: 1.0,
    accent: "#7c9cc4",
  },
  {
    id: "emax",
    name: "Lithium disilicate (e.max)",
    minReductionMm: 1.0,
    targetReductionMm: 1.5,
    accent: "#c47c9c",
  },
  {
    id: "pfm",
    name: "Porcelain-fused-to-metal",
    minReductionMm: 1.3,
    targetReductionMm: 2.0,
    accent: "#c4a87c",
  },
  {
    id: "fullgold",
    name: "Full gold",
    minReductionMm: 0.5,
    targetReductionMm: 1.0,
    accent: "#c4b54c",
  },
];

export function getMaterial(id: string): PrepMaterial {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

// Fixed clinical reduction targets for the prep sub-regions. The margin needs
// far less clearance than the occlusal table, so each is judged against its own
// threshold; the whole-prep ("all") readout falls back to the material target.
export const REGION_TARGET_MM: Record<Exclude<PrepRegion, "all">, number> = {
  marginal: 0.7,
  occlusal: 1.5,
};

// Target reduction (mm) for a region: a fixed per-region value for the margin /
// occlusal table, or the selected material's target for the whole prep.
export function regionTargetMm(
  region: PrepRegion,
  material: PrepMaterial,
): number {
  return region === "all"
    ? material.targetReductionMm
    : REGION_TARGET_MM[region];
}

// Minimum acceptable reduction (mm) for a region. Sub-regions use a margin
// below their target; the whole prep uses the material minimum.
export function regionMinMm(region: PrepRegion, material: PrepMaterial): number {
  return region === "all"
    ? material.minReductionMm
    : Math.max(0.1, REGION_TARGET_MM[region] - 0.2);
}

export type SavedCamera = {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  near: number;
  far: number;
};

export function captureCamera(handle: SceneHandle): SavedCamera {
  const c = handle.camera;
  const t = handle.controls.target;
  return {
    position: [c.position.x, c.position.y, c.position.z],
    target: [t.x, t.y, t.z],
    up: [c.up.x, c.up.y, c.up.z],
    near: c.near,
    far: c.far,
  };
}

export function applyCamera(handle: SceneHandle, cam: SavedCamera): void {
  const c = handle.camera;
  c.position.set(cam.position[0], cam.position[1], cam.position[2]);
  c.up.set(cam.up[0], cam.up[1], cam.up[2]);
  c.near = cam.near;
  c.far = cam.far;
  handle.controls.target.set(cam.target[0], cam.target[1], cam.target[2]);
  c.updateProjectionMatrix();
  handle.controls.update();
}

export type PreState = {
  // Geometries (kept in memory; shared by reference with the Pre-Entry stage).
  preGeom: THREE.BufferGeometry;
  txGeom: THREE.BufferGeometry;
  preName: string;
  txName: string;
  // Local matrices captured after alignment (pre) and scale-normalization (tx).
  preMatrix: THREE.Matrix4;
  txMatrix: THREE.Matrix4;
  // Prep mask over tx vertices (copied so later edits don't mutate it).
  labels: Uint8Array;
  // Prep PCA frame, for cross-section orientation + manual insertion tilt.
  prepFrame: PrepFrame;
  // Chosen insertion path (world-space unit axis) + how it was derived.
  insertionAxis: [number, number, number];
  undercutAxisMode: UndercutAxisMode;
  // Saved cross-sections + which one is the default for the app's section view.
  sections: Section[];
  defaultSectionId: number;
  // Persisted zoom-to-prep camera so the app restores the prepared view.
  camera: SavedCamera;
};
