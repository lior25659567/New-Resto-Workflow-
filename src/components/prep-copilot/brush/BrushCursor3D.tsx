import { useRef } from 'react';
import * as THREE from 'three';
import { color } from '@/design-system/tokens';

interface BrushCursor3DProps {
  position: THREE.Vector3 | null;
  normal: THREE.Vector3 | null;
  radius: number;
  eraseMode: boolean;
}

export function BrushCursor3D({ position, normal, radius, eraseMode }: BrushCursor3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  if (!position) return null;

  const quaternion = new THREE.Quaternion();
  if (normal) {
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }

  return (
    <mesh ref={meshRef} position={position} quaternion={quaternion}>
      <torusGeometry args={[radius, radius * 0.05, 8, 32]} />
      <meshBasicMaterial
        color={eraseMode ? '#D43F58' : color.primary}
        transparent
        opacity={0.6}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
