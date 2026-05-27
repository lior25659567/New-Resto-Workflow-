import '@react-three/fiber';
import { memo, useMemo, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { PLYLoader } from 'three-stdlib';
import * as THREE from 'three';

import upperJawUrl   from '@/assets/3d-models/new 3d models /Upper.ply?url';
import lowerJawUrl   from '@/assets/3d-models/new 3d models /Lower.ply?url';
import bothArchesUrl from '@/assets/3d-models/new 3d models /Both Arches.ply?url';

const STONE_COLOR = new THREE.Color(0xd4d0c8);

function ThumbnailMesh({ url, rotationY = 0, opacity = 1 }: { url: string; rotationY: number; opacity: number }) {
  const rawGeo = useLoader(PLYLoader, url);

  const geometry = useMemo(() => {
    const geo = rawGeo.clone();
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, [rawGeo]);

  return (
    <group rotation={[0.1, rotationY, 0]}>
      <mesh geometry={geometry} scale={0.055}>
        <meshPhysicalMaterial
          color={STONE_COLOR}
          roughness={0.5}
          metalness={0.0}
          side={THREE.DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
          clearcoat={0.15}
        />
      </mesh>
    </group>
  );
}

interface JawThumbnailProps {
  jaw: 'upper' | 'lower' | 'bite';
  rotationY?: number;
  opacity?: number;
  size?: number;
  className?: string;
}

function JawThumbnailInner({ jaw, rotationY = 0, opacity = 1, size = 64, className }: JawThumbnailProps) {
  const url = jaw === 'upper' ? upperJawUrl : jaw === 'lower' ? lowerJawUrl : bothArchesUrl;

  return (
    <div className={className} style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 40 }}
        frameloop="demand"
        dpr={1}
        gl={{ antialias: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 6, 4]} intensity={0.8} />
        <Suspense fallback={null}>
          <Center>
            <ThumbnailMesh url={url} rotationY={rotationY} opacity={opacity} />
          </Center>
        </Suspense>
      </Canvas>
    </div>
  );
}

const JawThumbnail = memo(JawThumbnailInner);
export default JawThumbnail;
