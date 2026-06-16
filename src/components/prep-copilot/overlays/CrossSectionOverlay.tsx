import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useModelContext } from '../CopilotScene';

const SECTION_COLOR = '#3b82f6';
const PLANE_OPACITY = 0.15;

interface CrossSectionOverlayProps {
  visible: boolean;
  planeNormal?: [number, number, number];
  planeOffset?: number;
  scale?: number;
  rotation?: [number, number, number];
}

export default function CrossSectionOverlay({
  visible,
  planeNormal = [1, 0, 0],
  planeOffset = 0,
  scale: scaleProp,
  rotation: rotationProp,
}: CrossSectionOverlayProps) {
  const ctx = useModelContext();
  const groupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = visible ? 1 : 0;
    opacityRef.current += (target - opacityRef.current) * Math.min(1, delta * 8);
    groupRef.current.visible = opacityRef.current > 0.01;
  });

  const planeGeo = useMemo(() => {
    if (!ctx) return null;
    const { bounds } = ctx;
    const sizeX = (bounds.maxX - bounds.minX) * 1.2;
    const sizeY = (bounds.maxY - bounds.minY) * 1.2;
    const size = Math.max(sizeX, sizeY);
    return new THREE.PlaneGeometry(size, size);
  }, [ctx]);

  const planeQuaternion = useMemo(() => {
    const normal = new THREE.Vector3(...planeNormal).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return q;
  }, [planeNormal]);

  const planePosition = useMemo(() => {
    if (!ctx) return new THREE.Vector3();
    const normal = new THREE.Vector3(...planeNormal).normalize();
    return new THREE.Vector3(
      ctx.bounds.centerX + normal.x * planeOffset,
      ctx.bounds.centerY + normal.y * planeOffset,
      ctx.bounds.centerZ + normal.z * planeOffset,
    );
  }, [ctx, planeNormal, planeOffset]);

  if (!ctx || !planeGeo) return null;

  const S = scaleProp ?? 0.055;

  return (
    <group ref={groupRef} scale={S} rotation={rotationProp}>
      <mesh
        geometry={planeGeo}
        position={planePosition}
        quaternion={planeQuaternion}
      >
        <meshBasicMaterial
          color={SECTION_COLOR}
          transparent
          opacity={PLANE_OPACITY}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Section plane edge ring */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={4}
            array={new Float32Array([
              planePosition.x - 0.5 * (planeGeo.parameters.width ?? 1), planePosition.y - 0.5 * (planeGeo.parameters.height ?? 1), planePosition.z,
              planePosition.x + 0.5 * (planeGeo.parameters.width ?? 1), planePosition.y - 0.5 * (planeGeo.parameters.height ?? 1), planePosition.z,
              planePosition.x + 0.5 * (planeGeo.parameters.width ?? 1), planePosition.y + 0.5 * (planeGeo.parameters.height ?? 1), planePosition.z,
              planePosition.x - 0.5 * (planeGeo.parameters.width ?? 1), planePosition.y + 0.5 * (planeGeo.parameters.height ?? 1), planePosition.z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={SECTION_COLOR} linewidth={2} transparent opacity={0.6} />
      </lineLoop>
    </group>
  );
}
