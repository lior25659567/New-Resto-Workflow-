import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PrepBrushOverlayProps {
  geometry: THREE.BufferGeometry;
  mask: Uint8Array | null;
  scale?: number;
  rotation?: [number, number, number];
}

export function PrepBrushOverlay({
  geometry,
  mask,
  scale = 0.035,
  rotation = [Math.PI * 0.6, 0, Math.PI],
}: PrepBrushOverlayProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const overlayGeo = useMemo(() => {
    const clone = geometry.clone();
    const positions = clone.getAttribute('position');
    const vertexCount = positions.count;
    const colors = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      if (mask && mask[i] === 1) {
        // Cyan highlight for painted vertices
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 0.8;
      } else {
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
      }
    }

    clone.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return clone;
  }, [geometry, mask]);

  // Update colors when mask changes
  useFrame(() => {
    if (!meshRef.current || !mask) return;
    const geo = meshRef.current.geometry;
    const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (!colorAttr) return;

    let needsUpdate = false;
    for (let i = 0; i < colorAttr.count; i++) {
      const painted = mask[i] === 1;
      const r = painted ? 0 : 0;
      const g = painted ? 0.6 : 0;
      const b = painted ? 0.8 : 0;
      if (colorAttr.getX(i) !== r || colorAttr.getY(i) !== g || colorAttr.getZ(i) !== b) {
        colorAttr.setXYZ(i, r, g, b);
        needsUpdate = true;
      }
    }
    if (needsUpdate) colorAttr.needsUpdate = true;
  });

  const hasPainted = mask && mask.some(v => v === 1);
  if (!hasPainted) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={overlayGeo}
      scale={scale}
      rotation={rotation}
      renderOrder={2}
    >
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.4}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}
