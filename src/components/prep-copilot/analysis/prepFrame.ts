import * as THREE from "three";
import { isPrepLabel } from "./prepLabels";

export type OcclusalFrame = {
  center: THREE.Vector3;
  occlusal: THREE.Vector3;
  longDir: THREE.Vector3;
  crossDir: THREE.Vector3;
};

export type PrepFrame = {
  center: THREE.Vector3;
  longDir: THREE.Vector3;
  crossDir: THREE.Vector3;
  up: THREE.Vector3;
  longSpan: number;
  crossSpan: number;
  upSpan: number;
};

export type SectionPlane = "sagittal" | "coronal" | "axial";

function jacobi3(M: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = 3;
  const V: number[][] = [[1,0,0],[0,1,0],[0,0,1]];
  const A: number[][] = M.map((r) => [...r]);
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-20) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * apq);
        const sign = theta >= 0 ? 1 : -1;
        const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        const tau = s / (1 + c);
        A[p][p] -= t * apq;
        A[q][q] += t * apq;
        A[p][q] = A[q][p] = 0;
        for (let r = 0; r < n; r++) {
          if (r !== p && r !== q) {
            const arp = A[r][p];
            const arq = A[r][q];
            A[r][p] = A[p][r] = arp - s * (arq + tau * arp);
            A[r][q] = A[q][r] = arq + s * (arp - tau * arq);
          }
        }
        for (let r = 0; r < n; r++) {
          const vrp = V[r][p];
          const vrq = V[r][q];
          V[r][p] = vrp - s * (vrq + tau * vrp);
          V[r][q] = vrq + s * (vrp - tau * vrq);
        }
      }
    }
  }
  return { eigenvalues: [A[0][0], A[1][1], A[2][2]], eigenvectors: V };
}

export function computeOcclusalFrame(
  mesh: THREE.Mesh,
  opts: { towardBiting?: THREE.Vector3 } = {},
): OcclusalFrame | null {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position;
  if (!pos || pos.count < 16) return null;
  mesh.updateMatrixWorld(true);
  const mat = mesh.matrixWorld;
  const stride = Math.max(1, Math.floor(pos.count / 20000));
  const pts: number[] = [];
  const v = new THREE.Vector3();
  let cx = 0, cy = 0, cz = 0, count = 0;
  for (let i = 0; i < pos.count; i += stride) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mat);
    pts.push(v.x, v.y, v.z);
    cx += v.x; cy += v.y; cz += v.z;
    count++;
  }
  if (count < 8) return null;
  cx /= count; cy /= count; cz /= count;

  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - cx, dy = pts[i + 1] - cy, dz = pts[i + 2] - cz;
    xx += dx * dx; xy += dx * dy; xz += dx * dz;
    yy += dy * dy; yz += dy * dz; zz += dz * dz;
  }
  const { eigenvalues, eigenvectors } = jacobi3([[xx,xy,xz],[xy,yy,yz],[xz,yz,zz]]);
  const order = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const axis = (k: number) =>
    new THREE.Vector3(eigenvectors[0][k], eigenvectors[1][k], eigenvectors[2][k]).normalize();
  const longDir = axis(order[0]);
  const crossDir = axis(order[1]);
  const occlusal = axis(order[2]);
  const center = new THREE.Vector3(cx, cy, cz);

  let sign = 0;
  if (opts.towardBiting) {
    sign = Math.sign(opts.towardBiting.clone().sub(center).dot(occlusal));
  }
  if (sign === 0) {
    let pMin = Infinity, pMax = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      const p = (pts[i] - cx) * occlusal.x + (pts[i + 1] - cy) * occlusal.y + (pts[i + 2] - cz) * occlusal.z;
      if (p < pMin) pMin = p;
      if (p > pMax) pMax = p;
    }
    const band = (pMax - pMin) * 0.18 || 1;
    let loN = 0, loR = 0, hiN = 0, hiR = 0;
    for (let i = 0; i < pts.length; i += 3) {
      const dx = pts[i] - cx, dy = pts[i + 1] - cy, dz = pts[i + 2] - cz;
      const p = dx * occlusal.x + dy * occlusal.y + dz * occlusal.z;
      const a = dx * longDir.x + dy * longDir.y + dz * longDir.z;
      const b = dx * crossDir.x + dy * crossDir.y + dz * crossDir.z;
      const r = Math.hypot(a, b);
      if (p <= pMin + band) { loN++; loR += r; }
      else if (p >= pMax - band) { hiN++; hiR += r; }
    }
    const loMean = loN ? loR / loN : Infinity;
    const hiMean = hiN ? hiR / hiN : Infinity;
    sign = hiMean <= loMean ? 1 : -1;
  }
  if (sign < 0) occlusal.negate();
  return { center, occlusal, longDir, crossDir };
}

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
  if (prepVerts.length < 5) return null;
  return frameFromVerts(txMesh, prepVerts, fallbackUp);
}

function frameFromVerts(
  txMesh: THREE.Mesh,
  pts: THREE.Vector3[],
  fallbackUp?: THREE.Vector3,
): PrepFrame | null {
  const center = new THREE.Vector3();
  for (const p of pts) center.add(p);
  center.multiplyScalar(1 / pts.length);

  const camUp = new THREE.Vector3();
  const oFrame = computeOcclusalFrame(txMesh, { towardBiting: center });
  if (oFrame) camUp.copy(oFrame.occlusal);
  else if (fallbackUp) camUp.copy(fallbackUp);
  else camUp.set(0, 1, 0);
  camUp.normalize();

  let u = new THREE.Vector3(1, 0, 0).cross(camUp);
  if (u.lengthSq() < 1e-6) u = new THREE.Vector3(0, 0, 1).cross(camUp);
  u.normalize();
  const w = new THREE.Vector3().crossVectors(camUp, u).normalize();

  let Sxx = 0, Sxy = 0, Syy = 0;
  const tmp = new THREE.Vector3();
  for (const p of pts) {
    tmp.subVectors(p, center);
    const a = tmp.dot(u);
    const b = tmp.dot(w);
    Sxx += a * a; Sxy += a * b; Syy += b * b;
  }
  let evA: number, evB: number;
  if (Math.abs(Sxy) > 1e-9) {
    const tau = (Sxx + Syy) / 2;
    const delta = Math.sqrt(((Sxx - Syy) / 2) ** 2 + Sxy * Sxy);
    const lambda = tau + delta;
    evA = lambda - Syy; evB = Sxy;
  } else if (Sxx >= Syy) { evA = 1; evB = 0; }
  else { evA = 0; evB = 1; }
  const evLen = Math.hypot(evA, evB) || 1;
  evA /= evLen; evB /= evLen;

  const longDir = new THREE.Vector3().addScaledVector(u, evA).addScaledVector(w, evB).normalize();
  const crossDir = new THREE.Vector3().addScaledVector(u, -evB).addScaledVector(w, evA).normalize();

  let longMin = Infinity, longMax = -Infinity;
  let crossMin = Infinity, crossMax = -Infinity;
  let upMin = Infinity, upMax = -Infinity;
  for (const p of pts) {
    tmp.subVectors(p, center);
    const l = tmp.dot(longDir);
    const c = tmp.dot(crossDir);
    const up = tmp.dot(camUp);
    if (l < longMin) longMin = l; if (l > longMax) longMax = l;
    if (c < crossMin) crossMin = c; if (c > crossMax) crossMax = c;
    if (up < upMin) upMin = up; if (up > upMax) upMax = up;
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

export function planeFrameFor(
  frame: PrepFrame,
  plane: SectionPlane,
): { quaternion: THREE.Quaternion; width: number; height: number } {
  let normal: THREE.Vector3;
  let xAxis: THREE.Vector3;
  let width: number;
  let height: number;
  if (plane === "axial") {
    normal = frame.up; xAxis = frame.longDir;
    width = frame.longSpan; height = frame.crossSpan;
  } else if (plane === "sagittal") {
    normal = frame.longDir; xAxis = frame.crossDir;
    width = frame.crossSpan; height = frame.upSpan;
  } else {
    normal = frame.crossDir; xAxis = frame.longDir;
    width = frame.longSpan; height = frame.upSpan;
  }
  const z = normal.clone().normalize();
  let x = xAxis.clone().normalize();
  x = x.sub(z.clone().multiplyScalar(x.dot(z)));
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3(1, 0, 0).cross(z);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);
  const f = 1.15;
  return { quaternion, width: Math.max(width, 4) * f, height: Math.max(height, 4) * f };
}
