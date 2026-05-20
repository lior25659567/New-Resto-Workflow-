import '@react-three/fiber';
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

  return (
    <mesh
      geometry={geometry}
      scale={scale}
      position={position}
      rotation={rotation}
      visible={visible}
      renderOrder={isTransparent ? 1 : 0}
    >
      <meshPhysicalMaterial
        vertexColors={!monochrome}
        color={monochrome ? STONE_COLOR : new THREE.Color(1, 1, 1)}
        roughness={monochrome ? 0.75 : 0.55}
        metalness={0.0}
        side={THREE.DoubleSide}
        clearcoat={monochrome ? 0.05 : 0.15}
        clearcoatRoughness={monochrome ? 0.8 : 0.5}
        reflectivity={monochrome ? 0.15 : 0.25}
        envMapIntensity={monochrome ? 0.3 : 0.5}
        ior={monochrome ? 1.3 : 1.4}
        sheen={monochrome ? 0.15 : 0.05}
        sheenRoughness={monochrome ? 0.8 : 0.9}
        sheenColor={STONE_SHEEN}
        transparent={isTransparent || !visible}
        opacity={visible ? opacity : 0}
        depthWrite={!isTransparent && visible}
      />
    </mesh>
  );
}
