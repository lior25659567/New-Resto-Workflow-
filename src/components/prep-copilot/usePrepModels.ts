import { createContext, useContext } from 'react';
import * as THREE from 'three';

export interface PrepModelsContextValue {
  preGeometry: THREE.BufferGeometry | null;
  postGeometry: THREE.BufferGeometry | null;
  alignmentMatrix: THREE.Matrix4 | null;
  alignmentError: number | null;
  isAligning: boolean;
  brushMask: Uint8Array | null;
  setBrushMask: (mask: Uint8Array | null) => void;
}

export const PrepModelsContext = createContext<PrepModelsContextValue>({
  preGeometry: null,
  postGeometry: null,
  alignmentMatrix: null,
  alignmentError: null,
  isAligning: false,
  brushMask: null,
  setBrushMask: () => {},
});

export function usePrepModels() {
  return useContext(PrepModelsContext);
}
