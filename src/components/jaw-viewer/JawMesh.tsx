import '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useJawGeo } from './jawPLYLoader';

const STONE_COLOR = new THREE.Color(0xe8e4dc);
const STONE_SHEEN = new THREE.Color(0xf2f0ec);

interface JawMeshProps {
  url: string;
  textureUrl: string;
  opacity?: number;
  visible?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  monochrome?: boolean;
}

export default function JawMesh({
  url,
  textureUrl,
  opacity = 1,
  visible = true,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.055,
  monochrome = false,
}: JawMeshProps) {
  // useJawGeo suspends until PLY + texture baking are complete
  const geometry = useJawGeo(url, textureUrl);

  const isTransparent = opacity < 0.99;

  if (!visible) return null;

  // Use the exact same approach as the scan page
  const materialKey = monochrome ? 'monochrome' : 'colored';

  return (
    <mesh
      key={materialKey}
      geometry={geometry}
      scale={scale}
      position={position}
      rotation={rotation}
      renderOrder={isTransparent ? 1 : 0}
    >
      {monochrome ? (
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
          transparent={isTransparent}
          opacity={opacity}
          depthWrite={!isTransparent}
        />
      ) : (
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
          transparent={isTransparent}
          opacity={opacity}
          depthWrite={!isTransparent}
        />
      )}
    </mesh>
  );
}
