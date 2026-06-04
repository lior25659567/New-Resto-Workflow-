/**
 * Jacobi SVD for 3x3 matrices.
 * Decomposes H = U * diag(S) * V^T
 */

type Mat3 = [number, number, number, number, number, number, number, number, number];

function identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function matMul(A: Mat3, B: Mat3): Mat3 {
  return [
    A[0]*B[0] + A[1]*B[3] + A[2]*B[6],
    A[0]*B[1] + A[1]*B[4] + A[2]*B[7],
    A[0]*B[2] + A[1]*B[5] + A[2]*B[8],
    A[3]*B[0] + A[4]*B[3] + A[5]*B[6],
    A[3]*B[1] + A[4]*B[4] + A[5]*B[7],
    A[3]*B[2] + A[4]*B[5] + A[5]*B[8],
    A[6]*B[0] + A[7]*B[3] + A[8]*B[6],
    A[6]*B[1] + A[7]*B[4] + A[8]*B[7],
    A[6]*B[2] + A[7]*B[5] + A[8]*B[8],
  ];
}

function transpose(M: Mat3): Mat3 {
  return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
}

function jacobiRotation(A: Mat3, p: number, q: number): { G: Mat3; Gt: Mat3 } {
  const app = A[p * 3 + p];
  const aqq = A[q * 3 + q];
  const apq = A[p * 3 + q];

  if (Math.abs(apq) < 1e-12) {
    return { G: identity(), Gt: identity() };
  }

  const tau = (aqq - app) / (2 * apq);
  const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
  const c = 1 / Math.sqrt(1 + t * t);
  const s = t * c;

  const G: Mat3 = identity();
  G[p * 3 + p] = c;
  G[q * 3 + q] = c;
  G[p * 3 + q] = s;
  G[q * 3 + p] = -s;

  const Gt: Mat3 = identity();
  Gt[p * 3 + p] = c;
  Gt[q * 3 + q] = c;
  Gt[p * 3 + q] = -s;
  Gt[q * 3 + p] = s;

  return { G, Gt };
}

function det3(M: Mat3): number {
  return (
    M[0] * (M[4] * M[8] - M[5] * M[7]) -
    M[1] * (M[3] * M[8] - M[5] * M[6]) +
    M[2] * (M[3] * M[7] - M[4] * M[6])
  );
}

export interface SVDResult {
  U: Mat3;
  S: [number, number, number];
  V: Mat3;
}

export function svd3x3(H: Mat3): SVDResult {
  // Compute H^T * H
  const HtH = matMul(transpose(H), H);

  // Jacobi eigenvalue decomposition of H^T * H → V, eigenvalues
  let V: Mat3 = identity();
  let D: Mat3 = [...HtH] as Mat3;

  for (let iter = 0; iter < 30; iter++) {
    let offDiag = Math.abs(D[1]) + Math.abs(D[2]) + Math.abs(D[5]);
    if (offDiag < 1e-10) break;

    for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as [number, number][]) {
      if (Math.abs(D[p * 3 + q]) < 1e-12) continue;
      const { G, Gt } = jacobiRotation(D, p, q);
      D = matMul(matMul(Gt, D), G);
      V = matMul(V, G);
    }
  }

  // Singular values are sqrt of eigenvalues of H^T * H
  const singularValues: [number, number, number] = [
    Math.sqrt(Math.max(0, D[0])),
    Math.sqrt(Math.max(0, D[4])),
    Math.sqrt(Math.max(0, D[8])),
  ];

  // U = H * V * S^-1
  const HV = matMul(H, V);
  const U: Mat3 = [...identity()] as Mat3;
  for (let col = 0; col < 3; col++) {
    const sv = singularValues[col];
    if (sv > 1e-10) {
      U[0 * 3 + col] = HV[0 * 3 + col] / sv;
      U[1 * 3 + col] = HV[1 * 3 + col] / sv;
      U[2 * 3 + col] = HV[2 * 3 + col] / sv;
    } else {
      U[0 * 3 + col] = col === 0 ? 1 : 0;
      U[1 * 3 + col] = col === 1 ? 1 : 0;
      U[2 * 3 + col] = col === 2 ? 1 : 0;
    }
  }

  return { U, S: singularValues, V };
}

export function computeRotation(H: Mat3): Mat3 {
  const { U, V } = svd3x3(H);
  let R = matMul(U, transpose(V));

  // Handle reflection: if det(R) < 0, negate the column of U with smallest singular value
  if (det3(R) < 0) {
    const Ucorrected: Mat3 = [...U] as Mat3;
    // Negate last column of U
    Ucorrected[2] = -Ucorrected[2];
    Ucorrected[5] = -Ucorrected[5];
    Ucorrected[8] = -Ucorrected[8];
    R = matMul(Ucorrected, transpose(V));
  }

  return R;
}
