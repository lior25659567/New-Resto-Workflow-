import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { HEATMAP_COLORS } from '../constants';

interface MeasuredReductionHeatmapProps {
  postGeometry: THREE.BufferGeometry;
  preGeometry: THREE.BufferGeometry;
  alignmentMatrix: THREE.Matrix4;
  brushMask: Uint8Array;
  visible: boolean;
  scale?: number;
  rotation?: [number, number, number] | readonly [number, number, number];
  onStats?: (stats: ReductionStats) => void;
}

export interface ReductionStats {
  min: number;
  max: number;
  mean: number;
  measuredCount: number;
}

function getHeatmapColor(val: number): [number, number, number] {
  if (val <= HEATMAP_COLORS[0].threshold)
    return [...HEATMAP_COLORS[0].color] as [number, number, number];
  for (let i = 0; i < HEATMAP_COLORS.length - 1; i++) {
    if (val <= HEATMAP_COLORS[i + 1].threshold) {
      const t =
        (val - HEATMAP_COLORS[i].threshold) /
        (HEATMAP_COLORS[i + 1].threshold - HEATMAP_COLORS[i].threshold);
      return [
        HEATMAP_COLORS[i].color[0] +
          (HEATMAP_COLORS[i + 1].color[0] - HEATMAP_COLORS[i].color[0]) * t,
        HEATMAP_COLORS[i].color[1] +
          (HEATMAP_COLORS[i + 1].color[1] - HEATMAP_COLORS[i].color[1]) * t,
        HEATMAP_COLORS[i].color[2] +
          (HEATMAP_COLORS[i + 1].color[2] - HEATMAP_COLORS[i].color[2]) * t,
      ];
    }
  }
  const last = HEATMAP_COLORS[HEATMAP_COLORS.length - 1];
  return [...last.color] as [number, number, number];
}

export default function MeasuredReductionHeatmap({
  postGeometry,
  preGeometry,
  alignmentMatrix,
  brushMask,
  visible,
  scale = 0.035,
  rotation = [Math.PI * 0.6, 0, Math.PI],
  onStats,
}: MeasuredReductionHeatmapProps) {
  const startTimeRef = useRef<number | null>(null);
  const [computed, setComputed] = useState(false);

  const { heatmapGeo, targetColors, baseColors } = useMemo(() => {
    if (!postGeometry || !preGeometry || !brushMask) {
      return { heatmapGeo: null, targetColors: new Float32Array(0), baseColors: new Float32Array(0) };
    }

    const geo = postGeometry.clone();
    const positions = geo.getAttribute('position');
    const n = positions.count;

    const base = new Float32Array(n * 3);
    const targets = new Float32Array(n * 3);

    // Get original vertex colors for non-brushed vertices
    const origColors = geo.getAttribute('color');
    for (let i = 0; i < n; i++) {
      if (origColors) {
        base[i * 3] = origColors.getX(i);
        base[i * 3 + 1] = origColors.getY(i);
        base[i * 3 + 2] = origColors.getZ(i);
      } else {
        base[i * 3] = 0.85;
        base[i * 3 + 1] = 0.82;
        base[i * 3 + 2] = 0.78;
      }
      // Default targets same as base (will be overwritten for brushed verts)
      targets[i * 3] = base[i * 3];
      targets[i * 3 + 1] = base[i * 3 + 1];
      targets[i * 3 + 2] = base[i * 3 + 2];
    }

    // Transform pre-treatment geometry by alignment matrix
    const alignedPre = preGeometry.clone();
    alignedPre.applyMatrix4(alignmentMatrix);

    // Ensure index for BVH
    if (!alignedPre.index) {
      const count = alignedPre.getAttribute('position').count;
      const indices = new Uint32Array(count);
      for (let i = 0; i < count; i++) indices[i] = i;
      alignedPre.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    // Build BVH on aligned pre-treatment
    const bvh = new MeshBVH(alignedPre);
    const tempTarget = { point: new THREE.Vector3(), distance: 0 };
    const queryPoint = new THREE.Vector3();

    let minDist = Infinity;
    let maxDist = 0;
    let sumDist = 0;
    let measuredCount = 0;

    // Compute minimum distance for each brushed vertex
    for (let i = 0; i < n; i++) {
      if (brushMask[i] !== 1) continue;

      queryPoint.set(positions.getX(i), positions.getY(i), positions.getZ(i));
      bvh.closestPointToPoint(queryPoint, tempTarget);
      const dist = queryPoint.distanceTo(tempTarget.point);

      minDist = Math.min(minDist, dist);
      maxDist = Math.max(maxDist, dist);
      sumDist += dist;
      measuredCount++;

      const [r, g, b] = getHeatmapColor(dist);
      targets[i * 3] = r;
      targets[i * 3 + 1] = g;
      targets[i * 3 + 2] = b;
    }

    // Report stats
    if (onStats && measuredCount > 0) {
      onStats({ min: minDist, max: maxDist, mean: sumDist / measuredCount, measuredCount });
    }

    // Set initial colors to base
    const colors = new Float32Array(base);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return { heatmapGeo: geo, targetColors: targets, baseColors: base };
  }, [postGeometry, preGeometry, alignmentMatrix, brushMask, onStats]);

  useEffect(() => {
    if (heatmapGeo) setComputed(true);
  }, [heatmapGeo]);

  // Animated reveal
  useFrame(({ clock }) => {
    if (!visible || !heatmapGeo) {
      startTimeRef.current = null;
      return;
    }

    if (!startTimeRef.current) startTimeRef.current = clock.getElapsedTime();
    const elapsed = (clock.getElapsedTime() - startTimeRef.current) * 1000;
    const progress = Math.min(1, elapsed / 900);
    const eased = 1 - Math.pow(1 - progress, 3);

    const colorAttr = heatmapGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < colorAttr.count * 3; i++) {
      colorAttr.array[i] = baseColors[i] + (targetColors[i] - baseColors[i]) * eased;
    }
    colorAttr.needsUpdate = true;
  });

  if (!visible || !heatmapGeo || !computed) return null;

  return (
    <mesh
      geometry={heatmapGeo}
      scale={scale}
      rotation={rotation}
      renderOrder={3}
    >
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
