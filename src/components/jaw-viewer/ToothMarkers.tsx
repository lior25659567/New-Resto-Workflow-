/**
 * Renders 3D tooth position markers for the lower jaw.
 * Positions are derived from geometric peak analysis of new 3d models/Lower.ply.
 * At render time they are transformed through the same center / scale / rotation as the jaw mesh.
 */
import '@react-three/fiber';
import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useJawGeo } from './jawPLYLoader';
import {
  LOWER_TEETH,
  UPPER_TEETH,
  refineToothCentroidsFromGeometry,
} from './toothPositions';

const TOOTH_COLOR = '#009ACE';  // iTero brand blue

// Occlusgram heatmap colors (blue to red)
const OCCLUSGRAM_COLORS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.00, rgb: [0.000, 0.400, 1.000] }, // Blue   #0066ff
  { t: 0.20, rgb: [0.000, 0.800, 1.000] }, // Cyan   #00ccff
  { t: 0.40, rgb: [0.000, 1.000, 0.530] }, // Green  #00ff88
  { t: 0.60, rgb: [1.000, 1.000, 0.000] }, // Yellow #ffff00
  { t: 0.80, rgb: [1.000, 0.400, 0.000] }, // Orange #ff6600
  { t: 1.00, rgb: [0.627, 0.039, 0.039] }, // Red    #a00a0a
];

// Prep reduction heatmap colors (red to blue)
const PREP_REDUCTION_COLORS = [
  { threshold: 0.3, color: [0.85, 0.1, 0.1] },  // Red (insufficient)
  { threshold: 0.5, color: [1.0, 0.3, 0.1] },   // Orange
  { threshold: 0.7, color: [1.0, 0.55, 0.1] },  // Yellow-Orange
  { threshold: 0.9, color: [1.0, 0.8, 0.0] },   // Yellow
  { threshold: 1.1, color: [0.7, 0.9, 0.0] },   // Yellow-Green
  { threshold: 1.3, color: [0.2, 0.85, 0.2] },  // Green (ideal)
  { threshold: 1.6, color: [0.1, 0.7, 0.6] },   // Cyan
  { threshold: 2.0, color: [0.1, 0.5, 0.9] },   // Blue (excess)
  { threshold: 2.5, color: [0.2, 0.2, 0.8] },   // Dark Blue
] as const;

type HeatmapMode = 'none' | 'occlusgram' | 'prep-reduction';

interface ToothMarkersProps {
  /** PLY URL — must match the jaw mesh so the same cached geometry is used. */
  plyUrl: string;
  textureUrl?: string;
  scale?: number;
  rotation?: [number, number, number];
  visible?: boolean;
  /** Which arch to label: 'lower' = ADA #17–32 (from Lower.ply), 'upper' = ADA #1–15 (from Upper.ply). */
  jawType?: 'lower' | 'upper';
  /** Heatmap mode - changes tooth marker colors */
  heatmapMode?: HeatmapMode;
  /** Per-tooth heatmap values (ADA number -> value) */
  toothHeatmapData?: Record<number, number>;
}

function lerpOcclusogramColor(val: number): [number, number, number] {
  val = Math.max(0, Math.min(1, val));
  for (let i = 0; i < OCCLUSGRAM_COLORS.length - 1; i++) {
    const c0 = OCCLUSGRAM_COLORS[i], c1 = OCCLUSGRAM_COLORS[i + 1];
    if (val <= c1.t) {
      const t = (val - c0.t) / (c1.t - c0.t);
      return [
        c0.rgb[0] + (c1.rgb[0] - c0.rgb[0]) * t,
        c0.rgb[1] + (c1.rgb[1] - c0.rgb[1]) * t,
        c0.rgb[2] + (c1.rgb[2] - c0.rgb[2]) * t,
      ];
    }
  }
  return OCCLUSGRAM_COLORS[OCCLUSGRAM_COLORS.length - 1].rgb;
}

function getPrePReductionColor(val: number): [number, number, number] {
  if (val <= PREP_REDUCTION_COLORS[0].threshold) return [...PREP_REDUCTION_COLORS[0].color] as [number, number, number];
  for (let i = 0; i < PREP_REDUCTION_COLORS.length - 1; i++) {
    if (val <= PREP_REDUCTION_COLORS[i + 1].threshold) {
      const t = (val - PREP_REDUCTION_COLORS[i].threshold) / (PREP_REDUCTION_COLORS[i + 1].threshold - PREP_REDUCTION_COLORS[i].threshold);
      return [
        PREP_REDUCTION_COLORS[i].color[0] + (PREP_REDUCTION_COLORS[i + 1].color[0] - PREP_REDUCTION_COLORS[i].color[0]) * t,
        PREP_REDUCTION_COLORS[i].color[1] + (PREP_REDUCTION_COLORS[i + 1].color[1] - PREP_REDUCTION_COLORS[i].color[1]) * t,
        PREP_REDUCTION_COLORS[i].color[2] + (PREP_REDUCTION_COLORS[i + 1].color[2] - PREP_REDUCTION_COLORS[i].color[2]) * t,
      ];
    }
  }
  const last = PREP_REDUCTION_COLORS[PREP_REDUCTION_COLORS.length - 1];
  return [...last.color] as [number, number, number];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
}

export default function ToothMarkers({
  plyUrl,
  textureUrl = '',
  scale = 0.035,
  rotation = [Math.PI * 0.6, 0, Math.PI],
  visible = true,
  jawType = 'lower',
  heatmapMode = 'none',
  toothHeatmapData = {},
}: ToothMarkersProps) {
  const geo = useJawGeo(plyUrl, textureUrl);
  const seedTeeth = jawType === 'upper' ? UPPER_TEETH : LOWER_TEETH;

  const markers = useMemo(() => {
    const center = geo.userData.originalCenter as THREE.Vector3 | undefined;
    if (!center) return [];

    const teeth = refineToothCentroidsFromGeometry(
      geo.attributes.position as THREE.BufferAttribute,
      geo.attributes.color,
      geo.attributes.normal,
      seedTeeth,
      jawType,
      center,
    );

    const euler = new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ');
    const q = new THREE.Quaternion().setFromEuler(euler);

    return teeth.map(tooth => {
      const pos = new THREE.Vector3(tooth.x, tooth.y, tooth.z)
        .sub(center)            // mirror geo.center()
        .multiplyScalar(scale)  // same scale as the mesh
        .applyQuaternion(q);    // same rotation as the mesh
      return { ...tooth, pos };
    });
  }, [geo, scale, rotation, seedTeeth, jawType]);

  if (!visible || markers.length === 0) return null;

  return (
    <>
      {markers.map(({ ada, label, pos }) => {
        // Get heatmap color for this tooth
        let markerColor = TOOTH_COLOR;
        let bgColor = TOOTH_COLOR;
        
        if (heatmapMode !== 'none' && toothHeatmapData[ada] !== undefined) {
          const value = toothHeatmapData[ada];
          let rgb: [number, number, number];
          
          if (heatmapMode === 'occlusgram') {
            rgb = lerpOcclusogramColor(value);
          } else if (heatmapMode === 'prep-reduction') {
            rgb = getPrePReductionColor(value);
          } else {
            rgb = [0, 0.6, 0.8]; // Default iTero blue
          }
          
          markerColor = rgbToHex(rgb[0], rgb[1], rgb[2]);
          bgColor = markerColor;
        }

        return (
          <group key={ada} position={[pos.x, pos.y, pos.z]}>
            {/* 3D dot sitting on the occlusal surface */}
            <mesh renderOrder={3}>
              <sphereGeometry args={[0.022, 16, 16]} />
              <meshStandardMaterial
                color={markerColor}
                emissive={markerColor}
                emissiveIntensity={heatmapMode !== 'none' ? 0.6 : 0.4}
                depthTest={false}
                transparent
                opacity={0.92}
                toneMapped={false}
              />
            </mesh>

            {/* 2D HTML label always facing camera */}
            <Html
              distanceFactor={8}
              position={[0, 0.055, 0]}
              center
              style={{ pointerEvents: 'none' }}
              zIndexRange={[100, 0]}
            >
              <div
                style={{
                  background: bgColor,
                  color: '#fff',
                  padding: '2px 7px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'sans-serif',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  boxShadow: heatmapMode !== 'none' 
                    ? '0 2px 8px rgba(0,0,0,0.4)' 
                    : '0 1px 4px rgba(0,0,0,0.35)',
                  lineHeight: 1.4,
                  border: heatmapMode !== 'none' ? '1px solid rgba(255,255,255,0.3)' : 'none',
                }}
              >
                {label}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
