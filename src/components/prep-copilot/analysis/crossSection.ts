import * as THREE from "three";

export type Section = {
  id: number;
  origin: THREE.Vector3;
  quaternion: THREE.Quaternion;
  color: number;
};

export type CrossSectionData = {
  id: number;
  color: number;
  txSegments: Float32Array;
  preSegments: Float32Array;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  measurements: { tx: [number, number]; pre: [number, number]; mm: number }[];
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  up: THREE.Vector3;
};

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
  const interp = (p: THREE.Vector3, q: THREE.Vector3, dp: number, dq: number): THREE.Vector3 => {
    const t = dp / (dp - dq);
    return new THREE.Vector3().lerpVectors(p, q, t);
  };
  const triCount = index ? index.count / 3 : pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    let ia: number, ib: number, ic: number;
    if (index) {
      ia = index.getX(t * 3); ib = index.getX(t * 3 + 1); ic = index.getX(t * 3 + 2);
    } else {
      ia = t * 3; ib = t * 3 + 1; ic = t * 3 + 2;
    }
    va.fromBufferAttribute(pos, ia).applyMatrix4(mat);
    vb.fromBufferAttribute(pos, ib).applyMatrix4(mat);
    vc.fromBufferAttribute(pos, ic).applyMatrix4(mat);
    const dA = plane.distanceToPoint(va);
    const dB = plane.distanceToPoint(vb);
    const dC = plane.distanceToPoint(vc);
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
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(sec.quaternion);
    const upInPlane = new THREE.Vector3(0, 1, 0).applyQuaternion(sec.quaternion);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(sec.quaternion);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, sec.origin);
    const txSegs = computeCrossSection(txMesh, txGeom, plane, dir, upInPlane, sec.origin);
    const preSegs = computeCrossSection(preMesh, preGeom, plane, dir, upInPlane, sec.origin);

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
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
      xMin = -half; xMax = half; yMin = -1; yMax = 1;
    }

    const measurements: CrossSectionData["measurements"] = [];
    if (txSegs.length > 0 && preSegs.length > 0) {
      const txPts: [number, number][] = [];
      for (let i = 0; i < txSegs.length; i += 2) txPts.push([txSegs[i], txSegs[i + 1]]);
      const prePts: [number, number][] = [];
      for (let i = 0; i < preSegs.length; i += 2) prePts.push([preSegs[i], preSegs[i + 1]]);
      const ts = [0.15, 0.32, 0.5, 0.68, 0.85];
      for (const t of ts) {
        const targetX = xMin + t * (xMax - xMin);
        let bestTx = txPts[0], bestDx = Infinity;
        for (const p of txPts) {
          const dx = Math.abs(p[0] - targetX);
          if (dx < bestDx) { bestDx = dx; bestTx = p; }
        }
        let bestPre = prePts[0], bestD2 = Infinity;
        for (const p of prePts) {
          const d2 = (p[0] - bestTx[0]) ** 2 + (p[1] - bestTx[1]) ** 2;
          if (d2 < bestD2) { bestD2 = d2; bestPre = p; }
        }
        measurements.push({ tx: bestTx, pre: bestPre, mm: Math.sqrt(bestD2) });
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
