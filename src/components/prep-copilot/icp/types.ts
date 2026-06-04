import type { Matrix4 } from 'three';

export interface ICPOptions {
  maxIterations?: number;
  convergenceThreshold?: number;
  sampleCount?: number;
  outlierRejectionFactor?: number;
}

export interface ICPResult {
  matrix: Matrix4;
  iterations: number;
  meanError: number;
  converged: boolean;
}
