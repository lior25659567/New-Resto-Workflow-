import { useState, useCallback } from 'react';
import * as THREE from 'three';

type UploadSlot = 'pre' | 'post';

interface SlotState {
  file: File | null;
  geometry: THREE.BufferGeometry | null;
  loading: boolean;
  error: string | null;
}

interface UsePlyUploadReturn {
  pre: SlotState;
  post: SlotState;
  handleDrop: (files: FileList, slot: UploadSlot) => void;
  handleFile: (file: File, slot: UploadSlot) => void;
  isReady: boolean;
  reset: () => void;
}

// Inline PLY parser for uploaded files (mirrors jawPLYLoader logic)
function parsePlyBuffer(buffer: ArrayBuffer): THREE.BufferGeometry {
  const text = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength)));
  const headerEnd = text.indexOf('end_header\n');
  if (headerEnd === -1) throw new Error('Invalid PLY: no end_header');
  const headerLength = headerEnd + 'end_header\n'.length;

  const lines = text.substring(0, headerEnd).split('\n');
  let vertexCount = 0, faceCount = 0, currentElement = '';

  interface ScalarProp { name: string; scalarType: string }
  interface FaceProp { type: 'scalar' | 'list'; name: string; scalarType?: string; countType?: string; valueType?: string }

  const vertexProps: ScalarProp[] = [];
  const faceProps: FaceProp[] = [];

  for (const line of lines) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'element') {
      currentElement = p[1];
      if (p[1] === 'vertex') vertexCount = parseInt(p[2]);
      if (p[1] === 'face') faceCount = parseInt(p[2]);
    } else if (p[0] === 'property') {
      if (currentElement === 'vertex' && p[1] !== 'list') {
        vertexProps.push({ name: p[2], scalarType: p[1] });
      } else if (currentElement === 'face') {
        if (p[1] === 'list') {
          faceProps.push({ type: 'list', name: p[4], countType: p[2], valueType: p[3] });
        } else {
          faceProps.push({ type: 'scalar', name: p[2], scalarType: p[1] });
        }
      }
    }
  }

  function typeSize(t: string): number {
    switch (t) {
      case 'char': case 'uchar': case 'int8': case 'uint8': return 1;
      case 'short': case 'ushort': case 'int16': case 'uint16': return 2;
      case 'int': case 'uint': case 'float': case 'int32': case 'uint32': case 'float32': return 4;
      case 'double': case 'float64': return 8;
      default: return 4;
    }
  }

  function readScalar(view: DataView, offset: number, type: string): number {
    switch (type) {
      case 'float': case 'float32': return view.getFloat32(offset, true);
      case 'double': case 'float64': return view.getFloat64(offset, true);
      case 'uchar': case 'uint8': return view.getUint8(offset);
      case 'char': case 'int8': return view.getInt8(offset);
      case 'short': case 'int16': return view.getInt16(offset, true);
      case 'ushort': case 'uint16': return view.getUint16(offset, true);
      case 'int': case 'int32': return view.getInt32(offset, true);
      case 'uint': case 'uint32': return view.getUint32(offset, true);
      default: return view.getFloat32(offset, true);
    }
  }

  const view = new DataView(buffer);
  let off = headerLength;
  const hasColors = vertexProps.some(p => p.name === 'red');

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = hasColors ? new Float32Array(vertexCount * 3) : null;

  for (let i = 0; i < vertexCount; i++) {
    for (const prop of vertexProps) {
      const size = typeSize(prop.scalarType);
      const val = readScalar(view, off, prop.scalarType);
      if (prop.name === 'x') positions[i * 3] = val;
      else if (prop.name === 'y') positions[i * 3 + 1] = val;
      else if (prop.name === 'z') positions[i * 3 + 2] = val;
      else if (prop.name === 'nx') normals[i * 3] = val;
      else if (prop.name === 'ny') normals[i * 3 + 1] = val;
      else if (prop.name === 'nz') normals[i * 3 + 2] = val;
      else if (colors) {
        if (prop.name === 'red') colors[i * 3] = val / 255;
        else if (prop.name === 'green') colors[i * 3 + 1] = val / 255;
        else if (prop.name === 'blue') colors[i * 3 + 2] = val / 255;
      }
      off += size;
    }
  }

  const idxList: number[] = [];
  for (let f = 0; f < faceCount; f++) {
    const faceVerts: number[] = [];
    for (const prop of faceProps) {
      if (prop.type === 'scalar') {
        off += typeSize(prop.scalarType!);
      } else {
        const cSize = typeSize(prop.countType!);
        let count: number;
        if (cSize === 1) count = view.getUint8(off);
        else if (cSize === 2) count = view.getUint16(off, true);
        else count = view.getUint32(off, true);
        off += cSize;
        const vSize = typeSize(prop.valueType!);
        if (prop.name === 'vertex_indices' || prop.name === 'vertex_index') {
          for (let j = 0; j < count; j++) {
            faceVerts.push(view.getUint32(off, true));
            off += vSize;
          }
        } else {
          off += count * vSize;
        }
      }
    }
    if (faceVerts.length >= 3) {
      idxList.push(faceVerts[0], faceVerts[1], faceVerts[2]);
      if (faceVerts.length === 4) {
        idxList.push(faceVerts[0], faceVerts[2], faceVerts[3]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normals.some(v => v !== 0)) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  if (colors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  if (idxList.length > 0) {
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(idxList), 1));
  }

  geometry.computeBoundingBox();
  return geometry;
}

const emptySlot: SlotState = { file: null, geometry: null, loading: false, error: null };

export function usePlyUpload(): UsePlyUploadReturn {
  const [pre, setPre] = useState<SlotState>(emptySlot);
  const [post, setPost] = useState<SlotState>(emptySlot);

  const setSlot = useCallback((slot: UploadSlot, update: Partial<SlotState>) => {
    const setter = slot === 'pre' ? setPre : setPost;
    setter(prev => ({ ...prev, ...update }));
  }, []);

  const handleFile = useCallback((file: File, slot: UploadSlot) => {
    if (!file.name.toLowerCase().endsWith('.ply')) {
      setSlot(slot, { error: 'Only .ply files are supported', loading: false });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setSlot(slot, { error: 'File exceeds 100MB limit', loading: false });
      return;
    }

    setSlot(slot, { file, loading: true, error: null, geometry: null });

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geometry = parsePlyBuffer(reader.result as ArrayBuffer);
        geometry.center();
        geometry.computeBoundingBox();
        setSlot(slot, { geometry, loading: false });
      } catch (e) {
        setSlot(slot, { error: (e as Error).message, loading: false });
      }
    };
    reader.onerror = () => {
      setSlot(slot, { error: 'Failed to read file', loading: false });
    };
    reader.readAsArrayBuffer(file);
  }, [setSlot]);

  const handleDrop = useCallback((files: FileList, slot: UploadSlot) => {
    if (files.length > 0) handleFile(files[0], slot);
  }, [handleFile]);

  const reset = useCallback(() => {
    setPre(emptySlot);
    setPost(emptySlot);
  }, []);

  const isReady = !!(pre.geometry && post.geometry && !pre.loading && !post.loading);

  return { pre, post, handleDrop, handleFile, isReady, reset };
}
