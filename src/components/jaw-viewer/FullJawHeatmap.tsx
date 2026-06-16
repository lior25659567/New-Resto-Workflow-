import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJawGeo } from './jawPLYLoader';

const OCCLUSOGRAM_COLORS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.000, rgb: [0.630, 0.035, 0.035] },
  { t: 0.167, rgb: [0.970, 0.467, 0.100] },
  { t: 0.333, rgb: [1.000, 0.900, 0.000] },
  { t: 0.500, rgb: [0.200, 0.800, 0.000] },
  { t: 0.667, rgb: [0.060, 0.960, 0.990] },
  { t: 0.833, rgb: [0.005, 0.590, 0.925] },
  { t: 1.000, rgb: [0.000, 0.000, 1.000] },
];

const PREP_REDUCTION_COLORS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.00, rgb: [0.600, 0.000, 0.000] },
  { t: 0.08, rgb: [0.850, 0.100, 0.100] },
  { t: 0.16, rgb: [1.000, 0.300, 0.100] },
  { t: 0.25, rgb: [1.000, 0.550, 0.100] },
  { t: 0.33, rgb: [1.000, 0.800, 0.000] },
  { t: 0.42, rgb: [0.900, 1.000, 0.000] },
  { t: 0.50, rgb: [0.700, 0.900, 0.000] },
  { t: 0.58, rgb: [0.300, 0.850, 0.200] },
  { t: 0.67, rgb: [0.100, 0.800, 0.400] },
  { t: 0.75, rgb: [0.100, 0.700, 0.600] },
  { t: 0.83, rgb: [0.100, 0.500, 0.900] },
  { t: 0.92, rgb: [0.200, 0.300, 0.800] },
  { t: 1.00, rgb: [0.100, 0.100, 0.700] },
];

function lerpColorScale(scale: Array<{ t: number; rgb: [number, number, number] }>, t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < scale.length - 1; i++) {
    if (t <= scale[i + 1].t) {
      const frac = (t - scale[i].t) / (scale[i + 1].t - scale[i].t);
      return [
        scale[i].rgb[0] + (scale[i + 1].rgb[0] - scale[i].rgb[0]) * frac,
        scale[i].rgb[1] + (scale[i + 1].rgb[1] - scale[i].rgb[1]) * frac,
        scale[i].rgb[2] + (scale[i + 1].rgb[2] - scale[i].rgb[2]) * frac,
      ];
    }
  }
  return scale[scale.length - 1].rgb;
}

type HeatmapMode = 'occlusgram' | 'prep-reduction';

interface FullJawHeatmapProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  active: boolean;
  mode: HeatmapMode;
}

export default function FullJawHeatmap({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.035,
  active,
  mode,
}: FullJawHeatmapProps) {
  const rawGeometry = useJawGeo(url, '');
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number | null>(null);

  const heatmapGeo = useMemo(() => {
    if (!rawGeometry) return new THREE.BufferGeometry();
    const geo = rawGeometry.clone();
    const pos = geo.attributes.position;
    const normals = geo.attributes.normal;
    const vertexColors = geo.attributes.color;
    const count = pos.count;

    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    const sizeX = bbox.max.x - bbox.min.x;
    const sizeY = bbox.max.y - bbox.min.y;
    const sizeZ = bbox.max.z - bbox.min.z;

    const heatColorArr = new Float32Array(count * 3);
    const heatAlphaArr = new Float32Array(count);

    const colorScale = mode === 'occlusgram' ? OCCLUSOGRAM_COLORS : PREP_REDUCTION_COLORS;

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Skip gum vertices (pink) — only color enamel (white/light)
      if (vertexColors) {
        const r = vertexColors.getX(i);
        const g = vertexColors.getY(i);
        const b = vertexColors.getZ(i);
        const pinkness = r - b;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (pinkness > 0.4 || lum < 0.25) {
          heatAlphaArr[i] = 0;
          continue;
        }
      }

      // Use normals to only color outward-facing surfaces (skip palate floor / inner gum)
      const nz = normals ? normals.getZ(i) : 0;
      if (nz < -0.5) {
        heatAlphaArr[i] = 0;
        continue;
      }

      // Generate a varied heatmap value based on spatial position
      const nx = (x - bbox.min.x) / sizeX;
      const ny = (y - bbox.min.y) / sizeY;
      const nzNorm = (z - bbox.min.z) / sizeZ;

      // Procedural variation using position
      const noise1 = Math.sin(x * 0.4 + y * 0.3) * 0.15;
      const noise2 = Math.cos(y * 0.5 + z * 0.2) * 0.1;
      const noise3 = Math.sin(x * 0.2 - z * 0.4 + 1.5) * 0.08;

      let t: number;
      if (mode === 'occlusgram') {
        // Mix of radial and positional variation — spread across full color range
        const cx = nx - 0.5;
        const cy = ny - 0.5;
        const radial = Math.sqrt(cx * cx + cy * cy) * 0.8;
        const positional = ny * 0.35 + nx * 0.2;
        t = radial * 0.4 + positional + noise1 + noise2 - 0.1;
      } else {
        // Spread across full range with hot spots
        t = ny * 0.4 + nx * 0.25 + nzNorm * 0.15 + noise1 + noise2 + noise3 - 0.05;
      }

      t = Math.max(0, Math.min(1, t));
      const rgb = lerpColorScale(colorScale, t);

      heatColorArr[i * 3] = rgb[0];
      heatColorArr[i * 3 + 1] = rgb[1];
      heatColorArr[i * 3 + 2] = rgb[2];
      heatAlphaArr[i] = 1.0;
    }

    geo.setAttribute('heatColor', new THREE.BufferAttribute(heatColorArr, 3));
    geo.setAttribute('heatAlpha', new THREE.BufferAttribute(heatAlphaArr, 1));
    return geo;
  }, [rawGeometry, mode]);

  useFrame(() => {
    if (!matRef.current) return;
    if (!active) {
      matRef.current.uniforms.uOpacity.value = 0;
      startTimeRef.current = null;
      return;
    }
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
    }
    const elapsed = performance.now() - startTimeRef.current;
    matRef.current.uniforms.uOpacity.value = Math.min(elapsed / 500, 1);
  });

  return (
    <mesh
      geometry={heatmapGeo}
      position={position}
      rotation={rotation}
      scale={scale}
      renderOrder={10}
      visible={active}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={`
          attribute vec3 heatColor;
          attribute float heatAlpha;
          varying vec3 vHeatColor;
          varying float vHeatAlpha;
          void main() {
            vHeatColor = heatColor;
            vHeatAlpha = heatAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision mediump float;
          varying vec3 vHeatColor;
          varying float vHeatAlpha;
          uniform float uOpacity;
          void main() {
            if (vHeatAlpha < 0.01) discard;
            gl_FragColor = vec4(vHeatColor, uOpacity);
          }
        `}
        uniforms={{ uOpacity: { value: 0 } }}
        transparent
        depthWrite={false}
        depthTest={true}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
