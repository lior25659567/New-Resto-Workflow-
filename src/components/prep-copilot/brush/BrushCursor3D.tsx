import * as THREE from 'three';
import { color } from '@/design-system/tokens';

interface BrushCursor3DProps {
  position: THREE.Vector3 | null;
  normal: THREE.Vector3 | null;
  radius: number;
  eraseMode: boolean;
  meshRef?: React.RefObject<THREE.Mesh | null>;
}

export function BrushCursor3D({ position, normal, radius, eraseMode, meshRef }: BrushCursor3DProps) {
  if (!position) return null;

  // Transform from local model coords to world coords
  let worldPos = position.clone();
  let worldRadius = radius;
  if (meshRef?.current) {
    worldPos = meshRef.current.localToWorld(position.clone());
    const scale = meshRef.current.getWorldScale(new THREE.Vector3());
    worldRadius = radius * scale.x;
  }

  const quaternion = new THREE.Quaternion();
  if (normal) {
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }

  return (
    <mesh position={worldPos} quaternion={quaternion}>
      <torusGeometry args={[worldRadius, worldRadius * 0.08, 8, 32]} />
      <meshBasicMaterial
        color={eraseMode ? '#D43F58' : color.primary}
        transparent
        opacity={0.7}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
