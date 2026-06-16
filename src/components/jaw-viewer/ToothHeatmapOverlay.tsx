import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJawGeo } from './jawPLYLoader';
import {
  LOWER_TEETH,
  UPPER_TEETH,
  isEnamelVertex,
  isToothSurfaceVertex,
  refineToothCentroidsFromGeometry,
  type JawKind,
  type ToothCentroid,
} from './toothPositions';

// OcclusogramPanel legend: 0.00 (red) → 1.20 (blue)
const OCCLUSOGRAM_SCALE: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.00, rgb: [0.627, 0.039, 0.039] },
  { t: 0.20, rgb: [0.969, 0.467, 0.102] },
  { t: 0.40, rgb: [1.000, 0.898, 0.000] },
  { t: 0.60, rgb: [0.329, 0.749, 0.000] },
  { t: 0.80, rgb: [0.059, 0.957, 0.988] },
  { t: 1.00, rgb: [0.004, 0.592, 0.925] },
  { t: 1.20, rgb: [0.000, 0.400, 1.000] },
];

const PREP_REDUCTION_COLORS = [
  { threshold: 0.0, color: [0.600, 0.000, 0.000] },
  { threshold: 0.2, color: [0.850, 0.100, 0.100] },
  { threshold: 0.4, color: [1.000, 0.300, 0.100] },
  { threshold: 0.6, color: [1.000, 0.550, 0.100] },
  { threshold: 0.8, color: [1.000, 0.800, 0.000] },
  { threshold: 1.0, color: [0.900, 1.000, 0.000] },
  { threshold: 1.2, color: [0.700, 0.900, 0.000] },
  { threshold: 1.4, color: [0.300, 0.850, 0.200] },
  { threshold: 1.6, color: [0.100, 0.800, 0.400] },
  { threshold: 1.8, color: [0.100, 0.700, 0.600] },
  { threshold: 2.0, color: [0.100, 0.500, 0.900] },
  { threshold: 2.2, color: [0.200, 0.300, 0.800] },
  { threshold: 2.5, color: [0.100, 0.100, 0.700] },
] as const;


type HeatmapMode = 'occlusgram' | 'prep-reduction';

interface ToothHeatmapOverlayProps {
  url: string;
  textureUrl?: string;
  jawType: JawKind;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  active?: boolean;
  mode: HeatmapMode;
  toothData: Record<number, number>;
  useBothTeeth?: boolean;
}

function lerpOcclusogramColor(val: number): [number, number, number] {
  val = Math.max(0, Math.min(1.2, val));
  for (let i = 0; i < OCCLUSOGRAM_SCALE.length - 1; i++) {
    const c0 = OCCLUSOGRAM_SCALE[i];
    const c1 = OCCLUSOGRAM_SCALE[i + 1];
    if (val <= c1.t) {
      const t = (val - c0.t) / (c1.t - c0.t);
      return [
        c0.rgb[0] + (c1.rgb[0] - c0.rgb[0]) * t,
        c0.rgb[1] + (c1.rgb[1] - c0.rgb[1]) * t,
        c0.rgb[2] + (c1.rgb[2] - c0.rgb[2]) * t,
      ];
    }
  }
  return OCCLUSOGRAM_SCALE[OCCLUSOGRAM_SCALE.length - 1].rgb;
}

function getPrepReductionColor(val: number): [number, number, number] {
  if (val <= PREP_REDUCTION_COLORS[0].threshold) return [...PREP_REDUCTION_COLORS[0].color] as [number, number, number];
  for (let i = 0; i < PREP_REDUCTION_COLORS.length - 1; i++) {
    if (val <= PREP_REDUCTION_COLORS[i + 1].threshold) {
      const t =
        (val - PREP_REDUCTION_COLORS[i].threshold) /
        (PREP_REDUCTION_COLORS[i + 1].threshold - PREP_REDUCTION_COLORS[i].threshold);
      return [
        PREP_REDUCTION_COLORS[i].color[0] +
          (PREP_REDUCTION_COLORS[i + 1].color[0] - PREP_REDUCTION_COLORS[i].color[0]) * t,
        PREP_REDUCTION_COLORS[i].color[1] +
          (PREP_REDUCTION_COLORS[i + 1].color[1] - PREP_REDUCTION_COLORS[i].color[1]) * t,
        PREP_REDUCTION_COLORS[i].color[2] +
          (PREP_REDUCTION_COLORS[i + 1].color[2] - PREP_REDUCTION_COLORS[i].color[2]) * t,
      ];
    }
  }
  const last = PREP_REDUCTION_COLORS[PREP_REDUCTION_COLORS.length - 1];
  return [...last.color] as [number, number, number];
}

function toCenteredCenters(
  teeth: ToothCentroid[],
  center?: THREE.Vector3,
): { ada: number; x: number; y: number; z: number }[] {
  return teeth.map((t) => ({
    ada: t.ada,
    x: center ? t.x - center.x : t.x,
    y: center ? t.y - center.y : t.y,
    z: center ? t.z - center.z : t.z,
  }));
}

const VERTEX_SHADER = `
  attribute vec3 heatColor;
  attribute float heatAlpha;
  varying vec3 vHeatColor;
  varying float vHeatAlpha;
  void main() {
    vHeatColor = heatColor;
    vHeatAlpha = heatAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vHeatColor;
  varying float vHeatAlpha;
  uniform float uOpacity;
  void main() {
    if (vHeatAlpha < 0.01) discard;
    gl_FragColor = vec4(vHeatColor, uOpacity);
  }
`;

export default function ToothHeatmapOverlay({
  url,
  textureUrl = '',
  jawType,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.035,
  active = false,
  mode,
  toothData,
  useBothTeeth = false,
}: ToothHeatmapOverlayProps) {
  const rawGeometry = useJawGeo(url, textureUrl);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number | null>(null);

  const heatmapGeo = useMemo(() => {
    if (!rawGeometry) return new THREE.BufferGeometry();
    const geo = rawGeometry.clone();
    const pos = geo.attributes.position;
    const normals = geo.attributes.normal;
    const vertexColors = geo.attributes.color;
    const count = pos.count;

    const center = geo.userData.originalCenter as THREE.Vector3 | undefined;
    const surfaceJaw: JawKind = useBothTeeth ? 'bite' : jawType;
    const seedTeeth = useBothTeeth
      ? [...UPPER_TEETH, ...LOWER_TEETH]
      : jawType === 'lower'
        ? LOWER_TEETH
        : UPPER_TEETH;

    const refined = refineToothCentroidsFromGeometry(
      pos,
      vertexColors,
      normals,
      seedTeeth,
      surfaceJaw,
      center,
    );
    const toothCenters = toCenteredCenters(refined, center);

    const heatColorArr = new Float32Array(count * 3);
    const heatAlphaArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      if (!isEnamelVertex(vertexColors, i)) {
        heatAlphaArr[i] = 0;
        continue;
      }

      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const normalZ = normals ? normals.getZ(i) : 0;

      let minDistXY = Infinity;
      let secondMinDistXY = Infinity;
      let closestAda: number | null = null;
      let closestCenter: (typeof toothCenters)[0] | null = null;

      for (const tc of toothCenters) {
        const distXY = Math.hypot(x - tc.x, y - tc.y);
        if (distXY < minDistXY) {
          secondMinDistXY = minDistXY;
          minDistXY = distXY;
          closestAda = tc.ada;
          closestCenter = tc;
        } else if (distXY < secondMinDistXY) {
          secondMinDistXY = distXY;
        }
      }

      if (!closestAda || !closestCenter) {
        heatAlphaArr[i] = 0;
        continue;
      }

      if (!isToothSurfaceVertex(x, y, z, normalZ, closestCenter, surfaceJaw)) {
        heatAlphaArr[i] = 0;
        continue;
      }

      if (toothData[closestAda] === undefined) {
        heatAlphaArr[i] = 0;
        continue;
      }

      const dx = x - closestCenter.x;
      const dy = y - closestCenter.y;
      const distXY = Math.hypot(dx, dy);

      const radialT = Math.min(1, distXY / 7.0);
      const angle = Math.atan2(dy, dx);
      const detail =
        Math.sin(angle * 3 + closestAda * 0.4) * 0.1 +
        Math.cos(distXY * 0.35 + closestAda) * 0.08 +
        Math.sin(z * 0.3 + closestAda * 0.15) * 0.06;

      let value: number;
      if (mode === 'occlusgram') {
        value = radialT * 1.2 + detail;
        value = Math.max(0, Math.min(1.2, value));
      } else {
        const base = toothData[closestAda] ?? 1.2;
        value = base * 0.35 + radialT * 1.2 + detail * 0.2;
        value = Math.max(0, Math.min(2.5, value));
      }

      const rgb =
        mode === 'occlusgram' ? lerpOcclusogramColor(value) : getPrepReductionColor(value);

      heatColorArr[i * 3] = rgb[0];
      heatColorArr[i * 3 + 1] = rgb[1];
      heatColorArr[i * 3 + 2] = rgb[2];
      heatAlphaArr[i] = 1.0;
    }

    geo.setAttribute('heatColor', new THREE.BufferAttribute(heatColorArr, 3));
    geo.setAttribute('heatAlpha', new THREE.BufferAttribute(heatAlphaArr, 1));
    const coloredCount = heatAlphaArr.filter(a => a > 0).length;
    console.log('[ToothHeatmapOverlay]', mode, jawType, 'colored:', coloredCount, '/', count, 'active:', active);
    return geo;
  }, [rawGeometry, jawType, mode, toothData, useBothTeeth]);

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
    const progress = Math.min(elapsed / 600, 1);
    matRef.current.uniforms.uOpacity.value = progress;
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
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={{ uOpacity: { value: 0 } }}
        transparent
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
