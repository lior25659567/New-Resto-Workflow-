import { useMemo, useCallback } from 'react';
import * as THREE from 'three';

const GRID = 4; // matches the 4×4 region grid in useGuidanceEngine

/**
 * True 3D surface brush.
 *
 * Adds a per-vertex `aReveal` (0–1) attribute to the geometry. The brush
 * raycasts the ACTUAL mesh and reveals the vertices within a 3D radius of the
 * hit point, so coverage paints exactly the surface the wand touches — from any
 * camera angle (occlusal / buccal / lingual), tooth walls included. This
 * replaces the old top-down XZ-plane projection that silently missed at side
 * angles and collapsed vertical walls.
 *
 * Coverage + 4×4 region stats are maintained incrementally (O(1) reads) so the
 * guidance engine keeps working unchanged.
 */
export function useBrushReveal(geometry: THREE.BufferGeometry | null) {
  const data = useMemo(() => {
    if (!geometry || !geometry.attributes.position) return null;

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const posArray = pos.array as Float32Array;
    const count = pos.count;

    const reveal = new Float32Array(count); // 0 = ghost, 1 = fully scanned
    const attr = new THREE.BufferAttribute(reveal, 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aReveal', attr);

    // Normalized XZ footprint → region grid index per vertex
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      const x = posArray[i * 3], z = posArray[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const rx = (maxX - minX) || 1, rz = (maxZ - minZ) || 1;
    const regionIdx = new Int32Array(count);
    const totalPerRegion = new Int32Array(GRID * GRID);
    for (let i = 0; i < count; i++) {
      const nx = (posArray[i * 3] - minX) / rx;
      const nz = (posArray[i * 3 + 2] - minZ) / rz;
      const col = Math.min(GRID - 1, Math.max(0, Math.floor(nx * GRID)));
      const row = Math.min(GRID - 1, Math.max(0, Math.floor(nz * GRID)));
      const idx = row * GRID + col;
      regionIdx[i] = idx;
      totalPerRegion[idx]++;
    }

    return {
      pos, posArray, count, reveal, attr, regionIdx, totalPerRegion,
      coveredPerRegion: new Int32Array(GRID * GRID),
      globalCovered: 0,
    };
  }, [geometry]);

  /** Reveal vertices within `radius` (local units) of a local-space point. */
  const paintAtLocal = useCallback((local: THREE.Vector3, radius: number, strength = 0.6) => {
    if (!data) return;
    const { posArray, count, reveal, attr, regionIdx, coveredPerRegion } = data;
    const r = radius, r2 = r * r;
    const lx = local.x, ly = local.y, lz = local.z;
    let changed = false;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const dx = posArray[ix] - lx, dy = posArray[ix + 1] - ly, dz = posArray[ix + 2] - lz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      const add = (1 - Math.sqrt(d2) / r) * strength; // soft falloff
      if (add <= 0) continue;
      const prev = reveal[i];
      let v = prev + add;
      if (v > 1) v = 1;
      if (v > prev) {
        reveal[i] = v;
        if (prev < 0.5 && v >= 0.5) {
          coveredPerRegion[regionIdx[i]]++;
          data.globalCovered++;
        }
        changed = true;
      }
    }
    if (changed) attr.needsUpdate = true;
  }, [data]);

  const getCoverage = useCallback(() => {
    if (!data || data.count === 0) return 0;
    return data.globalCovered / data.count;
  }, [data]);

  /** Region rects from the engine are exactly aligned to the 4×4 grid. */
  const getRegionCoverage = useCallback((xMin: number, _xMax: number, zMin: number, _zMax: number) => {
    if (!data) return 0;
    const col = Math.min(GRID - 1, Math.max(0, Math.floor(xMin * GRID + 1e-6)));
    const row = Math.min(GRID - 1, Math.max(0, Math.floor(zMin * GRID + 1e-6)));
    const idx = row * GRID + col;
    const total = data.totalPerRegion[idx];
    return total === 0 ? 0 : data.coveredPerRegion[idx] / total;
  }, [data]);

  const reset = useCallback(() => {
    if (!data) return;
    data.reveal.fill(0);
    data.coveredPerRegion.fill(0);
    data.globalCovered = 0;
    data.attr.needsUpdate = true;
  }, [data]);

  return { paintAtLocal, getCoverage, getRegionCoverage, reset };
}
