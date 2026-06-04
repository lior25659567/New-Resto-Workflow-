import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { computeRotation } from './svd3x3';
import type { ICPOptions, ICPResult } from './types';

const DEFAULT_OPTIONS: Required<ICPOptions> = {
  maxIterations: 50,
  convergenceThreshold: 0.001,
  sampleCount: 8000,
  outlierRejectionFactor: 3,
};

function sampleVertices(geometry: BufferGeometry, count: number): Vector3[] {
  const positions = geometry.getAttribute('position');
  const total = positions.count;
  const step = Math.max(1, Math.floor(total / count));
  const samples: Vector3[] = [];

  for (let i = 0; i < total && samples.length < count; i += step) {
    samples.push(new Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)));
  }
  return samples;
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function icpAlign(
  source: BufferGeometry,
  target: BufferGeometry,
  options?: ICPOptions,
): ICPResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Ensure target has an index for BVH
  if (!target.index) {
    const count = target.getAttribute('position').count;
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    target.setIndex(new BufferAttribute(indices, 1));
  }

  const bvh = new MeshBVH(target);
  const samples = sampleVertices(source, opts.sampleCount);

  const accumTransform = new Matrix4();
  let prevMeanError = Infinity;
  let iterations = 0;
  let converged = false;

  const closestPoint = new Vector3();
  const tempTarget = { point: new Vector3(), distance: 0 };

  for (let iter = 0; iter < opts.maxIterations; iter++) {
    iterations = iter + 1;

    // Find correspondences
    const distances: number[] = [];
    const correspondences: { src: Vector3; tgt: Vector3; dist: number }[] = [];

    for (const srcPt of samples) {
      bvh.closestPointToPoint(srcPt, tempTarget);
      const dist = srcPt.distanceTo(tempTarget.point);
      distances.push(dist);
      correspondences.push({
        src: srcPt.clone(),
        tgt: tempTarget.point.clone(),
        dist,
      });
    }

    // Outlier rejection
    const median = computeMedian(distances);
    const threshold = median * opts.outlierRejectionFactor;
    const inliers = correspondences.filter((c) => c.dist <= threshold);

    if (inliers.length < 10) break;

    // Compute centroids
    const srcCentroid = new Vector3();
    const tgtCentroid = new Vector3();
    for (const { src, tgt } of inliers) {
      srcCentroid.add(src);
      tgtCentroid.add(tgt);
    }
    srcCentroid.divideScalar(inliers.length);
    tgtCentroid.divideScalar(inliers.length);

    // Build cross-covariance matrix H (3x3, row-major)
    const H: [number, number, number, number, number, number, number, number, number] =
      [0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (const { src, tgt } of inliers) {
      const sx = src.x - srcCentroid.x;
      const sy = src.y - srcCentroid.y;
      const sz = src.z - srcCentroid.z;
      const tx = tgt.x - tgtCentroid.x;
      const ty = tgt.y - tgtCentroid.y;
      const tz = tgt.z - tgtCentroid.z;

      H[0] += sx * tx; H[1] += sx * ty; H[2] += sx * tz;
      H[3] += sy * tx; H[4] += sy * ty; H[5] += sy * tz;
      H[6] += sz * tx; H[7] += sz * ty; H[8] += sz * tz;
    }

    // Compute rotation via SVD
    const R = computeRotation(H);

    // Compute translation: t = tgtCentroid - R * srcCentroid
    const rSrcX = R[0] * srcCentroid.x + R[1] * srcCentroid.y + R[2] * srcCentroid.z;
    const rSrcY = R[3] * srcCentroid.x + R[4] * srcCentroid.y + R[5] * srcCentroid.z;
    const rSrcZ = R[6] * srcCentroid.x + R[7] * srcCentroid.y + R[8] * srcCentroid.z;

    const tx = tgtCentroid.x - rSrcX;
    const ty = tgtCentroid.y - rSrcY;
    const tz = tgtCentroid.z - rSrcZ;

    // Build iteration transform
    const iterMatrix = new Matrix4();
    iterMatrix.set(
      R[0], R[1], R[2], tx,
      R[3], R[4], R[5], ty,
      R[6], R[7], R[8], tz,
      0, 0, 0, 1,
    );

    // Apply to samples
    for (const pt of samples) {
      pt.applyMatrix4(iterMatrix);
    }

    // Accumulate
    accumTransform.premultiply(iterMatrix);

    // Check convergence
    const meanError =
      inliers.reduce((sum, c) => sum + c.dist, 0) / inliers.length;

    if (Math.abs(prevMeanError - meanError) < opts.convergenceThreshold) {
      converged = true;
      prevMeanError = meanError;
      break;
    }
    prevMeanError = meanError;
  }

  return {
    matrix: accumTransform,
    iterations,
    meanError: prevMeanError,
    converged,
  };
}
