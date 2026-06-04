import '@react-three/fiber';
import React, { useRef, useMemo, createContext, useContext } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { PLYLoader } from 'three-stdlib';
import * as THREE from 'three';
import hdrUrl from '@/assets/lebombo_1k.hdr?url';
import { jawModels } from '../jaw-viewer/jawModelPaths';

const MESH_SCALE = 0.055;
const MESH_ROTATION: [number, number, number] = [0.1, -0.4, 0];

export interface ModelBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  centerX: number; centerY: number; centerZ: number;
}

export const ModelContext = createContext<{
  bounds: ModelBounds;
  geometry: THREE.BufferGeometry;
} | null>(null);

export function useModelContext() {
  return useContext(ModelContext);
}

function usePreparedGeometry(rawGeo: THREE.BufferGeometry) {
  return useMemo(() => {
    const geo = rawGeo.clone();
    geo.center();
    geo.computeVertexNormals();

    const colors = geo.attributes.color;
    if (colors) {
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
  }, [rawGeo]);
}

function computeBounds(geo: THREE.BufferGeometry): ModelBounds {
  const pos = geo.attributes.position;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return {
    minX, maxX, minY, maxY, minZ, maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

interface CopilotSceneProps {
  children?: React.ReactNode;
  hideDefaultModel?: boolean;
}

export default function CopilotScene({ children, hideDefaultModel }: CopilotSceneProps) {
  const rawGeo = useLoader(PLYLoader, jawModels.lower_treatment);
  const geometry = usePreparedGeometry(rawGeo);
  const bounds = useMemo(() => computeBounds(geometry), [geometry]);
  const modelCtx = useMemo(() => ({ bounds, geometry }), [bounds, geometry]);
  const controlsRef = useRef<any>(null);
  useFrame(() => { controlsRef.current?.update(); });

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#f0f5ff" />
      <directionalLight position={[0, -3, 5]} intensity={0.3} />
      <pointLight position={[0, 10, 0]} intensity={0.2} color="#ffffff" />
      <Environment files={hdrUrl} background={false} />

      {!hideDefaultModel && (
        <mesh geometry={geometry} scale={MESH_SCALE} rotation={MESH_ROTATION}>
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
      )}
      <ModelContext.Provider value={modelCtx}>
        {children}
      </ModelContext.Provider>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={1.5}
        zoomSpeed={1.2}
        panSpeed={1.2}
        minDistance={0.5}
        maxDistance={10}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI - 0.1}
        target={[0, 0, 0]}
      />
    </>
  );
}
