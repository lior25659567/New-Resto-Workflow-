import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useJawGeo } from './jawPLYLoader';

// OcclusogramPanel legend: blue (no contact) → cyan → green → yellow → orange → red (high)
const CONTACT_COLORS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.00, rgb: [0.000, 0.400, 1.000] }, // Blue   #0066ff
  { t: 0.20, rgb: [0.000, 0.800, 1.000] }, // Cyan   #00ccff
  { t: 0.40, rgb: [0.000, 1.000, 0.530] }, // Green  #00ff88
  { t: 0.60, rgb: [1.000, 1.000, 0.000] }, // Yellow #ffff00
  { t: 0.80, rgb: [1.000, 0.400, 0.000] }, // Orange #ff6600
  { t: 1.00, rgb: [0.627, 0.039, 0.039] }, // Red    #a00a0a
];

function lerpContactColor(val: number): [number, number, number] {
  val = Math.max(0, Math.min(1, val));
  for (let i = 0; i < CONTACT_COLORS.length - 1; i++) {
    const c0 = CONTACT_COLORS[i], c1 = CONTACT_COLORS[i + 1];
    if (val <= c1.t) {
      const t = (val - c0.t) / (c1.t - c0.t);
      return [
        c0.rgb[0] + (c1.rgb[0] - c0.rgb[0]) * t,
        c0.rgb[1] + (c1.rgb[1] - c0.rgb[1]) * t,
        c0.rgb[2] + (c1.rgb[2] - c0.rgb[2]) * t,
      ];
    }
  }
  return CONTACT_COLORS[CONTACT_COLORS.length - 1].rgb;
}

// Per-vertex alpha via custom shader — gum/palate vertices are fully discarded
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
    // Debug: render as bright red to make it obvious
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8 * uOpacity);
  }
`;

// iTero PLY coordinate system: Z is vertical (not Y).
// Upper jaw: teeth face downward → normalZ ≈ -1 for occlusal surfaces.
// Lower jaw: teeth face upward  → normalZ ≈ +1 for occlusal surfaces.
// Palate / gingiva: mostly radial normals in XY plane → low |normalZ|.

// Gum exclusion: useJawGeo bakes contrast-enhanced texture colors.
// Enhanced teeth pinkness (R-B) ≈ 0.24, enhanced gum pinkness ≈ 0.35+.
// Threshold of 0.30 keeps enamel and discards pink gingival tissue.
const GUM_PINKNESS_THRESHOLD = 0.30;

interface OcclusogramHeatmapOverlayProps {
  url: string;
  textureUrl?: string;
  jawType: 'upper' | 'lower' | 'bite';
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  active?: boolean;
}

export default function OcclusogramHeatmapOverlay({
  url,
  textureUrl = '',
  jawType,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.055,
  active = false,
}: OcclusogramHeatmapOverlayProps) {
  // Debug logging
  console.log('OcclusogramHeatmapOverlay render:', { jawType, active });
  
  // Reuse the same cached geometry as JawMesh — it's already centered with baked
  // texture colors (needed for gum exclusion) and original PLY normals.
  const rawGeometry = useJawGeo(url, textureUrl);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number | null>(null);

  const heatmapGeo = useMemo(() => {
    const geo = rawGeometry.clone();

    const pos = geo.attributes.position;
    const normals = geo.attributes.normal;
    const vertexColors = geo.attributes.color;

    const count = pos.count;
    const heatColorArr = new Float32Array(count * 3);
    const heatAlphaArr = new Float32Array(count);

    // Compute arch center in XY plane (after centering, origin ≈ arch center)
    let sumX = 0, sumY = 0;
    let maxRadialXY = 0;
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      sumX += x; sumY += y;
      const r = Math.sqrt(x * x + y * y);
      if (r > maxRadialXY) maxRadialXY = r;
    }
    const centerX = sumX / count;
    const centerY = sumY / count;

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const normalZ = normals ? normals.getZ(i) : 0;

      // ── Primary filter: occlusal surface via Z-axis normal ─────────────────
      // iTero PLY: Z is vertical. Teeth occlusal surfaces face ±Z.
      // Palate/gingiva have normals mostly in XY plane (|normalZ| is low).
      let occlusalPass = false;
      let occlusalFactor = 0;

      if (jawType === 'upper') {
        // Upper occlusal surfaces face downward in Z (normalZ is negative)
        if (normalZ < -0.22) {
          occlusalFactor = (-normalZ - 0.22) / (1.0 - 0.22);
          occlusalPass = true;
        }
      } else if (jawType === 'lower') {
        // Lower occlusal surfaces face upward in Z (normalZ is positive)
        if (normalZ > 0.22) {
          occlusalFactor = (normalZ - 0.22) / (1.0 - 0.22);
          occlusalPass = true;
        }
      } else {
        // Bite model: accept both directions
        const absNZ = Math.abs(normalZ);
        if (absNZ > 0.22) {
          occlusalFactor = (absNZ - 0.22) / (1.0 - 0.22);
          occlusalPass = true;
        }
      }

      if (!occlusalPass) {
        heatAlphaArr[i] = 0;
        continue;
      }

      // ── Palate exclusion for upper jaw ─────────────────────────────────────
      // After geo.center(), palate sits near Z ≈ 0 to +10, arch rim near Z ≈ -10.
      // Palate also has small radial distance from arch center in XY.
      // We exclude the central palate area by requiring the vertex to be on the
      // arch rim (radially outward in XY) rather than the palate floor.
      if (jawType === 'upper' || jawType === 'bite') {
        const dx = x - centerX;
        const dy = y - centerY;
        const radialDist = Math.sqrt(dx * dx + dy * dy);
        const radialFrac = maxRadialXY > 0 ? radialDist / maxRadialXY : 0;

        // Palate sits in the central bowl — radialFrac is low there.
        // Teeth are around the outer arch — radialFrac is high.
        // Use a soft threshold: fade out for radialFrac < 0.35.
        if (radialFrac < 0.20) {
          heatAlphaArr[i] = 0;
          continue;
        }
        if (radialFrac < 0.38) {
          // Soft fade in the transition zone — still allow if occlusal factor is strong
          occlusalFactor *= (radialFrac - 0.20) / (0.38 - 0.20);
        }
      }

      // ── Gum exclusion via vertex color pinkness ────────────────────────────
      // Teeth: R≈0.74, G≈0.65, B≈0.54 → pinkness (R-B) ≈ 0.20
      // Gum:   R≈0.75, G≈0.57, B≈0.46 → pinkness (R-B) ≈ 0.29+
      if (vertexColors) {
        const r = vertexColors.getX(i);
        const b = vertexColors.getZ(i);
        const pinkness = r - b;
        if (pinkness > GUM_PINKNESS_THRESHOLD) {
          heatAlphaArr[i] = 0;
          continue;
        }
      }

      // ── Contact value: tooth-scale noise blobs ─────────────────────────────
      // PLY units are mm. Teeth are ~10-15mm wide. Use frequency ~0.10-0.15/mm
      // to get blobs spanning individual teeth.
      const n1 = Math.sin(x * 0.13 + y * 0.09 + 1.23) * 0.18;
      const n2 = Math.cos(z * 0.15 + x * 0.11 - 0.84) * 0.14;
      const n3 = Math.sin(y * 0.10 + z * 0.12 + 2.13) * 0.10;
      const n4 = Math.cos(x * 0.18 + y * 0.14 - 1.51) * 0.09;
      // Finer detail within each tooth
      const detail = Math.sin(x * 0.32 + y * 0.28) * 0.07 + Math.cos(z * 0.36 + x * 0.22) * 0.05;

      // Arch angle for per-tooth contact spot placement (in XY plane)
      const angle = Math.atan2(y - centerY, x - centerX);

      // 10 contact blobs spread around full dental arch
      const spotAngles = [0.00, 0.62, 1.25, 1.88, 2.51, -0.62, -1.25, -1.88, -2.51, 3.14];
      let spotVal = 0;
      for (let s = 0; s < spotAngles.length; s++) {
        const w = 0.30 + Math.sin(spotAngles[s] * 5.7 + s * 1.3) * 0.15;
        spotVal += Math.exp(-((angle - spotAngles[s]) ** 2) * 3.5) * w;
      }

      let contact = 0.28 + (n1 + n2 + n3 + n4) + detail + spotVal * 0.65 + occlusalFactor * 0.12;

      // Sigmoid push: spreads values toward blue and red extremes
      contact = Math.max(0, Math.min(1, contact));
      contact = 1 / (1 + Math.exp(-8 * (contact - 0.5)));

      const [r, g, b] = lerpContactColor(contact);
      heatColorArr[i * 3]     = r;
      heatColorArr[i * 3 + 1] = g;
      heatColorArr[i * 3 + 2] = b;
      // Alpha: make heatmap more visible
      heatAlphaArr[i] = 0.95 + occlusalFactor * 0.05;
    }

    geo.setAttribute('heatColor', new THREE.BufferAttribute(heatColorArr, 3));
    geo.setAttribute('heatAlpha', new THREE.BufferAttribute(heatAlphaArr, 1));
    return geo;
  }, [rawGeometry, jawType]);

  useFrame(() => {
    if (!matRef.current) return;
    if (!active) {
      matRef.current.uniforms.uOpacity.value = 0;
      startTimeRef.current = null;
      return;
    }
    // Debug: show immediately at full opacity
    matRef.current.uniforms.uOpacity.value = 1.0;
    console.log('Heatmap active:', active);
  });

  return (
    <mesh
      geometry={heatmapGeo}
      position={position}
      rotation={rotation}
      scale={scale}
      renderOrder={10}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={{ uOpacity: { value: 0 } }}
        transparent
        depthWrite={false}
        depthTest={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
