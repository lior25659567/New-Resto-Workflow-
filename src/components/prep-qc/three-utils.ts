import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export async function parsePly(
  buffer: ArrayBuffer,
): Promise<THREE.BufferGeometry> {
  const loader = new PLYLoader();
  const geom = loader.parse(buffer);
  if (!geom.attributes.normal) geom.computeVertexNormals();
  geom.center();
  return geom;
}

export type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  dispose: () => void;
  resize: () => void;
  // Register a callback run once per rendered frame (e.g. to update a
  // screen-space scale bar). Returns an unsubscribe fn.
  onFrame: (cb: () => void) => () => void;
};

export function createScene(
  container: HTMLDivElement,
  opts: { background?: string } = {},
): SceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background ?? "#D6E7F1");

  const w = container.clientWidth;
  const h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
  camera.position.set(0, 0, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  // lights — three-point setup with low ambient for clear form shading
  const hemi = new THREE.HemisphereLight(0xeaf2ff, 0x1a2230, 0.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(160, 240, 200);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9bb6d6, 0.7);
  fill.position.set(-220, -40, -60);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe8c8, 1.0);
  rim.position.set(-60, 80, -240);
  scene.add(rim);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Movement feel matches the project's canonical jaw viewer (see the
  // "3d model movment" skill): smooth glide, lively rotate, left = rotate /
  // right = pan / scroll = zoom, with polar limits so the arch can't flip.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 1.5;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 1.2;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI - 0.1;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  const frameCbs = new Set<() => void>();
  const onFrame = (cb: () => void) => {
    frameCbs.add(cb);
    return () => {
      frameCbs.delete(cb);
    };
  };

  let rafId = 0;
  const loop = () => {
    controls.update();
    renderer.render(scene, camera);
    frameCbs.forEach((cb) => cb());
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  const resize = () => {
    const W = container.clientWidth;
    const H = container.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const dispose = () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    controls.dispose();
    // Dispose only the materials we created here; geometries are owned by
    // the caller (they may be shared across steps / Strict-Mode remounts).
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { scene, camera, renderer, controls, dispose, resize, onFrame };
}

export type OcclusalFrame = {
  center: THREE.Vector3;
  occlusal: THREE.Vector3; // unit axis, points toward the biting surface
  longDir: THREE.Vector3; // mesiodistal (largest in-plane variance)
  crossDir: THREE.Vector3; // buccolingual
};

/** Auto-detect a jaw scan's occlusal axis via PCA of its vertices.
 *  A dental arch is broad in two directions (mesiodistal width + buccolingual
 *  depth of the horseshoe) and comparatively shallow along the occlusal
 *  (vertical) axis, so the smallest-variance principal axis is the occlusal
 *  direction. The sign is set to point toward the biting surface, using
 *  `towardBiting` (e.g. the prep centroid, which sits among the crowns) when
 *  available, otherwise a footprint heuristic: the cusp-tip end has a smaller
 *  in-plane cross-section than the gingival/base end. */
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
  let cx = 0,
    cy = 0,
    cz = 0,
    count = 0;
  for (let i = 0; i < pos.count; i += stride) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mat);
    pts.push(v.x, v.y, v.z);
    cx += v.x;
    cy += v.y;
    cz += v.z;
    count++;
  }
  if (count < 8) return null;
  cx /= count;
  cy /= count;
  cz /= count;

  let xx = 0,
    xy = 0,
    xz = 0,
    yy = 0,
    yz = 0,
    zz = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - cx,
      dy = pts[i + 1] - cy,
      dz = pts[i + 2] - cz;
    xx += dx * dx;
    xy += dx * dy;
    xz += dx * dz;
    yy += dy * dy;
    yz += dy * dz;
    zz += dz * dz;
  }
  const { eigenvalues, eigenvectors } = jacobi3([
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ]);
  // Order axes by variance: largest = long (mesiodistal), smallest = occlusal.
  const order = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const axis = (k: number) =>
    new THREE.Vector3(
      eigenvectors[0][k],
      eigenvectors[1][k],
      eigenvectors[2][k],
    ).normalize();
  const longDir = axis(order[0]);
  const crossDir = axis(order[1]);
  const occlusal = axis(order[2]);
  const center = new THREE.Vector3(cx, cy, cz);

  // Orient `occlusal` so it points toward the biting surface.
  let sign = 0;
  if (opts.towardBiting) {
    sign = Math.sign(opts.towardBiting.clone().sub(center).dot(occlusal));
  }
  if (sign === 0) {
    let pMin = Infinity,
      pMax = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      const p =
        (pts[i] - cx) * occlusal.x +
        (pts[i + 1] - cy) * occlusal.y +
        (pts[i + 2] - cz) * occlusal.z;
      if (p < pMin) pMin = p;
      if (p > pMax) pMax = p;
    }
    const band = (pMax - pMin) * 0.18 || 1;
    let loN = 0,
      loR = 0,
      hiN = 0,
      hiR = 0;
    for (let i = 0; i < pts.length; i += 3) {
      const dx = pts[i] - cx,
        dy = pts[i + 1] - cy,
        dz = pts[i + 2] - cz;
      const p = dx * occlusal.x + dy * occlusal.y + dz * occlusal.z;
      const a = dx * longDir.x + dy * longDir.y + dz * longDir.z;
      const b = dx * crossDir.x + dy * crossDir.y + dz * crossDir.z;
      const r = Math.hypot(a, b);
      if (p <= pMin + band) {
        loN++;
        loR += r;
      } else if (p >= pMax - band) {
        hiN++;
        hiR += r;
      }
    }
    const loMean = loN ? loR / loN : Infinity;
    const hiMean = hiN ? hiR / hiN : Infinity;
    // Biting side = the extreme with the SMALLER in-plane footprint (cusps).
    sign = hiMean <= loMean ? 1 : -1;
  }
  if (sign < 0) occlusal.negate();
  return { center, occlusal, longDir, crossDir };
}

/** Position the camera to look straight down `axis` at the given objects,
 *  framing them to fit. `up` orients the on-screen vertical. */
export function frameAlongAxis(
  handle: SceneHandle,
  objects: THREE.Object3D[],
  axis: THREE.Vector3,
  up: THREE.Vector3,
) {
  const box = new THREE.Box3();
  for (const o of objects) {
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    if (!b.isEmpty()) box.union(b);
  }
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fitDist = maxDim / (2 * Math.tan((Math.PI * handle.camera.fov) / 360));
  const dir = axis.clone().normalize();
  handle.camera.up.copy(up.clone().normalize());
  handle.camera.position.copy(
    center.clone().add(dir.multiplyScalar(fitDist * 1.6)),
  );
  handle.controls.target.copy(center);
  handle.camera.near = fitDist / 100;
  handle.camera.far = fitDist * 100;
  handle.camera.updateProjectionMatrix();
  handle.controls.update();
}

export function frameObjects(handle: SceneHandle, objects: THREE.Object3D[]) {
  const box = new THREE.Box3();
  for (const o of objects) {
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    if (!b.isEmpty()) box.union(b);
  }
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fitDist = maxDim / (2 * Math.tan((Math.PI * handle.camera.fov) / 360));
  const dir = new THREE.Vector3(0.4, 0.4, 1).normalize();
  handle.camera.position.copy(
    center.clone().add(dir.multiplyScalar(fitDist * 1.6)),
  );
  handle.controls.target.copy(center);
  handle.camera.near = fitDist / 100;
  handle.camera.far = fitDist * 100;
  handle.camera.updateProjectionMatrix();
}

/** Compute a per-vertex heatmap color on `target` based on distance from each
 *  target vertex (transformed by targetMatrix) to the nearest reference vertex
 *  (transformed by referenceMatrix). All distances are computed in WORLD space.
 *  Uses a uniform voxel grid for ~O(N) nearest-neighbor lookup. */
export function applyDistanceHeatmap(
  target: THREE.BufferGeometry,
  targetMatrix: THREE.Matrix4,
  reference: THREE.BufferGeometry,
  referenceMatrix: THREE.Matrix4,
  maxDistance = 1.4,
  mask?: Uint8Array | null,
  step = 0,
): void {
  const tPos = target.attributes.position;
  const rPos = reference.attributes.position;
  if (!tPos || !rPos) return;

  // Build world-space reference points (downsampled for memory).
  const SAMPLE = 20000;
  const refStride = Math.max(1, Math.floor(rPos.count / SAMPLE));
  const refCount = Math.ceil(rPos.count / refStride);
  const refPts = new Float32Array(refCount * 3);
  let ri = 0;
  const rv = new THREE.Vector3();
  for (let i = 0; i < rPos.count; i += refStride) {
    rv.fromBufferAttribute(rPos, i).applyMatrix4(referenceMatrix);
    refPts[ri * 3] = rv.x;
    refPts[ri * 3 + 1] = rv.y;
    refPts[ri * 3 + 2] = rv.z;
    ri++;
  }

  // Voxel grid bounds
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < refPts.length; i += 3) {
    const x = refPts[i],
      y = refPts[i + 1],
      z = refPts[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  // pad so target points slightly outside still find neighbors
  const pad = maxDistance * 2;
  minX -= pad;
  minY -= pad;
  minZ -= pad;
  maxX += pad;
  maxY += pad;
  maxZ += pad;

  const cell = Math.max(maxDistance, 0.5);
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell));
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell));
  const total = nx * ny * nz;
  // Cap grid memory; if too big, fall back to brute force
  if (total > 2_000_000) {
    bruteForceHeatmap(target, targetMatrix, refPts, maxDistance, mask, step);
    return;
  }

  const buckets: number[][] = new Array(total);
  const cellOf = (x: number, y: number, z: number) => {
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cell)));
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / cell)));
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cell)));
    return ix + nx * (iy + ny * iz);
  };
  for (let i = 0; i < refPts.length; i += 3) {
    const idx = cellOf(refPts[i], refPts[i + 1], refPts[i + 2]);
    (buckets[idx] ||= []).push(i);
  }

  const colors = new Float32Array(tPos.count * 3);
  const p = new THREE.Vector3();
  const maxD2 = maxDistance * maxDistance;
  const NEUTRAL_R = 0.55,
    NEUTRAL_G = 0.55,
    NEUTRAL_B = 0.58;
  for (let i = 0; i < tPos.count; i++) {
    if (mask && !mask[i]) {
      colors[i * 3] = NEUTRAL_R;
      colors[i * 3 + 1] = NEUTRAL_G;
      colors[i * 3 + 2] = NEUTRAL_B;
      continue;
    }
    p.fromBufferAttribute(tPos, i).applyMatrix4(targetMatrix);
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((p.x - minX) / cell)));
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((p.y - minY) / cell)));
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((p.z - minZ) / cell)));
    let best = Infinity;
    for (let dz = -1; dz <= 1; dz++) {
      const cz = iz + dz;
      if (cz < 0 || cz >= nz) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = iy + dy;
        if (cy < 0 || cy >= ny) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx;
          if (cx < 0 || cx >= nx) continue;
          const bucket = buckets[cx + nx * (cy + ny * cz)];
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            const ex = p.x - refPts[j];
            const ey = p.y - refPts[j + 1];
            const ez = p.z - refPts[j + 2];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 < best) best = d2;
          }
        }
      }
    }
    const d = best === Infinity ? maxDistance : Math.sqrt(best);
    let t = Math.min(1, d / maxDistance);
    if (step > 0) {
      const bands = Math.max(1, Math.round(maxDistance / step));
      t = Math.min(1, Math.floor(t * bands) / bands + 0.5 / bands);
    }
    const c = heatmapColor(t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    if (best > maxD2 * 4) {
      // beyond meaningful range — clamp to coolest color
    }
  }

  target.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// Per-vertex nearest-surface distance field (no colouring). Same voxel-grid
// search as the heatmap, but returns the raw distances so callers can threshold
// them — e.g. auto-detecting the prepped region as "where tx differs from pre".
// Distances with no reference point within `maxDistance` are clamped to it.
export function computeDistanceField(
  target: THREE.BufferGeometry,
  targetMatrix: THREE.Matrix4,
  reference: THREE.BufferGeometry,
  referenceMatrix: THREE.Matrix4,
  maxDistance = 5,
): Float32Array {
  const tPos = target.attributes.position;
  const rPos = reference.attributes.position;
  const out = new Float32Array(tPos ? tPos.count : 0);
  if (!tPos || !rPos) return out;

  const SAMPLE = 20000;
  const refStride = Math.max(1, Math.floor(rPos.count / SAMPLE));
  const refCount = Math.ceil(rPos.count / refStride);
  const refPts = new Float32Array(refCount * 3);
  let ri = 0;
  const rv = new THREE.Vector3();
  for (let i = 0; i < rPos.count; i += refStride) {
    rv.fromBufferAttribute(rPos, i).applyMatrix4(referenceMatrix);
    refPts[ri * 3] = rv.x;
    refPts[ri * 3 + 1] = rv.y;
    refPts[ri * 3 + 2] = rv.z;
    ri++;
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < refPts.length; i += 3) {
    const x = refPts[i],
      y = refPts[i + 1],
      z = refPts[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const pad = maxDistance * 2;
  minX -= pad;
  minY -= pad;
  minZ -= pad;
  maxX += pad;
  maxY += pad;
  maxZ += pad;

  const cell = Math.max(maxDistance, 0.5);
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell));
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell));
  const total = nx * ny * nz;

  const p = new THREE.Vector3();
  if (total > 2_000_000) {
    // Brute force fallback for pathological bounds.
    for (let i = 0; i < tPos.count; i++) {
      p.fromBufferAttribute(tPos, i).applyMatrix4(targetMatrix);
      let best = Infinity;
      for (let j = 0; j < refPts.length; j += 3) {
        const ex = p.x - refPts[j];
        const ey = p.y - refPts[j + 1];
        const ez = p.z - refPts[j + 2];
        const d2 = ex * ex + ey * ey + ez * ez;
        if (d2 < best) best = d2;
      }
      out[i] = best === Infinity ? maxDistance : Math.min(maxDistance, Math.sqrt(best));
    }
    return out;
  }

  const buckets: number[][] = new Array(total);
  for (let i = 0; i < refPts.length; i += 3) {
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((refPts[i] - minX) / cell)));
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((refPts[i + 1] - minY) / cell)));
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((refPts[i + 2] - minZ) / cell)));
    (buckets[ix + nx * (iy + ny * iz)] ||= []).push(i);
  }

  for (let i = 0; i < tPos.count; i++) {
    p.fromBufferAttribute(tPos, i).applyMatrix4(targetMatrix);
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((p.x - minX) / cell)));
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((p.y - minY) / cell)));
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((p.z - minZ) / cell)));
    let best = Infinity;
    for (let dz = -1; dz <= 1; dz++) {
      const cz = iz + dz;
      if (cz < 0 || cz >= nz) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = iy + dy;
        if (cy < 0 || cy >= ny) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx;
          if (cx < 0 || cx >= nx) continue;
          const bucket = buckets[cx + nx * (cy + ny * cz)];
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            const ex = p.x - refPts[j];
            const ey = p.y - refPts[j + 1];
            const ez = p.z - refPts[j + 2];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 < best) best = d2;
          }
        }
      }
    }
    out[i] = best === Infinity ? maxDistance : Math.min(maxDistance, Math.sqrt(best));
  }
  return out;
}

function bruteForceHeatmap(
  target: THREE.BufferGeometry,
  targetMatrix: THREE.Matrix4,
  refPts: Float32Array,
  maxDistance: number,
  mask?: Uint8Array | null,
  step = 0,
) {
  const tPos = target.attributes.position;
  const colors = new Float32Array(tPos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < tPos.count; i++) {
    if (mask && !mask[i]) {
      colors[i * 3] = 0.55;
      colors[i * 3 + 1] = 0.55;
      colors[i * 3 + 2] = 0.58;
      continue;
    }
    p.fromBufferAttribute(tPos, i).applyMatrix4(targetMatrix);
    let best = Infinity;
    for (let j = 0; j < refPts.length; j += 3) {
      const ex = p.x - refPts[j];
      const ey = p.y - refPts[j + 1];
      const ez = p.z - refPts[j + 2];
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 < best) best = d2;
    }
    const d = Math.sqrt(best);
    let t = Math.min(1, d / maxDistance);
    if (step > 0) {
      const bands = Math.max(1, Math.round(maxDistance / step));
      t = Math.min(1, Math.floor(t * bands) / bands + 0.5 / bands);
    }
    const c = heatmapColor(t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  target.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------------------
// Undercut / insertion-path analysis (on the labeled prep only).
//
// Given an insertion (withdrawal) axis, any prep surface whose outward normal
// points "back under" relative to that axis is an undercut: it cannot be drawn
// off along the path and will block crown seating. We detect those vertices,
// quantify them (count, area, angle), and can search for the insertion path
// that minimizes total undercut area ("optimal path of insertion").
// ---------------------------------------------------------------------------
export type UndercutResult = {
  // Unit withdrawal direction (the way the restoration pulls off the prep).
  insertionAxis: THREE.Vector3;
  center: THREE.Vector3; // prep centroid, world space
  prepCount: number;
  undercutCount: number;
  undercutPct: number; // by vertex count, 0..100
  prepAreaMm2: number;
  undercutAreaMm2: number;
  undercutAreaPct: number; // by surface area, 0..100
  maxUndercutDeg: number; // worst overhang past the draw limit
  meanUndercutDeg: number;
  optimized: boolean; // whether the axis was solved for, vs. supplied
};

const RAD2DEG = 180 / Math.PI;

/** Per-vertex surface area in world units (1/3 of each incident triangle). */
function perVertexAreaWorld(
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
): Float32Array {
  const pos = geom.attributes.position;
  const area = new Float32Array(pos.count);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const addTri = (i0: number, i1: number, i2: number) => {
    a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const third = (ab.cross(ac).length() * 0.5) / 3;
    area[i0] += third;
    area[i1] += third;
    area[i2] += third;
  };
  const idx = geom.index;
  if (idx) {
    for (let i = 0; i + 2 < idx.count; i += 3)
      addTri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  } else {
    for (let i = 0; i + 2 < pos.count; i += 3) addTri(i, i + 1, i + 2);
  }
  return area;
}

/** World-space outward unit normals as a flat [x,y,z,...] array. */
function worldNormals(
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
): Float32Array {
  if (!geom.attributes.normal) geom.computeVertexNormals();
  const nAttr = geom.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const out = new Float32Array(nAttr.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < nAttr.count; i++) {
    n.fromBufferAttribute(nAttr, i).applyMatrix3(nm).normalize();
    out[i * 3] = n.x;
    out[i * 3 + 1] = n.y;
    out[i * 3 + 2] = n.z;
  }
  return out;
}

/**
 * Analyze undercuts over the masked (prep) vertices for a given or optimized
 * insertion axis. Returns aggregate stats plus a full-length vertex `color`
 * array (neutral gray off the prep, green = draftable, yellow→red = undercut).
 */
export function analyzeUndercuts(
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  prepMask: Uint8Array,
  opts: {
    insertionAxis?: THREE.Vector3; // if given, used as the withdrawal axis
    optimize?: boolean; // search for the min-undercut axis (default: !insertionAxis)
    draftTolDeg?: number; // require this much taper; walls below it count as risk
  } = {},
): { result: UndercutResult; colors: Float32Array } | null {
  const pos = geom.attributes.position;
  if (!pos) return null;

  const prepIdx: number[] = [];
  const n = Math.min(prepMask.length, pos.count);
  for (let i = 0; i < n; i++) if (prepMask[i]) prepIdx.push(i);
  if (prepIdx.length < 8) return null;

  const normals = worldNormals(geom, matrix);
  const areas = perVertexAreaWorld(geom, matrix);

  // Prep centroid (world).
  const center = new THREE.Vector3();
  const wp = new THREE.Vector3();
  for (const i of prepIdx) {
    wp.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    center.add(wp);
  }
  center.multiplyScalar(1 / prepIdx.length);

  // Area-weighted mean outward normal → a natural starting withdrawal axis.
  const mean = new THREE.Vector3();
  for (const i of prepIdx)
    mean.set(
      mean.x + normals[i * 3] * areas[i],
      mean.y + normals[i * 3 + 1] * areas[i],
      mean.z + normals[i * 3 + 2] * areas[i],
    );
  if (mean.lengthSq() < 1e-9) mean.set(0, 0, 1);
  mean.normalize();

  // Surfaces draft below `draftTolDeg` are flagged: dot(n, axis) < sin(tol).
  const draftTol = opts.draftTolDeg ?? 0;
  const t0 = Math.sin((draftTol * Math.PI) / 180);

  const stride = Math.max(1, Math.floor(prepIdx.length / 4000));
  const undercutAreaFor = (ax: THREE.Vector3): number => {
    let s = 0;
    for (let k = 0; k < prepIdx.length; k += stride) {
      const i = prepIdx[k];
      const d =
        normals[i * 3] * ax.x +
        normals[i * 3 + 1] * ax.y +
        normals[i * 3 + 2] * ax.z;
      if (d < t0) s += areas[i];
    }
    return s;
  };

  const axis = opts.insertionAxis
    ? opts.insertionAxis.clone().normalize()
    : mean.clone();
  const optimize = opts.optimize ?? !opts.insertionAxis;

  if (optimize) {
    const best = axis.clone();
    let bestArea = undercutAreaFor(best);
    const ref = Math.abs(mean.z) < 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0);
    const e1 = new THREE.Vector3().crossVectors(mean, ref).normalize();
    const e2 = new THREE.Vector3().crossVectors(mean, e1).normalize();
    // Coarse-to-fine cone search around the current best direction.
    for (let coneDeg = 30; coneDeg >= 2; coneDeg /= 2) {
      const c0 = best.clone();
      const r = Math.tan((coneDeg * Math.PI) / 180);
      const N = 16;
      for (let a = 0; a < N; a++) {
        const ang = (a / N) * Math.PI * 2;
        for (const rr of [r * 0.5, r]) {
          const cand = c0
            .clone()
            .addScaledVector(e1, Math.cos(ang) * rr)
            .addScaledVector(e2, Math.sin(ang) * rr)
            .normalize();
          const ar = undercutAreaFor(cand);
          if (ar < bestArea) {
            bestArea = ar;
            best.copy(cand);
          }
        }
      }
    }
    axis.copy(best);
  }

  // Final pass over ALL vertices: colors + exact stats on the prep.
  const colors = new Float32Array(pos.count * 3);
  const NR = 0.55,
    NG = 0.55,
    NB = 0.58;
  let undercutCount = 0;
  let prepAreaMm2 = 0;
  let undercutAreaMm2 = 0;
  let maxDeg = 0;
  let sumDeg = 0;
  for (let i = 0; i < pos.count; i++) {
    if (!prepMask[i]) {
      colors[i * 3] = NR;
      colors[i * 3 + 1] = NG;
      colors[i * 3 + 2] = NB;
      continue;
    }
    const d = Math.max(
      -1,
      Math.min(
        1,
        normals[i * 3] * axis.x +
          normals[i * 3 + 1] * axis.y +
          normals[i * 3 + 2] * axis.z,
      ),
    );
    prepAreaMm2 += areas[i];
    if (d < t0) {
      undercutCount++;
      undercutAreaMm2 += areas[i];
      // Degrees short of the required draft: at draftTol = 0 this is the raw
      // overhang past parallel; with tolerance it adds the missing taper.
      const deg = draftTol - Math.asin(d) * RAD2DEG;
      if (deg > maxDeg) maxDeg = deg;
      sumDeg += deg;
      // Flag undercuts as one unmistakable solid red patch (no gradient) so the
      // blocked area reads at a glance regardless of overhang severity.
      colors[i * 3] = 0.9;
      colors[i * 3 + 1] = 0.11;
      colors[i * 3 + 2] = 0.11;
    } else {
      const draft = Math.asin(d) * RAD2DEG; // 0..90 of positive taper
      const t = Math.min(1, draft / 30); // light → deep green
      colors[i * 3] = 0.46 - 0.24 * t;
      colors[i * 3 + 1] = 0.74 - 0.06 * t;
      colors[i * 3 + 2] = 0.46 - 0.12 * t;
    }
  }

  const result: UndercutResult = {
    insertionAxis: axis.clone(),
    center,
    prepCount: prepIdx.length,
    undercutCount,
    undercutPct: (undercutCount / prepIdx.length) * 100,
    prepAreaMm2,
    undercutAreaMm2,
    undercutAreaPct: prepAreaMm2 > 0 ? (undercutAreaMm2 / prepAreaMm2) * 100 : 0,
    maxUndercutDeg: maxDeg,
    meanUndercutDeg: undercutCount > 0 ? sumDeg / undercutCount : 0,
    optimized: optimize,
  };
  return { result, colors };
}

// ---------------------------------------------------------------------------
// Auto-registration (ICP — Iterative Closest Point, point-to-point, Horn's
// quaternion method with a uniform voxel grid for fast nearest-neighbor).
//
// Mutates `preMesh.position` / `preMesh.quaternion` so the gizmo updates.
// `txMesh` stays fixed.
// ---------------------------------------------------------------------------
export type IcpResult = {
  iterations: number;
  // RMSE over the kept (trimmed) inlier correspondences — reflects fit quality
  // on the unchanged anatomy.
  rmse: number;
  // RMSE over ALL gated correspondences (before trimming) — a more honest,
  // comparable number that still includes the prepped/changed surface.
  fullRmse: number;
  samples: number;
  // Correspondences kept after robust trimming on the final iteration.
  inliers: number;
};

export function icpAlign(
  preMesh: THREE.Mesh,
  txMesh: THREE.Mesh,
  opts: {
    iterations?: number;
    samples?: number;
    maxDist?: number;
    // Fraction of best correspondences kept each iteration (trimmed ICP).
    // Rejects the prepped/changed region and noise that would otherwise pull
    // the fit off and inflate RMSE. 1 = classic ICP, ~0.7 = aggressive.
    trimRatio?: number;
  } = {},
): IcpResult {
  const iterations = opts.iterations ?? 60;
  const sampleTarget = opts.samples ?? 6000;
  const trimRatio = Math.min(1, Math.max(0.3, opts.trimRatio ?? 0.75));
  const preGeom = preMesh.geometry as THREE.BufferGeometry;
  const txGeom = txMesh.geometry as THREE.BufferGeometry;
  const prePos = preGeom.attributes.position;
  const txPos = txGeom.attributes.position;
  if (!prePos || !txPos)
    return { iterations: 0, rmse: NaN, fullRmse: NaN, samples: 0, inliers: 0 };

  // Sample pre vertices (indices stay constant across iterations; world coords change).
  const preStride = Math.max(1, Math.floor(prePos.count / sampleTarget));
  const preIdx: number[] = [];
  for (let i = 0; i < prePos.count; i += preStride) preIdx.push(i);

  // Sample tx vertices once in world space and build a voxel grid.
  txMesh.updateMatrixWorld(true);
  const txMat = txMesh.matrixWorld;
  const txStride = Math.max(1, Math.floor(txPos.count / 20000));
  const txCount = Math.ceil(txPos.count / txStride);
  const txWorld = new Float32Array(txCount * 3);
  let dMinX = Infinity,
    dMinY = Infinity,
    dMinZ = Infinity;
  let dMaxX = -Infinity,
    dMaxY = -Infinity,
    dMaxZ = -Infinity;
  {
    const v = new THREE.Vector3();
    let k = 0;
    for (let i = 0; i < txPos.count; i += txStride) {
      v.fromBufferAttribute(txPos, i).applyMatrix4(txMat);
      txWorld[k * 3] = v.x;
      txWorld[k * 3 + 1] = v.y;
      txWorld[k * 3 + 2] = v.z;
      if (v.x < dMinX) dMinX = v.x;
      if (v.x > dMaxX) dMaxX = v.x;
      if (v.y < dMinY) dMinY = v.y;
      if (v.y > dMaxY) dMaxY = v.y;
      if (v.z < dMinZ) dMinZ = v.z;
      if (v.z > dMaxZ) dMaxZ = v.z;
      k++;
    }
  }
  const diag = Math.hypot(dMaxX - dMinX, dMaxY - dMinY, dMaxZ - dMinZ) || 1;
  const grid = buildVoxelGrid(txWorld, 0);

  // A generous gate that drops gross outliers (non-overlapping regions); the
  // trim ratio then handles the fine rejection of the changed prep surface.
  // Tightens after the first few iterations as the alignment settles.
  const gateFar = opts.maxDist && opts.maxDist > 0 ? opts.maxDist : diag * 0.25;
  const gateNear = diag * 0.08;

  // Reusable correspondence buffers (one slot per sampled pre vertex).
  const m = preIdx.length;
  const corr = new Float32Array(m * 6); // src xyz, dst xyz
  const corrD2 = new Float32Array(m);
  const order = new Uint32Array(m);

  let rmse = Infinity;
  let fullRmse = Infinity;
  let iters = 0;
  let inliers = 0;
  let relaxed = false; // one-shot gate relaxation if a poor init collapses matches
  for (let iter = 0; iter < iterations; iter++) {
    preMesh.updateMatrixWorld(true);
    const preMat = preMesh.matrixWorld;
    let gate =
      iter < 4 || relaxed ? gateFar : Math.max(gateNear, gateFar * 0.4);
    let gate2 = gate * gate;

    const v = new THREE.Vector3();
    let n = 0;
    let fullSumSq = 0;
    for (let i = 0; i < m; i++) {
      v.fromBufferAttribute(prePos, preIdx[i]).applyMatrix4(preMat);
      const hit = grid.nearest(v.x, v.y, v.z);
      if (!hit || hit.d2 > gate2) continue;
      corr[n * 6] = v.x;
      corr[n * 6 + 1] = v.y;
      corr[n * 6 + 2] = v.z;
      corr[n * 6 + 3] = hit.x;
      corr[n * 6 + 4] = hit.y;
      corr[n * 6 + 5] = hit.z;
      corrD2[n] = hit.d2;
      order[n] = n;
      fullSumSq += hit.d2;
      n++;
    }

    // If the gate collapsed correspondences (poor initial pose), drop the gate
    // entirely once and retry this iteration before giving up.
    if (n < 10) {
      if (!relaxed && gate2 < Infinity) {
        relaxed = true;
        gate = Infinity;
        gate2 = Infinity;
        iter--;
        continue;
      }
      break;
    }

    // Full (untrimmed) RMSE over all gated matches — the honest, comparable metric.
    const newFullRmse = Math.sqrt(fullSumSq / n);

    // Trim: keep the best `trimRatio` fraction of correspondences by distance.
    const sub = order.subarray(0, n);
    sub.sort((a, b) => corrD2[a] - corrD2[b]);
    const keep = Math.max(10, Math.floor(n * trimRatio));

    const pSrc = new Float32Array(keep * 3);
    const qDst = new Float32Array(keep * 3);
    let sumSq = 0;
    for (let i = 0; i < keep; i++) {
      const j = sub[i];
      pSrc[i * 3] = corr[j * 6];
      pSrc[i * 3 + 1] = corr[j * 6 + 1];
      pSrc[i * 3 + 2] = corr[j * 6 + 2];
      qDst[i * 3] = corr[j * 6 + 3];
      qDst[i * 3 + 1] = corr[j * 6 + 4];
      qDst[i * 3 + 2] = corr[j * 6 + 5];
      sumSq += corrD2[j];
    }
    const newRmse = Math.sqrt(sumSq / keep);
    inliers = keep;

    // Solve rigid transform (Horn) mapping pSrc -> qDst on the inliers.
    const { q, t } = hornAlign(pSrc, qDst, keep);
    const delta = new THREE.Matrix4().compose(t, q, new THREE.Vector3(1, 1, 1));
    preMesh.applyMatrix4(delta);

    iters = iter + 1;
    if (Math.abs(rmse - newRmse) < 1e-5 && iter > 5) {
      rmse = newRmse;
      fullRmse = newFullRmse;
      break;
    }
    rmse = newRmse;
    fullRmse = newFullRmse;
  }
  preMesh.updateMatrixWorld(true);
  return { iterations: iters, rmse, fullRmse, samples: preIdx.length, inliers };
}

type VoxelGrid = {
  nearest: (
    x: number,
    y: number,
    z: number,
  ) => { x: number; y: number; z: number; d2: number } | null;
};

function buildVoxelGrid(points: Float32Array, hintCell: number): VoxelGrid {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i],
      y = points[i + 1],
      z = points[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const cell = hintCell > 0 ? hintCell : Math.max(diag / 60, 0.5);
  const pad = cell * 2;
  minX -= pad;
  minY -= pad;
  minZ -= pad;
  maxX += pad;
  maxY += pad;
  maxZ += pad;
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell));
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell));
  const buckets: number[][] = new Array(nx * ny * nz);
  for (let i = 0; i < points.length; i += 3) {
    const ix = Math.min(
      nx - 1,
      Math.max(0, Math.floor((points[i] - minX) / cell)),
    );
    const iy = Math.min(
      ny - 1,
      Math.max(0, Math.floor((points[i + 1] - minY) / cell)),
    );
    const iz = Math.min(
      nz - 1,
      Math.max(0, Math.floor((points[i + 2] - minZ) / cell)),
    );
    (buckets[ix + nx * (iy + ny * iz)] ||= []).push(i);
  }
  return {
    nearest(x, y, z) {
      const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cell)));
      const iy = Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / cell)));
      const iz = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cell)));
      let best = Infinity;
      let bx = 0,
        by = 0,
        bz = 0;
      // Expanding-ring (hollow shell) search. The true nearest point can sit
      // one ring beyond the first non-empty cell (a closer point across a cell
      // border), so once we find a hit we scan one extra ring before stopping.
      let firstHitRing = -1;
      const maxRing = Math.max(nx, ny, nz);
      for (let ring = 1; ring <= maxRing; ring++) {
        for (let dz = -ring; dz <= ring; dz++) {
          const cz = iz + dz;
          if (cz < 0 || cz >= nz) continue;
          for (let dy = -ring; dy <= ring; dy++) {
            const cy = iy + dy;
            if (cy < 0 || cy >= ny) continue;
            for (let dx = -ring; dx <= ring; dx++) {
              if (
                ring > 1 &&
                Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < ring
              )
                continue;
              const cx = ix + dx;
              if (cx < 0 || cx >= nx) continue;
              const bucket = buckets[cx + nx * (cy + ny * cz)];
              if (!bucket) continue;
              for (let k = 0; k < bucket.length; k++) {
                const j = bucket[k];
                const ex = x - points[j];
                const ey = y - points[j + 1];
                const ez = z - points[j + 2];
                const d2 = ex * ex + ey * ey + ez * ez;
                if (d2 < best) {
                  best = d2;
                  bx = points[j];
                  by = points[j + 1];
                  bz = points[j + 2];
                }
              }
            }
          }
        }
        if (best !== Infinity) {
          if (firstHitRing < 0) firstHitRing = ring;
          if (ring >= firstHitRing + 1) break;
        }
      }
      return best === Infinity ? null : { x: bx, y: by, z: bz, d2: best };
    },
  };
}

/** Horn's closed-form rigid alignment of point set P -> Q (no scale).
 *  Returns the rotation q and translation t so that q*P + t ≈ Q. */
function hornAlign(
  P: Float32Array,
  Q: Float32Array,
  n: number,
): {
  q: THREE.Quaternion;
  t: THREE.Vector3;
} {
  let pcx = 0,
    pcy = 0,
    pcz = 0,
    qcx = 0,
    qcy = 0,
    qcz = 0;
  for (let i = 0; i < n; i++) {
    pcx += P[i * 3];
    pcy += P[i * 3 + 1];
    pcz += P[i * 3 + 2];
    qcx += Q[i * 3];
    qcy += Q[i * 3 + 1];
    qcz += Q[i * 3 + 2];
  }
  pcx /= n;
  pcy /= n;
  pcz /= n;
  qcx /= n;
  qcy /= n;
  qcz /= n;
  let Sxx = 0,
    Sxy = 0,
    Sxz = 0,
    Syx = 0,
    Syy = 0,
    Syz = 0,
    Szx = 0,
    Szy = 0,
    Szz = 0;
  for (let i = 0; i < n; i++) {
    const px = P[i * 3] - pcx,
      py = P[i * 3 + 1] - pcy,
      pz = P[i * 3 + 2] - pcz;
    const qx = Q[i * 3] - qcx,
      qy = Q[i * 3 + 1] - qcy,
      qz = Q[i * 3 + 2] - qcz;
    Sxx += px * qx;
    Sxy += px * qy;
    Sxz += px * qz;
    Syx += py * qx;
    Syy += py * qy;
    Syz += py * qz;
    Szx += pz * qx;
    Szy += pz * qy;
    Szz += pz * qz;
  }
  const N: number[][] = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const { eigenvalues, eigenvectors } = jacobi4(N);
  let maxIdx = 0;
  for (let i = 1; i < 4; i++)
    if (eigenvalues[i] > eigenvalues[maxIdx]) maxIdx = i;
  const qw = eigenvectors[0][maxIdx];
  const qx = eigenvectors[1][maxIdx];
  const qy = eigenvectors[2][maxIdx];
  const qz = eigenvectors[3][maxIdx];
  const quat = new THREE.Quaternion(qx, qy, qz, qw).normalize();
  const pc = new THREE.Vector3(pcx, pcy, pcz).applyQuaternion(quat);
  return {
    q: quat,
    t: new THREE.Vector3(qcx - pc.x, qcy - pc.y, qcz - pc.z),
  };
}

/** Symmetric 3x3 Jacobi eigendecomposition. Eigenvector k is column k of
 *  `eigenvectors` (eigenvectors[row][col]). */
function jacobi3(M: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const n = 3;
  const V: number[][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
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

/** Symmetric 4x4 Jacobi eigendecomposition. */
function jacobi4(M: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const n = 4;
  const V: number[][] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
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
  return { eigenvalues: [A[0][0], A[1][1], A[2][2], A[3][3]], eigenvectors: V };
}

const STOPS: [number, number, number][] = [
  [0.1, 0.1, 0.43], // deep blue
  [0.12, 0.23, 0.62],
  [0.12, 0.53, 0.84],
  [0.12, 0.75, 0.56],
  [0.25, 0.79, 0.3],
  [0.84, 0.81, 0.12],
  [0.91, 0.5, 0.12],
  [0.84, 0.16, 0.12],
  [0.48, 0.04, 0.1],
];

function heatmapColor(t: number) {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[Math.min(STOPS.length - 1, i + 1)];
  return {
    r: a[0] + (b[0] - a[0]) * f,
    g: a[1] + (b[1] - a[1]) * f,
    b: a[2] + (b[2] - a[2]) * f,
  };
}
