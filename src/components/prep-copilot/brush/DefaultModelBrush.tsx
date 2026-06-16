import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BrushCursor3D } from './BrushCursor3D';

const PREP_COLOR: [number, number, number] = [0.96, 0.28, 0.30];
const BASE_COLOR: [number, number, number] = [0.91, 0.89, 0.84];

interface DefaultModelBrushProps {
  meshRef: React.RefObject<THREE.Mesh | null>;
  enabled: boolean;
  brushSize: 'S' | 'M' | 'L';
  eraseMode: boolean;
  onMaskUpdate: (mask: Uint8Array, count: number) => void;
  onStrokeEnd?: () => void;
}

export function DefaultModelBrush({ meshRef, enabled, brushSize, eraseMode, onMaskUpdate, onStrokeEnd }: DefaultModelBrushProps) {
  const { raycaster, pointer, camera, gl } = useThree();
  const maskRef = useRef<Uint8Array | null>(null);
  const paintingRef = useRef(false);
  const [hitPoint, setHitPoint] = useState<THREE.Vector3 | null>(null);
  const [hitNormal, setHitNormal] = useState<THREE.Vector3 | null>(null);
  const colorsDirtyRef = useRef(false);

  const getBrushRadius = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.geometry) return 3;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const meshRadius = mesh.geometry.boundingSphere!.radius;
    const pct = brushSize === 'S' ? 0.04 : brushSize === 'M' ? 0.07 : 0.12;
    return meshRadius * pct;
  }, [meshRef, brushSize]);

  const ensureMask = useCallback(() => {
    const geo = meshRef.current?.geometry;
    if (!geo) return null;
    const count = geo.attributes.position.count;
    if (!maskRef.current || maskRef.current.length !== count) {
      maskRef.current = new Uint8Array(count);
    }
    return maskRef.current;
  }, [meshRef]);

  const updateVertexColors = useCallback(() => {
    const mesh = meshRef.current;
    const mask = maskRef.current;
    if (!mesh || !mask) return;
    const geo = mesh.geometry;
    const count = geo.attributes.position.count;

    let colorAttr = geo.attributes.color as THREE.BufferAttribute | undefined;
    if (!colorAttr || colorAttr.count !== count) {
      colorAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
      geo.setAttribute('color', colorAttr);
    }

    const arr = colorAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const painted = mask[i] === 1;
      arr[i * 3] = painted ? PREP_COLOR[0] : BASE_COLOR[0];
      arr[i * 3 + 1] = painted ? PREP_COLOR[1] : BASE_COLOR[1];
      arr[i * 3 + 2] = painted ? PREP_COLOR[2] : BASE_COLOR[2];
    }
    colorAttr.needsUpdate = true;

    // Switch material to vertexColors mode
    const mat = mesh.material as THREE.MeshPhysicalMaterial;
    if (mat && !mat.vertexColors) {
      mat.vertexColors = true;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }
  }, [meshRef]);

  const paintAtPoint = useCallback((localPoint: THREE.Vector3) => {
    const geo = meshRef.current?.geometry;
    const mask = ensureMask();
    if (!geo || !mask) return;

    const positions = geo.attributes.position;
    const radius = getBrushRadius();
    const rSq = radius * radius;
    const value = eraseMode ? 0 : 1;
    let changed = false;

    for (let i = 0; i < positions.count; i++) {
      const dx = positions.getX(i) - localPoint.x;
      const dy = positions.getY(i) - localPoint.y;
      const dz = positions.getZ(i) - localPoint.z;
      if (dx * dx + dy * dy + dz * dz <= rSq) {
        if (mask[i] !== value) {
          mask[i] = value;
          changed = true;
        }
      }
    }

    if (changed) {
      colorsDirtyRef.current = true;
      const count = mask.reduce((sum, v) => sum + v, 0);
      onMaskUpdate(mask, count);
    }
  }, [meshRef, ensureMask, getBrushRadius, eraseMode, onMaskUpdate]);

  // Pointer down/up on the canvas element directly
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;

    const handleDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      paintingRef.current = true;
    };
    const handleUp = () => {
      if (paintingRef.current) {
        paintingRef.current = false;
        onStrokeEnd?.();
      }
    };

    canvas.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointerup', handleUp);
    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [enabled, gl]);

  useFrame(() => {
    if (!enabled || !meshRef.current) {
      if (hitPoint) setHitPoint(null);
      return;
    }

    // Update vertex colors when dirty
    if (colorsDirtyRef.current) {
      updateVertexColors();
      colorsDirtyRef.current = false;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const localPoint = meshRef.current.worldToLocal(hit.point.clone());
      setHitPoint(localPoint);
      setHitNormal(hit.face?.normal ?? null);

      if (paintingRef.current) {
        paintAtPoint(localPoint);
      }
    } else {
      if (hitPoint) setHitPoint(null);
    }
  });

  if (!enabled) return null;

  return (
    <BrushCursor3D
      position={hitPoint}
      normal={hitNormal}
      radius={getBrushRadius()}
      eraseMode={eraseMode}
      meshRef={meshRef}
    />
  );
}
