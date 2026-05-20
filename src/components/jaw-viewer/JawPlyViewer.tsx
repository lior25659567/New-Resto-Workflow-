import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { Environment, Center } from '@react-three/drei';
import { PLYLoader } from 'three-stdlib';
import * as THREE from 'three';
import JawControls from './JawControls';

import upperJawUrl from '@/assets/3d-models/Upper Jaw .ply?url';
import lowerJawUrl from '@/assets/3d-models/Lower Jaw.ply?url';
import biteUrl from '@/assets/3d-models/Bite.ply?url';
import hdrUrl from '@/assets/lebombo_1k.hdr?url';

const STONE_COLOR = new THREE.Color(0xe8e4dc);
const STONE_SHEEN = new THREE.Color(0xf2f0ec);
const TOTAL_STEPS = 60;
const MESH_SCALE = 0.055;

function usePreparedGeometry(rawGeo: THREE.BufferGeometry, monochrome: boolean) {
  return useMemo(() => {
    const geo = rawGeo.clone();
    geo.center();
    geo.computeVertexNormals();

    const colors = geo.attributes.color;
    if (colors && !monochrome) {
      for (let i = 0; i < colors.count; i++) {
        let r = colors.getX(i), g = colors.getY(i), b = colors.getZ(i);
        r = Math.min(1, r * 1.4 + 0.15);
        g = Math.min(1, g * 1.4 + 0.15);
        b = Math.min(1, b * 1.4 + 0.15);
        colors.setXYZ(i, r, g, b);
      }
      colors.needsUpdate = true;
    }

    return geo;
  }, [rawGeo, monochrome]);
}

function getClipConstantForStep(step: number, minZ: number, maxZ: number): number {
  if (step <= 0) return minZ;
  if (step >= TOTAL_STEPS) return maxZ + 50;
  const range = maxZ - minZ;
  if (range <= 0) return maxZ + 50;
  // Map clipped steps (1..TOTAL_STEPS-1) into a narrower visible band so the
  // first undo click already makes a small, visible cut.
  const clippedSteps = TOTAL_STEPS - 1;
  const normalized = Math.max(0, Math.min(1, (step - 1) / Math.max(1, clippedSteps - 1)));
  const minVisibleProgress = 0.02;
  // Keep first undo visibly clipped while preserving small per-step cuts.
  const maxClippedProgress = 0.94;
  const progress = minVisibleProgress + (maxClippedProgress - minVisibleProgress) * normalized;
  return minZ + range * progress;
}

/** Full model — no clipping (used for scan view and final undo step). */
function PlyMesh({ url, monochrome }: { url: string; monochrome: boolean }) {
  const rawGeo = useLoader(PLYLoader, url);
  const geometry = usePreparedGeometry(rawGeo, monochrome);

  if (monochrome) {
    return (
      <mesh geometry={geometry} scale={MESH_SCALE} rotation={[0.1, -0.4, 0]}>
        <meshPhysicalMaterial
          color={STONE_COLOR}
          roughness={0.75}
          metalness={0.0}
          side={THREE.DoubleSide}
          clearcoat={0.05}
          clearcoatRoughness={0.8}
          reflectivity={0.15}
          envMapIntensity={0.3}
          ior={1.3}
          sheen={0.15}
          sheenRoughness={0.8}
          sheenColor={STONE_SHEEN}
        />
      </mesh>
    );
  }

  return (
    <mesh geometry={geometry} scale={MESH_SCALE} rotation={[0.1, -0.4, 0]}>
      <meshPhysicalMaterial
        vertexColors
        roughness={0.4}
        metalness={0.0}
        side={THREE.DoubleSide}
        clearcoat={0.15}
        clearcoatRoughness={0.4}
        reflectivity={0.3}
        envMapIntensity={0.5}
        ior={1.3}
      />
    </mesh>
  );
}

/** Partial reveal along Z for undo steps 1–9. */
function ClippedPlyMesh({
  url,
  monochrome,
  revealStep,
}: {
  url: string;
  monochrome: boolean;
  revealStep: number;
}) {
  const rawGeo = useLoader(PLYLoader, url);
  const geometry = usePreparedGeometry(rawGeo, monochrome);

  const { minZ, maxZ } = useMemo(() => {
    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.attributes.position as THREE.BufferAttribute
    );
    return { minZ: box.min.z, maxZ: box.max.z };
  }, [geometry]);

  const targetConstant = getClipConstantForStep(revealStep, minZ, maxZ);
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), targetConstant));
  const animatedConstant = useRef(targetConstant);

  useFrame((_, delta) => {
    const diff = targetConstant - animatedConstant.current;
    if (Math.abs(diff) > 0.01) {
      animatedConstant.current += diff * Math.min(4.0 * delta * 3, 1);
      clipPlaneRef.current.constant = animatedConstant.current;
    }
  });

  useEffect(() => {
    animatedConstant.current = targetConstant;
    clipPlaneRef.current.constant = targetConstant;
  }, [targetConstant]);

  const clippingPlanes = useMemo(() => [clipPlaneRef.current], []);

  const materialProps = monochrome
    ? {
        vertexColors: false as const,
        color: STONE_COLOR,
        roughness: 0.75,
        sheen: 0.15,
        sheenColor: STONE_SHEEN,
      }
    : {
        vertexColors: true as const,
        roughness: 0.4,
      };

  return (
    <mesh geometry={geometry} scale={MESH_SCALE} rotation={[0.1, -0.4, 0]}>
      <meshPhysicalMaterial
        {...materialProps}
        metalness={0.0}
        side={THREE.DoubleSide}
        envMapIntensity={monochrome ? 0.3 : 0.5}
        ior={1.3}
        clippingPlanes={clippingPlanes}
        clipShadows
      />
    </mesh>
  );
}

interface JawPlyViewerProps {
  jaw: 'upper' | 'lower' | 'bite';
  monochrome?: boolean;
  revealStep?: number;
}

function SceneContent({
  modelUrl,
  monochrome,
  revealStep,
}: {
  modelUrl: string;
  monochrome: boolean;
  revealStep: number;
}) {
  const useClipping = revealStep < TOTAL_STEPS;

  return (
    <Center>
      {useClipping ? (
        <ClippedPlyMesh url={modelUrl} monochrome={monochrome} revealStep={revealStep} />
      ) : (
        <PlyMesh url={modelUrl} monochrome={monochrome} />
      )}
    </Center>
  );
}

export default function JawPlyViewer({ jaw, monochrome = false, revealStep = TOTAL_STEPS }: JawPlyViewerProps) {
  const modelUrl = jaw === 'upper' ? upperJawUrl : jaw === 'lower' ? lowerJawUrl : biteUrl;
  const useClipping = revealStep < TOTAL_STEPS;
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

  return (
    <div className="w-full h-full min-h-[300px]">
      <Canvas
        camera={{ position: [0, 0, 14], fov: 35 }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.7,
          ...(useClipping ? { localClippingEnabled: true } : {}),
        }}
        dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 8, 5]} intensity={0.9} color="#ffffff" />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#f0f5ff" />
        <directionalLight position={[0, -3, 5]} intensity={0.3} />
        <pointLight position={[0, 10, 0]} intensity={0.2} color="#ffffff" />
        <Environment files={hdrUrl} background={false} />

        <group ref={setModelGroup}>
          <Suspense fallback={null}>
            <SceneContent modelUrl={modelUrl} monochrome={monochrome} revealStep={revealStep} />
          </Suspense>
        </group>

        <JawControls gizmoTarget={modelGroup} />
      </Canvas>
    </div>
  );
}
