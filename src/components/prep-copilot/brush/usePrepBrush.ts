import { useCallback, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STORAGE_KEY = 'prep-copilot-brush-v1';

type BrushSize = 'S' | 'M' | 'L';

const BRUSH_RADII: Record<BrushSize, number> = {
  S: 0.03,
  M: 0.06,
  L: 0.10,
};

interface BrushState {
  mask: Uint8Array;
  paintedCount: number;
}

interface UsePrepBrushOptions {
  geometry: THREE.BufferGeometry | null;
  meshRef: React.RefObject<THREE.Mesh | null>;
  enabled: boolean;
}

interface UsePrepBrushReturn {
  brushSize: BrushSize;
  setBrushSize: (size: BrushSize) => void;
  eraseMode: boolean;
  setEraseMode: (v: boolean) => void;
  isPainting: boolean;
  mask: Uint8Array | null;
  paintedCount: number;
  clear: () => void;
  hitPoint: THREE.Vector3 | null;
  hitNormal: THREE.Vector3 | null;
  brushRadius: number;
}

function saveMask(mask: Uint8Array, vertexCount: number) {
  const painted: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) painted.push(i);
  }
  const data = { version: 1, vertexCount, painted, timestamp: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* storage full — ignore */ }
}

function loadMask(vertexCount: number): Uint8Array | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1 || data.vertexCount !== vertexCount) return null;
    const mask = new Uint8Array(vertexCount);
    for (const idx of data.painted) {
      if (idx < vertexCount) mask[idx] = 1;
    }
    return mask;
  } catch {
    return null;
  }
}

export function usePrepBrush({ geometry, meshRef, enabled }: UsePrepBrushOptions): UsePrepBrushReturn {
  const [brushSize, setBrushSize] = useState<BrushSize>('M');
  const [eraseMode, setEraseMode] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [paintedCount, setPaintedCount] = useState(0);
  const [hitPoint, setHitPoint] = useState<THREE.Vector3 | null>(null);
  const [hitNormal, setHitNormal] = useState<THREE.Vector3 | null>(null);

  const maskRef = useRef<Uint8Array | null>(null);
  const paintingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { raycaster, pointer, camera } = useThree();

  // Initialize mask from localStorage on first geometry
  if (geometry && !maskRef.current) {
    const count = geometry.getAttribute('position').count;
    const loaded = loadMask(count);
    maskRef.current = loaded ?? new Uint8Array(count);
    setPaintedCount(maskRef.current.reduce((sum, v) => sum + v, 0));
  }

  const paintAtPoint = useCallback(
    (point: THREE.Vector3) => {
      if (!geometry || !maskRef.current) return;
      const positions = geometry.getAttribute('position');
      const radius = BRUSH_RADII[brushSize];
      const rSq = radius * radius;
      let changed = false;
      const value = eraseMode ? 0 : 1;

      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - point.x;
        const dy = positions.getY(i) - point.y;
        const dz = positions.getZ(i) - point.z;
        if (dx * dx + dy * dy + dz * dz <= rSq) {
          if (maskRef.current[i] !== value) {
            maskRef.current[i] = value;
            changed = true;
          }
        }
      }

      if (changed) {
        setPaintedCount(maskRef.current.reduce((sum, v) => sum + v, 0));
      }
    },
    [geometry, brushSize, eraseMode],
  );

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (maskRef.current && geometry) {
        saveMask(maskRef.current, geometry.getAttribute('position').count);
      }
    }, 500);
  }, [geometry]);

  useFrame(() => {
    if (!enabled || !meshRef.current) {
      setHitPoint(null);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const hit = intersects[0];
      // Convert to geometry-local coordinates
      const localPoint = meshRef.current.worldToLocal(hit.point.clone());
      setHitPoint(localPoint);
      setHitNormal(hit.face?.normal ?? null);

      if (paintingRef.current) {
        paintAtPoint(localPoint);
      }
    } else {
      setHitPoint(null);
      setHitNormal(null);
    }
  });

  // Pointer event handlers — attached via R3F mesh events
  const onPointerDown = useCallback(() => {
    if (!enabled) return;
    paintingRef.current = true;
    setIsPainting(true);
    if (hitPoint) paintAtPoint(hitPoint);
  }, [enabled, hitPoint, paintAtPoint]);

  const onPointerUp = useCallback(() => {
    paintingRef.current = false;
    setIsPainting(false);
    scheduleSave();
  }, [scheduleSave]);

  // Expose handlers via meshRef events in the parent component
  if (meshRef.current && enabled) {
    (meshRef.current as any).__brushPointerDown = onPointerDown;
    (meshRef.current as any).__brushPointerUp = onPointerUp;
  }

  const clear = useCallback(() => {
    if (maskRef.current) {
      maskRef.current.fill(0);
      setPaintedCount(0);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    brushSize,
    setBrushSize,
    eraseMode,
    setEraseMode,
    isPainting,
    mask: maskRef.current,
    paintedCount,
    clear,
    hitPoint,
    hitNormal,
    brushRadius: BRUSH_RADII[brushSize],
  };
}
