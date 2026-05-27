import '@react-three/fiber';
import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { Environment, Center } from '@react-three/drei';
import { PLYLoader } from 'three-stdlib';
import * as THREE from 'three';
import JawControls from './JawControls';
import ToothMarkers from './ToothMarkers';

import upperJawUrl  from '@/assets/3d-models/new 3d models /Upper.ply?url';
import lowerJawUrl  from '@/assets/3d-models/new 3d models /Lower.ply?url';
import bothArchesUrl from '@/assets/3d-models/new 3d models /Both Arches.ply?url';
import hdrUrl from '@/assets/lebombo_1k.hdr?url';

const STONE_COLOR = new THREE.Color(0xe8e4dc);
const STONE_SHEEN = new THREE.Color(0xf2f0ec);
const GUM_SHEEN   = new THREE.Color(0xffeee6);
// Lavender ghost tint applied to the "undone" portion of the scan in the undo tool.
// Matches the reference behaviour where unwound geometry fades to a translucent
// purple instead of being clipped away.
const GHOST_COLOR = new THREE.Color(0xb8b2dc);
const GHOST_SHEEN = new THREE.Color(0xd7d2ef);
const GHOST_OPACITY = 0.45;
const TOTAL_STEPS = 10;
const MESH_SCALE = 0.035;
// Width of the dithered dissolve band as a fraction of model world-X span.
const REVEAL_FEATHER_RATIO = 0.12;

const undoRevealUniforms = {
  uXCut: { value: 1000 },
  uFeather: { value: 0.05 },
  uSoftEdge: { value: 1 },
};

function patchUndoRevealShader(shader: THREE.WebGLProgramParametersWithUniforms, mode: 'solid' | 'ghost') {
  shader.uniforms.uXCut = undoRevealUniforms.uXCut;
  shader.uniforms.uFeather = undoRevealUniforms.uFeather;
  shader.uniforms.uSoftEdge = undoRevealUniforms.uSoftEdge;

  shader.vertexShader = `varying vec3 vUndoWorldPos;\n${shader.vertexShader}`;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
vUndoWorldPos = worldPosition.xyz;`,
  );

  shader.fragmentShader = `uniform float uXCut;
uniform float uFeather;
uniform float uSoftEdge;
varying vec3 vUndoWorldPos;
${shader.fragmentShader}`;

  const discardLogic =
    mode === 'solid'
      ? `
        float dist = vUndoWorldPos.x - uXCut;
        if (dist > 0.0) {
          if (uSoftEdge < 0.5) {
            discard;
          } else {
            float feather = max(uFeather, 0.0001);
            float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(127.1, 311.7))) * 43758.5453);
            if ((dist / feather) > dither) discard;
          }
        }
      `
      : `
        float dist = vUndoWorldPos.x - uXCut;
        if (dist < 0.0) {
          if (uSoftEdge < 0.5) {
            discard;
          } else {
            float feather = max(uFeather, 0.0001);
            float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(127.1, 311.7))) * 43758.5453);
            if ((-dist / feather) > dither) discard;
          }
        }
      `;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `#include <dithering_fragment>
${discardLogic}`,
  );
}

function bindUndoRevealMaterial(material: THREE.MeshPhysicalMaterial, mode: 'solid' | 'ghost') {
  material.onBeforeCompile = (shader) => patchUndoRevealShader(shader, mode);
  material.customProgramCacheKey = () => `undo-reveal-${mode}`;
  material.needsUpdate = true;
}

// monochrome is intentionally NOT a dependency — the material ignores vertex colors in
// monochrome mode, so the geometry can be stable across toggles (avoids needless re-clone).
function usePreparedGeometry(rawGeo: THREE.BufferGeometry) {
  return useMemo(() => {
    const geo = rawGeo.clone();
    geo.center();
    geo.computeVertexNormals();

    const colors = geo.attributes.color;
    if (colors) {
      for (let i = 0; i < colors.count; i++) {
        let r = colors.getX(i), g = colors.getY(i), b = colors.getZ(i);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const isToothRegion = lum > 0.55;
        const satMul = isToothRegion ? 1.2 : 1.65;
        const bri    = isToothRegion ? 1.0 : 0.97;
        r = Math.min(1, Math.max(0, ((r - lum) * satMul + lum) * bri * 1.04));
        g = Math.min(1, Math.max(0, ((g - lum) * satMul + lum) * bri));
        b = Math.min(1, Math.max(0, ((b - lum) * satMul + lum) * bri * 0.94));
        colors.setXYZ(i, r, g, b);
      }
      colors.needsUpdate = true;
    }

    return geo;
  }, [rawGeo]);
}

// Returns the world-X position of the cut plane for a given undo step.
// Solid lives where x ≤ xCut, ghost where x ≥ xCut. So as xCut decreases the
// solid region shrinks from the right and the ghost grows in from the RIGHT.
//   step ≥ TOTAL_STEPS → xCut past the right edge → everything is solid (full)
//   step ≤ 0           → xCut past the left edge  → everything is ghost (empty)
function getClipConstantForStep(step: number, minX: number, maxX: number): number {
  if (step <= 0) return minX - 50;
  if (step >= TOTAL_STEPS) return maxX + 50;
  const range = maxX - minX;
  if (range <= 0) return maxX + 50;
  // normalized: 1 at first undo (TOTAL_STEPS-1), 0 at deepest undo (1)
  const clippedSteps = TOTAL_STEPS - 1;
  const normalized = Math.max(0, Math.min(1, (step - 1) / Math.max(1, clippedSteps - 1)));
  // First undo → thin ghost sliver on the right edge (~6% in from maxX).
  // Deepest undo → thin solid sliver on the left edge (~6% from minX).
  const minVisibleProgress = 0.06;
  const maxClippedProgress = 0.94;
  const progress = minVisibleProgress + (maxClippedProgress - minVisibleProgress) * (1 - normalized);
  return maxX - range * progress;
}

/** Full model — no clipping (used for scan view and final undo step). */
function PlyMesh({ url, monochrome }: { url: string; monochrome: boolean }) {
  const rawGeo = useLoader(PLYLoader, url);
  const geometry = usePreparedGeometry(rawGeo);
  // key forces a full material remount on toggle so vertexColors shader define is recompiled
  const materialKey = monochrome ? 'mono' : 'color';

  return (
    <mesh key={materialKey} geometry={geometry} scale={MESH_SCALE} rotation={[Math.PI * 0.6, 0, Math.PI]}>
      {monochrome ? (
        <meshPhysicalMaterial
          color={STONE_COLOR}
          roughness={0.65}
          metalness={0.0}
          side={THREE.DoubleSide}
          clearcoat={0.08}
          clearcoatRoughness={0.7}
          reflectivity={0.2}
          envMapIntensity={0.4}
          ior={1.4}
          sheen={0.2}
          sheenRoughness={0.8}
          sheenColor={STONE_SHEEN}
        />
      ) : (
        <meshPhysicalMaterial
          vertexColors
          roughness={0.2}
          metalness={0.0}
          side={THREE.DoubleSide}
          clearcoat={0.5}
          clearcoatRoughness={0.12}
          reflectivity={0.45}
          envMapIntensity={1.0}
          ior={1.52}
          sheen={0.28}
          sheenRoughness={0.65}
          sheenColor={GUM_SHEEN}
        />
      )}
    </mesh>
  );
}

/** Partial reveal along world-X for undo steps 1–(TOTAL_STEPS-1).
 *  Undo-tool preview: dithered threshold dissolve + optional ghost layer.
 *  After accept: clean hard cut on the solid pass only (no ghost, no dither). */
function ClippedPlyMesh({
  url,
  monochrome,
  revealStep,
  showGhost,
}: {
  url: string;
  monochrome: boolean;
  revealStep: number;
  showGhost: boolean;
}) {
  const rawGeo = useLoader(PLYLoader, url);
  const geometry = usePreparedGeometry(rawGeo);
  const meshRef = useRef<THREE.Mesh>(null);
  const solidMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const ghostMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const animatedXCut = useRef(1000);
  const worldBounds = useRef<{ minX: number; maxX: number } | null>(null);

  useEffect(() => {
    const solidMat = solidMatRef.current;
    if (solidMat) bindUndoRevealMaterial(solidMat, 'solid');
  }, [monochrome]);

  useEffect(() => {
    const ghostMat = ghostMatRef.current;
    if (ghostMat && showGhost) bindUndoRevealMaterial(ghostMat, 'ghost');
  }, [showGhost]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!worldBounds.current) {
      mesh.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(mesh);
      worldBounds.current = { minX: box.min.x, maxX: box.max.x };
      const init = getClipConstantForStep(revealStep, box.min.x, box.max.x);
      animatedXCut.current = init;
      undoRevealUniforms.uXCut.value = init;
      undoRevealUniforms.uFeather.value = Math.max((box.max.x - box.min.x) * REVEAL_FEATHER_RATIO, 0.001);
      undoRevealUniforms.uSoftEdge.value = showGhost ? 1 : 0;
      return;
    }

    const { minX, maxX } = worldBounds.current;
    const target = getClipConstantForStep(revealStep, minX, maxX);
    const diff = target - animatedXCut.current;
    if (Math.abs(diff) > 0.001) {
      animatedXCut.current += diff * Math.min(4.0 * delta * 3, 1);
    }
    undoRevealUniforms.uXCut.value = animatedXCut.current;
    undoRevealUniforms.uFeather.value = Math.max((maxX - minX) * REVEAL_FEATHER_RATIO, 0.001);
    undoRevealUniforms.uSoftEdge.value = showGhost ? 1 : 0;
  });

  const solidMaterialProps = monochrome
    ? {
        vertexColors: false as const,
        color: STONE_COLOR,
        roughness: 0.65,
        clearcoat: 0.08,
        clearcoatRoughness: 0.7,
        sheen: 0.2,
        sheenRoughness: 0.8,
        sheenColor: STONE_SHEEN,
        reflectivity: 0.2,
        envMapIntensity: 0.4,
        ior: 1.4,
      }
    : {
        vertexColors: true as const,
        roughness: 0.2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.12,
        reflectivity: 0.45,
        envMapIntensity: 1.0,
        ior: 1.52,
        sheen: 0.28,
        sheenRoughness: 0.65,
        sheenColor: GUM_SHEEN,
      };

  return (
    <>
      <mesh ref={meshRef} geometry={geometry} scale={MESH_SCALE} rotation={[Math.PI * 0.6, 0, Math.PI]}>
        <meshPhysicalMaterial
          ref={solidMatRef}
          {...solidMaterialProps}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {showGhost && (
        <mesh
          geometry={geometry}
          scale={MESH_SCALE}
          rotation={[Math.PI * 0.6, 0, Math.PI]}
          renderOrder={1}
        >
          <meshPhysicalMaterial
            ref={ghostMatRef}
            color={GHOST_COLOR}
            vertexColors={false}
            roughness={0.55}
            metalness={0.0}
            side={THREE.DoubleSide}
            clearcoat={0.35}
            clearcoatRoughness={0.45}
            reflectivity={0.3}
            envMapIntensity={0.7}
            ior={1.45}
            sheen={0.4}
            sheenRoughness={0.6}
            sheenColor={GHOST_SHEEN}
            transparent
            opacity={GHOST_OPACITY}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

interface JawPlyViewerProps {
  jaw: 'upper' | 'lower' | 'bite';
  monochrome?: boolean;
  revealStep?: number;
  /** When true, undone geometry is shown as a lavender ghost (undo-tool preview only). */
  showGhost?: boolean;
  showMarkers?: boolean;
}

function SceneContent({
  modelUrl,
  monochrome,
  revealStep,
  showGhost,
  jaw,
  showMarkers,
}: {
  modelUrl: string;
  monochrome: boolean;
  revealStep: number;
  showGhost: boolean;
  jaw: 'upper' | 'lower' | 'bite';
  showMarkers: boolean;
}) {
  const useClipping = revealStep < TOTAL_STEPS;
  // jaw='upper' displays Lower.ply (model swap) → label ADA #17-32 (lower arch)
  // jaw='lower' displays Upper.ply (model swap) → label ADA #1-15 (upper arch)
  const canShowMarkers = (jaw === 'upper' || jaw === 'lower') && showMarkers;
  const markerPlyUrl = jaw === 'upper' ? lowerJawUrl : upperJawUrl;
  const markerJawType = jaw === 'upper' ? 'lower' : 'upper';

  return (
    <>
      <Center>
        {useClipping ? (
          <ClippedPlyMesh url={modelUrl} monochrome={monochrome} revealStep={revealStep} showGhost={showGhost} />
        ) : (
          <PlyMesh url={modelUrl} monochrome={monochrome} />
        )}
      </Center>
      {canShowMarkers && (
        <Suspense fallback={null}>
          <ToothMarkers
            plyUrl={markerPlyUrl}
            scale={MESH_SCALE}
            rotation={[Math.PI * 0.6, 0, Math.PI]}
            jawType={markerJawType}
          />
        </Suspense>
      )}
    </>
  );
}

export default function JawPlyViewer({ jaw, monochrome = false, revealStep = TOTAL_STEPS, showGhost = false, showMarkers = false }: JawPlyViewerProps) {
  const modelUrl = jaw === 'upper' ? lowerJawUrl : jaw === 'lower' ? upperJawUrl : bothArchesUrl;
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

  return (
    <div className="w-full h-full min-h-[300px]" style={{ touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, -2, 4.5], fov: 40, near: 0.01, far: 1000, up: [0, 1, 0] }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
          localClippingEnabled: true,
        }}
        dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.22} color="#f8f5f2" />
        <directionalLight position={[4, 7, 5]} intensity={1.05} color="#fff8f2" />
        <directionalLight position={[-5, 3, 2]} intensity={0.45} color="#eaf0ff" />
        <directionalLight position={[0, -4, 4]} intensity={0.22} color="#fff0e8" />
        <directionalLight position={[0, 2, -5]} intensity={0.18} color="#f0f4ff" />
        <pointLight position={[0, 8, 0]} intensity={0.15} color="#ffffff" />
        <Environment files={hdrUrl} background={false} />

        <group ref={setModelGroup}>
          <Suspense fallback={null}>
            <SceneContent modelUrl={modelUrl} monochrome={monochrome} revealStep={revealStep} showGhost={showGhost} jaw={jaw} showMarkers={showMarkers} />
          </Suspense>
        </group>

        <JawControls gizmoTarget={modelGroup} />
      </Canvas>
    </div>
  );
}
