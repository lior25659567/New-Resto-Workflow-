import * as THREE from "three";

// Per-vertex labels: 0 = unlabeled, 1 = prep, 2 = background.
export const LABEL_UNLABELED = 0;
export const LABEL_PREP = 1;
export const LABEL_BACKGROUND = 2;
// Sub-regions of the prep, painted on top of (and counted as part of) the prep.
export const LABEL_MARGINAL = 3;
export const LABEL_OCCLUSAL = 4;

// A vertex belongs to the prep if it carries any prep-like label. "Whole prep"
// operations (frame, centroid, undercut, reduction "All") use this so the
// generic Prep paint and the Marginal/Occlusal sub-regions are treated as one.
export function isPrepLabel(v: number): boolean {
  return v === LABEL_PREP || v === LABEL_MARGINAL || v === LABEL_OCCLUSAL;
}

// Which prep region a heatmap / reduction readout is scoped to.
export type PrepRegion = "all" | "marginal" | "occlusal";

// Build a 0/1 vertex mask selecting a prep region. "all" = the whole prep.
export function regionMask(labels: Uint8Array, region: PrepRegion): Uint8Array {
  const out = new Uint8Array(labels.length);
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    out[i] =
      region === "all"
        ? isPrepLabel(l)
          ? 1
          : 0
        : region === "marginal"
          ? l === LABEL_MARGINAL
            ? 1
            : 0
          : l === LABEL_OCCLUSAL
            ? 1
            : 0;
  }
  return out;
}

// The single label value backing a sub-region, or undefined for "all" (which
// spans every prep-like label). Used to scope per-region reduction stats.
export function regionLabelValue(region: PrepRegion): number | undefined {
  return region === "marginal"
    ? LABEL_MARGINAL
    : region === "occlusal"
      ? LABEL_OCCLUSAL
      : undefined;
}

// Count vertices carrying a specific label value.
export function countLabel(labels: Uint8Array, value: number): number {
  let n = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] === value) n++;
  return n;
}

export type Adjacency = Uint32Array[]; // adj[i] = neighbor vertex indices

export function buildAdjacency(geom: THREE.BufferGeometry): Adjacency {
  const pos = geom.attributes.position;
  const idx = geom.index;
  const n = pos.count;
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set());
  const addEdge = (a: number, b: number) => {
    if (a !== b) {
      sets[a].add(b);
      sets[b].add(a);
    }
  };
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i),
        b = idx.getX(i + 1),
        c = idx.getX(i + 2);
      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, a);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i, i + 2);
    }
  }
  return sets.map((s) => Uint32Array.from(s));
}

// ---------------------------------------------------------------------------
// Per-vertex features — orientation-invariant so the same trained model works
// across scans in arbitrary poses.
//
// 4 features per vertex:
//   0. Laplacian magnitude (mean-offset length / mesh scale) — "bumpiness"
//   1. Normal variation (1 - cos angle between self normal & mean neighbor)
//   2. Signed concavity (mean of (neighbor - self) · self_normal / mesh scale)
//                        positive = convex (cusp), negative = concave (groove)
//   3. RMS offset along normal / mesh scale — local roughness
// All features are then z-score normalized per mesh so they're comparable.
// ---------------------------------------------------------------------------
export const FEATURE_DIM = 4;

export function computeVertexFeatures(
  geom: THREE.BufferGeometry,
  adj: Adjacency,
): Float32Array {
  if (!geom.attributes.normal) geom.computeVertexNormals();
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal!;
  const n = pos.count;
  geom.computeBoundingSphere();
  const scale = geom.boundingSphere?.radius || 1;
  const out = new Float32Array(n * FEATURE_DIM);

  for (let i = 0; i < n; i++) {
    const nbrs = adj[i];
    if (!nbrs || nbrs.length === 0) continue;
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    let nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i);
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    let dx = 0, dy = 0, dz = 0;
    let normalDot = 0;
    let alongNSum = 0;
    let alongNSq = 0;
    for (let k = 0; k < nbrs.length; k++) {
      const j = nbrs[k];
      const ex = pos.getX(j) - px;
      const ey = pos.getY(j) - py;
      const ez = pos.getZ(j) - pz;
      dx += ex; dy += ey; dz += ez;
      let mx = norm.getX(j), my = norm.getY(j), mz = norm.getZ(j);
      const ml = Math.hypot(mx, my, mz) || 1;
      mx /= ml; my /= ml; mz /= ml;
      normalDot += nx * mx + ny * my + nz * mz;
      const alongN = ex * nx + ey * ny + ez * nz;
      alongNSum += alongN;
      alongNSq += alongN * alongN;
    }
    const k = nbrs.length;
    const meanLap = Math.hypot(dx / k, dy / k, dz / k) / scale;
    const normalVar = 1 - normalDot / k;
    const concavity = (alongNSum / k) / scale;
    const rough = Math.sqrt(alongNSq / k) / scale;

    out[i * FEATURE_DIM + 0] = meanLap;
    out[i * FEATURE_DIM + 1] = normalVar;
    out[i * FEATURE_DIM + 2] = concavity;
    out[i * FEATURE_DIM + 3] = rough;
  }

  // Per-mesh z-score normalization.
  const mean = new Float32Array(FEATURE_DIM);
  const std = new Float32Array(FEATURE_DIM);
  for (let j = 0; j < FEATURE_DIM; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += out[i * FEATURE_DIM + j];
    mean[j] = s / n;
    let v = 0;
    for (let i = 0; i < n; i++) {
      const d = out[i * FEATURE_DIM + j] - mean[j];
      v += d * d;
    }
    std[j] = Math.sqrt(v / n) || 1;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < FEATURE_DIM; j++) {
      out[i * FEATURE_DIM + j] =
        (out[i * FEATURE_DIM + j] - mean[j]) / std[j];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Logistic regression classifier — fits in tens of ms on thousands of
// examples; weights persist across meshes so you can label one scan, predict
// on the next.
// ---------------------------------------------------------------------------
export type TrainResult = {
  examples: number;
  positives: number;
  negatives: number;
  loss: number;
  accuracy: number;
};

export class PrepClassifier {
  weights = new Float32Array(FEATURE_DIM + 1); // last entry = bias
  private examples: { f: Float32Array; y: number }[] = [];

  get sampleCount() {
    return this.examples.length;
  }

  get positiveCount() {
    return this.examples.reduce((a, e) => a + e.y, 0);
  }

  /** Adds the currently-labeled vertices of a mesh as training examples. */
  ingest(features: Float32Array, labels: Uint8Array) {
    const n = labels.length;
    for (let i = 0; i < n; i++) {
      if (labels[i] === LABEL_UNLABELED) continue;
      const f = features.slice(i * FEATURE_DIM, (i + 1) * FEATURE_DIM);
      this.examples.push({ f, y: labels[i] === LABEL_PREP ? 1 : 0 });
    }
  }

  reset() {
    this.examples = [];
    this.weights = new Float32Array(FEATURE_DIM + 1);
  }

  /** Replaces all examples with whatever is currently labeled (so the user's
   *  most recent paint strokes win — easier than tracking sources). */
  fitFresh(
    features: Float32Array,
    labels: Uint8Array,
    epochs = 400,
    lr = 0.4,
  ): TrainResult {
    this.examples = [];
    this.ingest(features, labels);
    return this.fit(epochs, lr);
  }

  fit(epochs = 400, lr = 0.4): TrainResult {
    const N = this.examples.length;
    const positives = this.examples.reduce((a, e) => a + e.y, 0);
    const negatives = N - positives;
    if (N === 0 || positives === 0 || negatives === 0) {
      return { examples: N, positives, negatives, loss: NaN, accuracy: NaN };
    }
    // Class re-weighting so minority class isn't drowned out.
    const wPos = N / (2 * positives);
    const wNeg = N / (2 * negatives);
    const W = this.weights;
    let lastLoss = NaN;
    for (let e = 0; e < epochs; e++) {
      const grad = new Float32Array(FEATURE_DIM + 1);
      let loss = 0;
      for (let i = 0; i < N; i++) {
        const ex = this.examples[i];
        const x = ex.f;
        let z = W[FEATURE_DIM];
        for (let j = 0; j < FEATURE_DIM; j++) z += W[j] * x[j];
        const p = 1 / (1 + Math.exp(-z));
        const w = ex.y === 1 ? wPos : wNeg;
        const err = w * (p - ex.y);
        for (let j = 0; j < FEATURE_DIM; j++) grad[j] += err * x[j];
        grad[FEATURE_DIM] += err;
        loss +=
          w * (-ex.y * Math.log(p + 1e-9) - (1 - ex.y) * Math.log(1 - p + 1e-9));
      }
      for (let j = 0; j < FEATURE_DIM + 1; j++) {
        W[j] -= (lr * grad[j]) / N;
        if (j < FEATURE_DIM) W[j] -= lr * 0.001 * W[j]; // L2
      }
      lastLoss = loss / N;
    }
    let correct = 0;
    for (let i = 0; i < N; i++) {
      const x = this.examples[i].f;
      let z = W[FEATURE_DIM];
      for (let j = 0; j < FEATURE_DIM; j++) z += W[j] * x[j];
      const p = 1 / (1 + Math.exp(-z)) >= 0.5 ? 1 : 0;
      if (p === this.examples[i].y) correct++;
    }
    return {
      examples: N,
      positives,
      negatives,
      loss: lastLoss,
      accuracy: correct / N,
    };
  }

  predict(features: Float32Array, n: number): Float32Array {
    const out = new Float32Array(n);
    const W = this.weights;
    for (let i = 0; i < n; i++) {
      let z = W[FEATURE_DIM];
      for (let j = 0; j < FEATURE_DIM; j++) {
        z += W[j] * features[i * FEATURE_DIM + j];
      }
      out[i] = 1 / (1 + Math.exp(-z));
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Brush painting & color helpers.
// ---------------------------------------------------------------------------
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

const BASE: [number, number, number] = [0.95, 0.92, 0.84]; // ivory
const PREP: [number, number, number] = [0.96, 0.28, 0.30]; // red
const BG: [number, number, number] = [0.27, 0.55, 0.95]; // blue
const MARGINAL: [number, number, number] = [0.10, 0.72, 0.66]; // teal
const OCCLUSAL: [number, number, number] = [0.60, 0.40, 0.92]; // violet

// Per-label paint color, exported so panels can show matching swatches.
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

function ensureColorAttr(geom: THREE.BufferGeometry, n: number) {
  let attr = geom.attributes.color as THREE.BufferAttribute | undefined;
  if (!attr || attr.count !== n) {
    attr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geom.setAttribute("color", attr);
  }
  return attr;
}

export function labelsToColors(
  labels: Uint8Array,
  geom: THREE.BufferGeometry,
) {
  const n = labels.length;
  const attr = ensureColorAttr(geom, n);
  const arr = attr.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const c = labelColor(labels[i]);
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  }
  attr.needsUpdate = true;
}

/** Overlay predictions on top of current labels. Manually-labeled vertices
 *  keep their hand-painted color; everything else is shaded by prediction. */
export function predictionsToColors(
  probs: Float32Array,
  threshold: number,
  labels: Uint8Array,
  geom: THREE.BufferGeometry,
) {
  const n = probs.length;
  const attr = ensureColorAttr(geom, n);
  const arr = attr.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l !== LABEL_UNLABELED) {
      // Any hand-painted label (prep / sub-region / background) keeps its color.
      const c = labelColor(l);
      arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
      continue;
    }
    const p = probs[i];
    if (p >= threshold) {
      // Lerp from ivory→red, stronger as confidence grows.
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
