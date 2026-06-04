import '@react-three/fiber';
import React, { useRef, createContext, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import hdrUrl from '@/assets/lebombo_1k.hdr?url';

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

interface CopilotSceneProps {
  children?: React.ReactNode;
}

export default function CopilotScene({ children }: CopilotSceneProps) {
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

      {children}

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
