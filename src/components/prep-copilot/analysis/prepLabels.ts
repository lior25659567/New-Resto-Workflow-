import * as THREE from "three";

export const LABEL_UNLABELED = 0;
export const LABEL_PREP = 1;
export const LABEL_BACKGROUND = 2;
export const LABEL_MARGINAL = 3;
export const LABEL_OCCLUSAL = 4;

export type PrepRegion = "all" | "marginal" | "occlusal";

export function isPrepLabel(v: number): boolean {
  return v === LABEL_PREP || v === LABEL_MARGINAL || v === LABEL_OCCLUSAL;
}

export function regionMask(labels: Uint8Array, region: PrepRegion): Uint8Array {
  const out = new Uint8Array(labels.length);
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    out[i] =
      region === "all"
        ? isPrepLabel(l) ? 1 : 0
        : region === "marginal"
          ? l === LABEL_MARGINAL ? 1 : 0
          : l === LABEL_OCCLUSAL ? 1 : 0;
  }
  return out;
}

export function regionLabelValue(region: PrepRegion): number | undefined {
  return region === "marginal"
    ? LABEL_MARGINAL
    : region === "occlusal"
      ? LABEL_OCCLUSAL
      : undefined;
}

export function countLabel(labels: Uint8Array, value: number): number {
  let n = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] === value) n++;
  return n;
}

const BASE: [number, number, number] = [0.95, 0.92, 0.84];
const PREP: [number, number, number] = [0.96, 0.28, 0.30];
const BG: [number, number, number] = [0.27, 0.55, 0.95];
const MARGINAL: [number, number, number] = [0.10, 0.72, 0.66];
const OCCLUSAL: [number, number, number] = [0.60, 0.40, 0.92];

export function labelColor(l: number): [number, number, number] {
  return l === LABEL_PREP
    ? PREP
    : l === LABEL_MARGINAL
      ? MARGINAL
      : l === LABEL_OCCLUSAL
        ? OCCLUSAL
        : l === LABEL_BACKGROUND
          ? BG
          : BASE;
}

export function labelsToColors(labels: Uint8Array, geom: THREE.BufferGeometry) {
  const n = labels.length;
  let attr = geom.attributes.color as THREE.BufferAttribute | undefined;
  if (!attr || attr.count !== n) {
    attr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geom.setAttribute("color", attr);
  }
  const arr = attr.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const c = labelColor(labels[i]);
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  }
  attr.needsUpdate = true;
}

export function predictionsToColors(
  probs: Float32Array,
  threshold: number,
  labels: Uint8Array,
  geom: THREE.BufferGeometry,
) {
  const n = probs.length;
  let attr = geom.attributes.color as THREE.BufferAttribute | undefined;
  if (!attr || attr.count !== n) {
    attr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geom.setAttribute("color", attr);
  }
  const arr = attr.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l !== LABEL_UNLABELED) {
      const c = labelColor(l);
      arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
      continue;
    }
    const p = probs[i];
    if (p >= threshold) {
      const t = Math.min(1, (p - threshold) / Math.max(1e-3, 1 - threshold));
      const mix = 0.35 + 0.55 * t;
      arr[i * 3] = BASE[0] + (PREP[0] - BASE[0]) * mix;
      arr[i * 3 + 1] = BASE[1] + (PREP[1] - BASE[1]) * mix;
      arr[i * 3 + 2] = BASE[2] + (PREP[2] - BASE[2]) * mix;
    } else {
      arr[i * 3] = BASE[0];
      arr[i * 3 + 1] = BASE[1];
      arr[i * 3 + 2] = BASE[2];
    }
  }
  attr.needsUpdate = true;
}

export function paintVerticesInRadius(
  geom: THREE.BufferGeometry,
  hitLocal: THREE.Vector3,
  radius: number,
  labelValue: number,
  labels: Uint8Array,
): number {
  const pos = geom.attributes.position;
  const r2 = radius * radius;
  let changed = 0;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - hitLocal.x;
    const dy = pos.getY(i) - hitLocal.y;
    const dz = pos.getZ(i) - hitLocal.z;
    if (dx * dx + dy * dy + dz * dz <= r2) {
      if (labels[i] !== labelValue) {
        labels[i] = labelValue;
        changed++;
      }
    }
  }
  return changed;
}
