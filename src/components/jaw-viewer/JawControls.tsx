import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface JawControlsProps {
  gizmoTarget?: THREE.Object3D | null;
}

/**
 * Orbit controls for the PLY jaw viewer.
 * - Left drag: rotate
 * - Right drag: pan
 * - Scroll / pinch: zoom
 * - Smooth inertia via enableDamping
 */
export default function JawControls({ gizmoTarget: _ }: JawControlsProps = {}) {
  const orbitRef = useRef<any>(null);

  useFrame(() => {
    orbitRef.current?.update();
  });

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={1.5}
      zoomSpeed={1.2}
      panSpeed={1.2}
      enablePan={true}
      enableRotate={true}
      enableZoom={true}
      minDistance={0.5}
      maxDistance={10}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
      target={[0, 0, 0]}
    />
  );
}
