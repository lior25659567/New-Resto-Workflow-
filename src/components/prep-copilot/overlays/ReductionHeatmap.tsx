import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useModelContext } from '../CopilotScene';
import { HEATMAP_COLORS } from '../constants';

interface ReductionHeatmapProps {
  visible: boolean;
  isRescan?: boolean;
  scale?: number;
  rotation?: [number, number, number];
}

function getHeatmapColor(val: number): [number, number, number] {
  if (val <= HEATMAP_COLORS[0].threshold) return [...HEATMAP_COLORS[0].color] as [number, number, number];
  for (let i = 0; i < HEATMAP_COLORS.length - 1; i++) {
    if (val <= HEATMAP_COLORS[i + 1].threshold) {
      const t = (val - HEATMAP_COLORS[i].threshold) / (HEATMAP_COLORS[i + 1].threshold - HEATMAP_COLORS[i].threshold);
      return [
        HEATMAP_COLORS[i].color[0] + (HEATMAP_COLORS[i + 1].color[0] - HEATMAP_COLORS[i].color[0]) * t,
        HEATMAP_COLORS[i].color[1] + (HEATMAP_COLORS[i + 1].color[1] - HEATMAP_COLORS[i].color[1]) * t,
        HEATMAP_COLORS[i].color[2] + (HEATMAP_COLORS[i + 1].color[2] - HEATMAP_COLORS[i].color[2]) * t,
      ];
    }
  }
  const last = HEATMAP_COLORS[HEATMAP_COLORS.length - 1];
  return [...last.color] as [number, number, number];
}


export default function ReductionHeatmap({ visible, isRescan, scale: scaleProp, rotation: rotationProp }: ReductionHeatmapProps) {
  const ctx = useModelContext();
  const startTimeRef = useRef<number | null>(null);

  const { heatmapGeo, targetColors, baseColors } = useMemo(() => {
    if (!ctx) return { heatmapGeo: null, targetColors: new Float32Array(0), baseColors: new Float32Array(0) };

    const geo = ctx.geometry.clone();
    const { bounds } = ctx;
    const pos = geo.attributes.position;
    const normals = geo.attributes.normal;
    const n = pos.count;

    const base = new Float32Array(n * 3);
    const targets = new Float32Array(n * 3);

    // Use geometry center as focus, with radius covering most of the model
    const prepCenter: [number, number, number] = [bounds.centerX, bounds.centerY, bounds.centerZ];
    const modelExtent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ);
    const focusRadius = modelExtent * 0.6;

    // Preserve original vertex colors if they exist
    const origColors = geo.attributes.color;

    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Original color (brightened tooth color or white)
      const origR = origColors ? Math.min(1, origColors.getX(i) * 1.4 + 0.15) : 0.93;
      const origG = origColors ? Math.min(1, origColors.getY(i) * 1.4 + 0.15) : 0.89;
      const origB = origColors ? Math.min(1, origColors.getZ(i) * 1.4 + 0.15) : 0.82;

      base[i * 3] = origR;
      base[i * 3 + 1] = origG;
      base[i * 3 + 2] = origB;

      const distFromPrep = Math.sqrt(
        (x - prepCenter[0]) ** 2 +
        (y - prepCenter[1]) ** 2 +
        (z - prepCenter[2]) ** 2
      );

      // Smooth falloff from focus center
      let focusMask: number;
      const innerR = focusRadius * 0.65;
      const outerR = focusRadius;
      if (distFromPrep < innerR) {
        focusMask = 1.0;
      } else if (distFromPrep < outerR) {
        focusMask = 1 - (distFromPrep - innerR) / (outerR - innerR);
        focusMask = focusMask * focusMask;
      } else {
        focusMask = 0.0;
      }

      if (focusMask < 0.02) {
        targets[i * 3] = origR;
        targets[i * 3 + 1] = origG;
        targets[i * 3 + 2] = origB;
        continue;
      }

      const normalY = normals ? normals.getY(i) : 0;
      const noise =
        Math.sin(x * 0.15 + z * 0.11) * 0.12 +
        Math.cos(y * 0.2 + x * 0.07) * 0.08 +
        Math.sin(z * 0.13 + y * 0.17) * 0.06;

      const yNorm = (y - bounds.minY) / (bounds.maxY - bounds.minY || 1);

      let reduction: number;
      if (isRescan) {
        reduction = 1.15 + Math.max(0, normalY) * 0.45 + yNorm * 0.25 + noise * 0.1;
      } else {
        reduction = 0.5 + Math.max(0, normalY) * 0.85 + yNorm * 0.45 + noise * 0.28;
        const angle = Math.atan2(z - bounds.centerZ, x - bounds.centerX);
        reduction -= Math.exp(-((angle - 2.8) ** 2) * 2.5) * 0.35;
        reduction -= Math.exp(-((angle + 0.5) ** 2) * 3.5) * 0.25;
      }
      reduction = Math.max(0.15, Math.min(2.5, reduction));

      const [r, g, b] = getHeatmapColor(reduction);
      targets[i * 3] = origR + (r - origR) * focusMask;
      targets[i * 3 + 1] = origG + (g - origG) * focusMask;
      targets[i * 3 + 2] = origB + (b - origB) * focusMask;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(base.slice(), 3));
    return { heatmapGeo: geo, targetColors: targets, baseColors: base };
  }, [ctx, isRescan]);

  useFrame(() => {
    if (!heatmapGeo) return;
    const colorAttr = heatmapGeo.attributes.color as THREE.BufferAttribute;
    const arr = colorAttr.array as Float32Array;

    if (!visible) {
      // Fade back to original tooth color
      let changed = false;
      for (let i = 0; i < arr.length; i++) {
        if (Math.abs(arr[i] - baseColors[i]) > 0.001) {
          arr[i] += (baseColors[i] - arr[i]) * 0.12;
          changed = true;
        }
      }
      if (changed) colorAttr.needsUpdate = true;
      startTimeRef.current = null;
      return;
    }

    if (startTimeRef.current === null) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    const progress = Math.min(elapsed / 900, 1); // 900ms reveal

    for (let i = 0; i < arr.length; i++) {
      arr[i] = baseColors[i] + (targetColors[i] - baseColors[i]) * progress;
    }
    colorAttr.needsUpdate = true;
  });

  if (!heatmapGeo) return null;

  const meshScale = scaleProp ?? 0.055;

  return (
    <mesh geometry={heatmapGeo} scale={meshScale} rotation={rotationProp}>
      <meshBasicMaterial
        vertexColors
        depthWrite={false}
        depthTest={true}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
