import * as THREE from 'three';

// ── Utilities ─────────────────────────────────────────────────────────────────

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

// ── Header ────────────────────────────────────────────────────────────────────

interface ScalarProp { type: 'scalar'; name: string; scalarType: string; }
interface ListProp   { type: 'list';   name: string; countType: string; valueType: string; }
type Prop = ScalarProp | ListProp;

interface PLYHeader {
  vertexCount: number;
  faceCount: number;
  vertexProps: ScalarProp[];
  faceProps: Prop[];
  headerLength: number;
}

function parseHeader(buffer: ArrayBuffer): PLYHeader {
  const text = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength)));
  const headerEnd = text.indexOf('end_header\n');
  if (headerEnd === -1) throw new Error('Invalid PLY: no end_header');
  const headerLength = headerEnd + 'end_header\n'.length;

  const lines = text.substring(0, headerEnd).split('\n');
  let vertexCount = 0, faceCount = 0, currentElement = '';
  const vertexProps: ScalarProp[] = [];
  const faceProps: Prop[] = [];

  for (const line of lines) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'element') {
      currentElement = p[1];
      if (p[1] === 'vertex') vertexCount = parseInt(p[2]);
      if (p[1] === 'face')   faceCount   = parseInt(p[2]);
    } else if (p[0] === 'property') {
      if (currentElement === 'vertex' && p[1] !== 'list') {
        vertexProps.push({ type: 'scalar', name: p[2], scalarType: p[1] });
      } else if (currentElement === 'face') {
        if (p[1] === 'list') {
          faceProps.push({ type: 'list', name: p[4], countType: p[2], valueType: p[3] });
        } else {
          faceProps.push({ type: 'scalar', name: p[2], scalarType: p[1] });
        }
      }
    }
  }

  return { vertexCount, faceCount, vertexProps, faceProps, headerLength };
}

// ── Binary parse — positions, normals, index buffer, and per-vertex UV sums ───

interface ParseResult {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  uvSums: Float64Array;   // [u, v, u, v, ...] per vertex — accumulated UV sum
  uvCounts: Uint32Array;  // how many faces contributed UVs for each vertex
}

function parsePLYData(buffer: ArrayBuffer, header: PLYHeader): ParseResult {
  const view = new DataView(buffer);
  let off = header.headerLength;

  const positions = new Float32Array(header.vertexCount * 3);
  const normals   = new Float32Array(header.vertexCount * 3);

  for (let i = 0; i < header.vertexCount; i++) {
    for (const prop of header.vertexProps) {
      const size = typeSize(prop.scalarType);
      const val  = readScalar(view, off, prop.scalarType);
      if      (prop.name === 'x')  positions[i * 3]     = val;
      else if (prop.name === 'y')  positions[i * 3 + 1] = val;
      else if (prop.name === 'z')  positions[i * 3 + 2] = val;
      else if (prop.name === 'nx') normals[i * 3]        = val;
      else if (prop.name === 'ny') normals[i * 3 + 1]   = val;
      else if (prop.name === 'nz') normals[i * 3 + 2]   = val;
      off += size;
    }
  }

  const uvSums   = new Float64Array(header.vertexCount * 2);
  const uvCounts = new Uint32Array(header.vertexCount);
  const idxList: number[] = [];

  for (let f = 0; f < header.faceCount; f++) {
    const faceVerts: number[] = [];
    const faceUVs: number[]   = [];

    for (const prop of header.faceProps) {
      if (prop.type === 'scalar') {
        off += typeSize(prop.scalarType);
      } else {
        const cSize = typeSize(prop.countType);
        let count: number;
        if (cSize === 1) count = view.getUint8(off);
        else if (cSize === 2) count = view.getUint16(off, true);
        else count = view.getUint32(off, true);
        off += cSize;

        const vSize = typeSize(prop.valueType);

        if (prop.name === 'vertex_indices' || prop.name === 'vertex_index') {
          for (let j = 0; j < count; j++) {
            faceVerts.push(view.getUint32(off, true));
            off += vSize;
          }
        } else if (prop.name === 'texcoord') {
          for (let j = 0; j < count; j++) {
            faceUVs.push(view.getFloat32(off, true));
            off += vSize;
          }
        } else {
          off += count * vSize;
        }
      }
    }

    if (faceVerts.length < 3) continue;

    const [v0, v1, v2] = faceVerts;
    idxList.push(v0, v1, v2);

    // "First assignment wins" — avoids UV-seam averaging artifacts.
    // Averaging UVs across texture seams samples wrong texture regions → random dots.
    if (faceUVs.length >= 6) {
      if (uvCounts[v0] === 0) { uvSums[v0*2] = faceUVs[0]; uvSums[v0*2+1] = faceUVs[1]; uvCounts[v0] = 1; }
      if (uvCounts[v1] === 0) { uvSums[v1*2] = faceUVs[2]; uvSums[v1*2+1] = faceUVs[3]; uvCounts[v1] = 1; }
      if (uvCounts[v2] === 0) { uvSums[v2*2] = faceUVs[4]; uvSums[v2*2+1] = faceUVs[5]; uvCounts[v2] = 1; }
    }

    // Triangulate quads
    if (faceVerts.length === 4) {
      const v3 = faceVerts[3];
      idxList.push(v0, v2, v3);
      if (faceUVs.length >= 8) {
        if (uvCounts[v3] === 0) { uvSums[v3*2] = faceUVs[6]; uvSums[v3*2+1] = faceUVs[7]; uvCounts[v3] = 1; }
      }
    }
  }

  return {
    positions,
    normals,
    indices: new Uint32Array(idxList),
    uvSums,
    uvCounts,
  };
}

// ── Texture sampling ──────────────────────────────────────────────────────────

async function loadImageData(url: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

function sampleTexture(data: Uint8ClampedArray, w: number, h: number, u: number, v: number): [number, number, number] {
  const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1))));
  const y = Math.min(h - 1, Math.max(0, Math.round((1 - v) * (h - 1)))); // flip V: 0=bottom in UV
  const idx = (y * w + x) * 4;
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255];
}

// ── Main loader ───────────────────────────────────────────────────────────────

export async function loadJawPLYBaked(plyUrl: string, textureUrl: string): Promise<THREE.BufferGeometry> {
  const [buffer, imgData] = await Promise.all([
    fetch(plyUrl).then(r => r.arrayBuffer()),
    loadImageData(textureUrl),
  ]);

  const header = parseHeader(buffer);
  const parsed = parsePLYData(buffer, header);

  // Bake per-vertex colors from texture, with same enhancement as scan page
  const colors = new Float32Array(header.vertexCount * 3);
  for (let i = 0; i < header.vertexCount; i++) {
    let r: number, g: number, b: number;
    if (parsed.uvCounts[i] === 0) {
      r = 0.85; g = 0.80; b = 0.75;
    } else {
      // uvSums stores the single assigned UV directly (first-assignment-wins, no averaging)
      const u = parsed.uvSums[i * 2];
      const v = parsed.uvSums[i * 2 + 1];
      [r, g, b] = sampleTexture(imgData.data, imgData.width, imgData.height, u, v);
      const avg = (r + g + b) / 3;
      r = ((r - avg) * 1.4 + avg) * 1.35 * 0.65;
      g = ((g - avg) * 1.4 + avg) * 1.35 * 0.65;
      b = ((b - avg) * 1.4 + avg) * 1.35 * 0.65;
      r = Math.min(1, Math.max(0, r));
      g = Math.min(1, Math.max(0, g));
      b = Math.min(1, Math.max(0, b));
    }
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(parsed.positions, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(parsed.normals,   3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(parsed.indices, 1));
  geo.center();

  return geo;
}

// ── Suspense-compatible cache ─────────────────────────────────────────────────

const _cache = new Map<string, THREE.BufferGeometry | Promise<THREE.BufferGeometry>>();

export function useJawGeo(plyUrl: string, textureUrl: string): THREE.BufferGeometry {
  const key = `${plyUrl}|${textureUrl}`;
  const entry = _cache.get(key);
  if (entry instanceof THREE.BufferGeometry) return entry;
  if (entry instanceof Promise) throw entry;
  const p = loadJawPLYBaked(plyUrl, textureUrl).then(g => { _cache.set(key, g); return g; });
  _cache.set(key, p);
  throw p;
}
