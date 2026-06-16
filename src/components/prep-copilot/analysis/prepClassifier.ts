import * as THREE from "three";
import { LABEL_UNLABELED, LABEL_PREP, isPrepLabel } from "./prepLabels";

export const FEATURE_DIM = 4;

export type Adjacency = Uint32Array[];

export type TrainResult = {
  examples: number;
  positives: number;
  negatives: number;
  loss: number;
  accuracy: number;
};

export function buildAdjacency(geom: THREE.BufferGeometry): Adjacency {
  const pos = geom.attributes.position;
  const idx = geom.index;
  const n = pos.count;
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set());
  const addEdge = (a: number, b: number) => {
    if (a !== b) { sets[a].add(b); sets[b].add(a); }
  };
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      addEdge(a, b); addEdge(b, c); addEdge(c, a);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      addEdge(i, i + 1); addEdge(i + 1, i + 2); addEdge(i, i + 2);
    }
  }
  return sets.map((s) => Uint32Array.from(s));
}

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
    let normalDot = 0, alongNSum = 0, alongNSq = 0;
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
    out[i * FEATURE_DIM + 0] = Math.hypot(dx / k, dy / k, dz / k) / scale;
    out[i * FEATURE_DIM + 1] = 1 - normalDot / k;
    out[i * FEATURE_DIM + 2] = (alongNSum / k) / scale;
    out[i * FEATURE_DIM + 3] = Math.sqrt(alongNSq / k) / scale;
  }

  // Z-score normalization per feature
  const mean = new Float32Array(FEATURE_DIM);
  const std = new Float32Array(FEATURE_DIM);
  for (let j = 0; j < FEATURE_DIM; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += out[i * FEATURE_DIM + j];
    mean[j] = s / n;
    let v = 0;
    for (let i = 0; i < n; i++) {
      const d = out[i * FEATURE_DIM + j] - mean[j]; v += d * d;
    }
    std[j] = Math.sqrt(v / n) || 1;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < FEATURE_DIM; j++) {
      out[i * FEATURE_DIM + j] = (out[i * FEATURE_DIM + j] - mean[j]) / std[j];
    }
  }
  return out;
}

export class PrepClassifier {
  weights = new Float32Array(FEATURE_DIM + 1);
  private examples: { f: Float32Array; y: number }[] = [];

  get sampleCount() { return this.examples.length; }
  get positiveCount() { return this.examples.reduce((a, e) => a + e.y, 0); }

  ingest(features: Float32Array, labels: Uint8Array) {
    const n = labels.length;
    for (let i = 0; i < n; i++) {
      if (labels[i] === LABEL_UNLABELED) continue;
      const f = features.slice(i * FEATURE_DIM, (i + 1) * FEATURE_DIM);
      this.examples.push({ f, y: isPrepLabel(labels[i]) ? 1 : 0 });
    }
  }

  reset() {
    this.examples = [];
    this.weights = new Float32Array(FEATURE_DIM + 1);
  }

  fitFresh(features: Float32Array, labels: Uint8Array, epochs = 400, lr = 0.4): TrainResult {
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
        loss += w * (-ex.y * Math.log(p + 1e-9) - (1 - ex.y) * Math.log(1 - p + 1e-9));
      }
      for (let j = 0; j < FEATURE_DIM + 1; j++) {
        W[j] -= (lr * grad[j]) / N;
        if (j < FEATURE_DIM) W[j] -= lr * 0.001 * W[j];
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
    return { examples: N, positives, negatives, loss: lastLoss, accuracy: correct / N };
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
