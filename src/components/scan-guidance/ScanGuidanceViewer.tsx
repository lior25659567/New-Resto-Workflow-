import '@react-three/fiber';
import React, {
  useRef, useMemo, useState,
  useCallback, useEffect, useLayoutEffect,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { TrackballControls, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import upperJawModel  from '@/assets/3d-models/new 3d models /Upper.ply?url';
import lowerJawModel  from '@/assets/3d-models/new 3d models /Lower.ply?url';
import biteModel      from '@/assets/3d-models/new 3d models /Both Arches.ply?url';
import { loadiTeroPLY } from './iTeroPLYLoader';
import RevealMaterial from './RevealMaterial';
import { useScanProgress } from './useScanProgress';
import { useGuidanceEngine } from './useGuidanceEngine';
import GuidanceOverlay from './GuidanceOverlay';
import GuidanceArrows3D from './GuidanceArrows3D';
import type { ScanPhase, GuidanceState, ModelBounds, GuidanceMode } from './types';

// ─── Inner scene ──────────────────────────────────────────────────────────────

const BASE_ROT_X = Math.PI * 0.6;
const BASE_ROT_Z = Math.PI;

// Reusable vector for projection (avoids GC)
const _projVec = new THREE.Vector3();

type JawType = 'upper' | 'lower' | 'bite';

interface SceneProps {
  onGuidanceUpdate: (g: GuidanceState) => void;
  onReset?: number;
  guidanceMode?: GuidanceMode;
  lockModel?: boolean;
  isScanningRef?: React.RefObject<boolean>;
  showArrows3D?: boolean;
  jaw?: JawType;
}

const DOF_AXIS: Record<string, 'lr'|'ud'|'fb'|'roll'|'pitch'|'yaw'> = {
  'dof-lr':'lr','bare-lr':'lr','ring-lr':'lr','pulse-lr':'lr','ghost-lr':'lr','wand-lr':'lr','gwand-lr':'lr','bgwand-lr':'lr','fgwand-lr':'lr','fagwand-lr':'lr',
  'dof-ud':'ud','bare-ud':'ud','ring-ud':'ud','pulse-ud':'ud','ghost-ud':'ud','wand-ud':'ud','gwand-ud':'ud','bgwand-ud':'ud','fgwand-ud':'ud','fagwand-ud':'ud',
  'dof-fb':'fb','bare-fb':'fb','ring-fb':'fb','pulse-fb':'fb','ghost-fb':'fb','wand-fb':'fb','gwand-fb':'fb','bgwand-fb':'fb','fgwand-fb':'fb','fagwand-fb':'fb',
  'dof-roll':'roll','bare-roll':'roll','ring-roll':'roll','pulse-roll':'roll','ghost-roll':'roll','wand-roll':'roll','gwand-roll':'roll','bgwand-roll':'roll','fgwand-roll':'roll','fagwand-roll':'roll',
  'dof-pitch':'pitch','bare-pitch':'pitch','ring-pitch':'pitch','pulse-pitch':'pitch','ghost-pitch':'pitch','wand-pitch':'pitch','gwand-pitch':'pitch','bgwand-pitch':'pitch','fgwand-pitch':'pitch','fagwand-pitch':'pitch',
  'dof-yaw':'yaw','bare-yaw':'yaw','ring-yaw':'yaw','pulse-yaw':'yaw','ghost-yaw':'yaw','wand-yaw':'yaw','gwand-yaw':'yaw','bgwand-yaw':'yaw','fgwand-yaw':'yaw','fagwand-yaw':'yaw',
  'fagwand-tilt3d':'yaw','fagwand-spin3d':'roll',
  'rot-cw':'roll','rot-ccw':'roll','rot-tilt':'pitch',
};

const JAW_MODEL_URL: Record<JawType, string> = {
  upper: upperJawModel,
  lower: lowerJawModel,
  bite: biteModel,
};

// Cache loaded geometries so we never reload the same file
const geoCache: Record<string, THREE.BufferGeometry> = {};

function Scene({ onGuidanceUpdate, onReset, guidanceMode, lockModel, isScanningRef, showArrows3D = true, jaw = 'upper' }: SceneProps) {
  const [loadedGeo, setLoadedGeo] = useState<THREE.BufferGeometry | null>(() => geoCache[jaw] || null);

  useEffect(() => {
    const url = JAW_MODEL_URL[jaw];
    if (geoCache[jaw]) {
      setLoadedGeo(geoCache[jaw]);
      return;
    }
    loadiTeroPLY(url).then((geo) => {
      geoCache[jaw] = geo;
      setLoadedGeo(geo);
    });
  }, [jaw]);

  const geometry = loadedGeo;

  const meshRef  = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const scanPlaneRef = useRef<THREE.Mesh>(null);
  const { camera, pointer } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  const [phase, setPhase]         = useState<ScanPhase>('idle');
  const [isHovering, setIsHovering] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const currentRegionRef = useRef<string | undefined>(undefined);
  const weakestCenterRef = useRef<{ x: number; z: number } | null>(null);
  const dofTime = useRef(0);
  const frameCount = useRef(0);
  const guidanceRef = useRef<GuidanceState>({
    phase: 'idle', direction: null, hint: '', coveragePercent: 0,
    activeRegion: null, regions: [], stage: 'occlusal', activeEdge: null,
    stageAdvanced: false, targetScreenPos: null, weakestRegion: null,
    modelRotation: { x: 0, y: 0 },
  });

  const { coverageTexture, captureRect, getCoverage, getRegionCoverage, reset } = useScanProgress();
  const { evaluate, resetEngine } = useGuidanceEngine();

  // ── Geometry ──────────────────────────────────────────────────────────────
  const { bounds, enhancedGeo } = useMemo(() => {
    if (!geometry) return { bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1, surfaceY: 0 } as ModelBounds, enhancedGeo: new THREE.BufferGeometry() };
    const geo = geometry.clone();
    geo.center();
    geo.computeVertexNormals();

    const pos = geo.attributes.position;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    const hasColors = geo.attributes.color !== undefined;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      let r: number, g: number, b: number;
      if (hasColors) {
        r = geo.attributes.color.getX(i);
        g = geo.attributes.color.getY(i);
        b = geo.attributes.color.getZ(i);
        const avg = (r + g + b) / 3;
        r = ((r - avg) * 1.4 + avg) * 1.35 * 0.65;
        g = ((g - avg) * 1.4 + avg) * 1.35 * 0.65;
        b = ((b - avg) * 1.4 + avg) * 1.35 * 0.65;
      } else { r = 0.9; g = 0.85; b = 0.8; }
      col[i * 3]     = Math.min(1, Math.max(0, r));
      col[i * 3 + 1] = Math.min(1, Math.max(0, g));
      col[i * 3 + 2] = Math.min(1, Math.max(0, b));
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const surfaceY = (minY + maxY) / 2;
    return { bounds: { minX, maxX, minZ, maxZ, surfaceY } as ModelBounds, enhancedGeo: geo };
  }, [geometry]);

  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.rotation.set(BASE_ROT_X, 0, BASE_ROT_Z);
  }, []);

  // ── Reset on jaw change ────────────────────────────────────────────────────
  const prevJawRef = useRef(jaw);
  useEffect(() => {
    if (prevJawRef.current !== jaw) {
      prevJawRef.current = jaw;
      reset(); resetEngine();
      setPhase('idle'); setStartTime(null); setIsHovering(false);
      currentRegionRef.current = undefined;
      weakestCenterRef.current = null;
      if (groupRef.current) groupRef.current.rotation.set(BASE_ROT_X, 0, BASE_ROT_Z);
    }
  }, [jaw]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (onReset && onReset > 0) {
      reset(); resetEngine();
      setPhase('idle'); setStartTime(null); setIsHovering(false);
      currentRegionRef.current = undefined;
      weakestCenterRef.current = null;
      if (groupRef.current) groupRef.current.rotation.set(BASE_ROT_X, 0, BASE_ROT_Z);
    }
  }, [onReset]);


  // ── Frame loop ────────────────────────────────────────────────────────────
  useFrame(() => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    if (!mesh || !group) return;

    // ── Model rotation: mouse follow + bias toward unscanned area ──
    const isSurfaceGuide = guidanceMode === 'surface-guide';
    let targetX = BASE_ROT_X;
    let targetY = 0;

    if (!lockModel) {
      targetX += pointer.y * -0.20;
      targetY += pointer.x * 0.40;

      const wc = weakestCenterRef.current;
      if (wc) {
        if (isSurfaceGuide) {
          targetX += (wc.z - 0.5) * -0.55;
          targetY += (wc.x - 0.5) * 0.80;
        } else {
          targetX += (wc.z - 0.5) * -0.15;
          targetY += (wc.x - 0.5) * 0.25;
        }
      }
    }

    const lerpSpeed = lockModel ? 0.10 : (isSurfaceGuide ? 0.04 : 0.14);
    group.rotation.x += (targetX - group.rotation.x) * lerpSpeed;
    group.rotation.y += (targetY - group.rotation.y) * lerpSpeed;
    group.rotation.z  = BASE_ROT_Z;

    // ── 6DoF model animation (disabled when locked) ──
    const axis = (!lockModel && guidanceMode) ? DOF_AXIS[guidanceMode] : undefined;
    dofTime.current += 0.018;
    const sin = Math.sin(dofTime.current * 1.6);
    const m = meshRef.current;
    if (m) {
      if (axis === 'lr')         { group.position.x = sin * 0.12; group.position.y *= 0.92; m.scale.setScalar(0.055); }
      else if (axis === 'ud')    { group.position.y = sin * 0.10; group.position.x *= 0.92; m.scale.setScalar(0.055); }
      else if (axis === 'fb')    { group.position.x *= 0.92; group.position.y *= 0.92; m.scale.setScalar(0.055 * (1 + sin * 0.12)); }
      else if (axis === 'roll')  { group.position.x *= 0.92; group.position.y *= 0.92; group.rotation.z = BASE_ROT_Z + sin * 0.12; m.scale.setScalar(0.055); }
      else if (axis === 'pitch') { group.position.x *= 0.92; group.position.y *= 0.92; group.rotation.x = targetX + sin * 0.15; m.scale.setScalar(0.055); }
      else if (axis === 'yaw')   { group.position.x *= 0.92; group.position.y *= 0.92; group.rotation.y = targetY + sin * 0.18; m.scale.setScalar(0.055); }
      else { group.position.x += (0 - group.position.x) * 0.08; group.position.y += (0 - group.position.y) * 0.08; m.scale.setScalar(0.055); }
    }

    // Raycast against the invisible scan plane for reliable hit detection
    raycaster.current.setFromCamera(pointer, camera);
    const scanPlane = scanPlaneRef.current;
    const planeHits = scanPlane ? raycaster.current.intersectObject(scanPlane, false) : [];
    const hitting = planeHits.length > 0;

    if (hitting !== isHovering) setIsHovering(hitting);

    const coverage = getCoverage();
    let currentPhase: ScanPhase = phase;

    const isSKeyDown = isScanningRef ? isScanningRef.current : false;
    frameCount.current++;

    if (coverage >= 0.95) {
      currentPhase = 'complete';
    } else if (isSKeyDown) {
      if (startTime === null) setStartTime(Date.now());
      currentPhase = 'scanning';

      {
        const rangeX = bounds.maxX - bounds.minX;
        const rangeZ = bounds.maxZ - bounds.minZ;

        // === XZ Plane Projection — no raycasting against geometry ===
        // Project pointer ray onto the model-local XZ plane at surfaceY.
        // This always works regardless of camera angle — no triangle gaps or ring artifacts.

        const invMatrix = new THREE.Matrix4().copy(mesh.matrixWorld).invert();

        // Helper: project an NDC point onto the local XZ plane, returns {x, z} or null
        const projectToXZ = (ndcX: number, ndcY: number): { x: number; z: number } | null => {
          raycaster.current.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera);
          const ro = raycaster.current.ray.origin.clone().applyMatrix4(invMatrix);
          const rd = raycaster.current.ray.direction.clone().transformDirection(invMatrix).normalize();
          if (Math.abs(rd.y) < 0.0001) return null; // parallel to plane
          const t = (bounds.surfaceY - ro.y) / rd.y;
          if (t <= 0) return null; // behind camera
          return { x: ro.x + rd.x * t, z: ro.z + rd.z * t };
        };

        // Main brush at pointer
        const hit = projectToXZ(pointer.x, pointer.y);
        if (hit) {
          const brushX = rangeX * 0.12;
          const brushZ = rangeZ * 0.12;
          captureRect(hit.x - brushX, hit.x + brushX, hit.z - brushZ, hit.z + brushZ, bounds);

          // Cross pattern around center for wider coverage
          const offsets = [
            { dx: 0.04, dy: 0 }, { dx: -0.04, dy: 0 },
            { dx: 0, dy: 0.04 }, { dx: 0, dy: -0.04 },
          ];
          for (const { dx, dy } of offsets) {
            const oh = projectToXZ(pointer.x + dx, pointer.y + dy);
            if (oh) {
              const bx = rangeX * 0.09;
              const bz = rangeZ * 0.09;
              captureRect(oh.x - bx, oh.x + bx, oh.z - bz, oh.z + bz, bounds);
            }
          }
        }

        // Determine active region from the hit point
        if (hit) {
          const rnx = (hit.x - bounds.minX) / rangeX;
          const rnz = (hit.z - bounds.minZ) / rangeZ;
          if      (rnx < 0.5 && rnz < 0.5) currentRegionRef.current = 'upper-left';
          else if (rnx >= 0.5 && rnz < 0.5) currentRegionRef.current = 'upper-right';
          else if (rnx < 0.5)              currentRegionRef.current = 'lower-left';
          else                            currentRegionRef.current = 'lower-right';
        }
      }
    } else if (startTime !== null && !isSKeyDown) {
      currentPhase = 'paused';
    }

    if (currentPhase !== phase) setPhase(currentPhase);

    // ── Evaluate guidance ──
    const guidance = evaluate(currentPhase, coverage, getRegionCoverage, currentRegionRef.current);

    // ── Project weakest region center from 3D → screen space ──
    const wr = guidance.weakestRegion;
    if (wr && guidance.direction) {
      // Compute center of weakest region in model-local space
      const wrCenterX = bounds.minX + ((wr.xMin + wr.xMax) / 2) * (bounds.maxX - bounds.minX);
      const wrCenterZ = bounds.minZ + ((wr.zMin + wr.zMax) / 2) * (bounds.maxZ - bounds.minZ);

      // Use the model's surface Y for accurate projection onto the visible surface
      _projVec.set(wrCenterX, bounds.surfaceY, wrCenterZ);
      mesh.localToWorld(_projVec);
      _projVec.project(camera);

      guidance.targetScreenPos = {
        x: Math.min(0.95, Math.max(0.05, (_projVec.x + 1) / 2)),
        y: Math.min(0.95, Math.max(0.05, (1 - _projVec.y) / 2)),
      };

      // Store for rotation bias (normalized 0-1)
      weakestCenterRef.current = {
        x: (wr.xMin + wr.xMax) / 2,
        z: (wr.zMin + wr.zMax) / 2,
      };
    } else {
      guidance.targetScreenPos = null;
      weakestCenterRef.current = null;
    }

    // Pass actual model rotation delta to the overlay
    guidance.modelRotation = {
      x: group.rotation.x - BASE_ROT_X,
      y: group.rotation.y,
    };

    const finalGuidance = { ...guidance, coveragePercent: coverage };
    guidanceRef.current = finalGuidance;
    onGuidanceUpdate(finalGuidance);
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 5]}   intensity={0.8}  castShadow color="#f5f0e8" />
      <directionalLight position={[-5, 5, -5]}  intensity={0.35} color="#e8eef5" />
      <directionalLight position={[0, -3, 5]}   intensity={0.25} />
      <directionalLight position={[0, 5, -5]}   intensity={0.2}  />
      <pointLight       position={[0, 10, 0]}   intensity={0.2}  color="#fff5e6" />
      <pointLight       position={[3, 0, 3]}    intensity={0.15} color="#e6f0ff" />
      <Environment preset="apartment" background={false} />

      <Center>
        <group ref={groupRef}>
          <mesh ref={meshRef} geometry={enhancedGeo} scale={0.055}>
            <RevealMaterial coverageTexture={coverageTexture} bounds={bounds} />
          </mesh>
          {/* Invisible scan box — catches raycasts reliably from any angle */}
          <mesh ref={scanPlaneRef} scale={0.055} renderOrder={-1}>
            <boxGeometry args={[
              (bounds.maxX - bounds.minX) * 2.5,
              (bounds.maxZ - bounds.minZ) * 2.5,
              (bounds.maxZ - bounds.minZ) * 2.5,
            ]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Center>

      {/* ScanningBoundary removed — scanning happens from the guidance element itself */}

      <TrackballControls
        rotateSpeed={3.0}
        zoomSpeed={1.2}
        panSpeed={0.5}
        staticMoving={false}
        dynamicDampingFactor={0.12}
        minDistance={0.5}
        maxDistance={10}
        makeDefault
      />
    </>
  );
}


// ─── Exported Viewer ─────────────────────────────────────────────────────────

interface ScanGuidanceViewerProps {
  resetTrigger: number;
  guidanceMode?: GuidanceMode;
  lockModel?: boolean;
  hideTopBar?: boolean;
  showArrows?: boolean;
  ghostMain?: boolean;
  syncMain?: boolean;
  /** When true, scanning only occurs while right mouse button is held */
  requireRightClick?: boolean;
  /** Which jaw model to render */
  jaw?: JawType;
}

export default function ScanGuidanceViewer({ resetTrigger, guidanceMode = 'classic', lockModel = false, hideTopBar = false, showArrows = true, ghostMain = false, syncMain = false, requireRightClick = false, jaw = 'upper' }: ScanGuidanceViewerProps) {
  const [guidance, setGuidance] = useState<GuidanceState>({
    phase: 'idle', direction: null, hint: '', coveragePercent: 0,
    activeRegion: null, regions: [],
    stage: 'occlusal', activeEdge: null, stageAdvanced: false,
    targetScreenPos: null, weakestRegion: null, modelRotation: { x: 0, y: 0 },
  });
  const [elapsed, setElapsed]     = useState(0);
  const [pointerNDC, setPointerNDC] = useState({ x: 0, y: 0 });
  const [flashActive, setFlashActive] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // Pre-smoothed wand offset (pixels) fed from RAF lerp loop
  const [wandOffset, setWandOffset] = useState({ x: 0, y: 0 });

  const containerRef    = useRef<HTMLDivElement>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Raw pointer stored in a ref so the RAF loop always sees the latest value
  const rawPointerRef   = useRef({ x: 0, y: 0 });
  // Smoothed offset stored in a ref to avoid stale closure in the loop
  const smoothedRef     = useRef({ x: 0, y: 0 });
  const containerSizeRef = useRef(containerSize);
  const lockModelRef     = useRef(lockModel);
  // S key gates scanning — hold S to scan
  const isScanningRef   = useRef(false);

  // Keep refs in sync with props/state
  useEffect(() => { containerSizeRef.current = containerSize; }, [containerSize]);
  useEffect(() => { lockModelRef.current = lockModel; }, [lockModel]);

  const handleGuidance = useCallback((g: GuidanceState) => {
    setGuidance(g);
    if (g.stageAdvanced) {
      setFlashActive(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashActive(false), 600);
    }
  }, []);

  const pointerThrottle = useRef(0);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x =  (e.clientX - rect.left) / rect.width  * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    // Always update the ref (read by RAF loop — no re-render)
    rawPointerRef.current = { x, y };
    // Only update React state every ~50ms to avoid excess re-renders
    const now = performance.now();
    if (now - pointerThrottle.current > 50) {
      pointerThrottle.current = now;
      setPointerNDC({ x, y });
    }
  }, []);

  const handleMouseDown = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {
    // scanning now gated by S key, not mouse button
  }, []);

  const handleContextMenu = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {
    // no-op — scanning via S key
  }, []);

  // S key held = scanning active; A/D keys = directional control of main wand
  const [keyDir, setKeyDir] = useState<-1 | 0 | 1>(0);
  useEffect(() => {
    const held = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 's') isScanningRef.current = true;
      if (k === 'a' && !held.has('a')) { held.add('a'); setKeyDir(-1); }
      if (k === 'd' && !held.has('d')) { held.add('d'); setKeyDir(1); }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 's') isScanningRef.current = false;
      if (k === 'a') { held.delete('a'); setKeyDir(held.has('d') ? 1 : 0); }
      if (k === 'd') { held.delete('d'); setKeyDir(held.has('a') ? -1 : 0); }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // RAF lerp loop — runs every frame, smoothly interpolates the wand offset
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const raw   = rawPointerRef.current;
      const curr  = smoothedRef.current;
      const cw    = containerSizeRef.current.width  || 1200;
      const ch    = containerSizeRef.current.height || 800;
      const locked = lockModelRef.current;
      // Scale: how far the silhouette moves — bigger = follows mouse further
      const scale = locked ? 0.45 : 0.35;
      const targetX =  raw.x * cw * scale;
      const targetY = -raw.y * ch * scale * 0.72;
      // Lerp factor — higher = snappier tracking, less lag
      const t = locked ? 0.55 : 0.50;
      const nx = curr.x + (targetX - curr.x) * t;
      const ny = curr.y + (targetY - curr.y) * t;
      // Very low threshold so small movements aren't swallowed
      if (Math.abs(nx - curr.x) > 0.001 || Math.abs(ny - curr.y) > 0.001) {
        smoothedRef.current = { x: nx, y: ny };
        setWandOffset({ x: nx, y: ny });
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // runs once; reads live values from refs

  // Track container size for arrow pixel calculations
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setContainerSize({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Elapsed timer
  const startTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (guidance.phase === 'scanning' && !startTimeRef.current) startTimeRef.current = Date.now();
    if (guidance.phase === 'idle') { startTimeRef.current = null; setElapsed(0); }
  }, [guidance.phase]);

  useEffect(() => {
    if (!startTimeRef.current || guidance.phase === 'complete') return;
    const id = setInterval(() => {
      if (startTimeRef.current) setElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [guidance.phase]);

  useEffect(() => {
    startTimeRef.current = null;
    setElapsed(0); setFlashActive(false);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
  }, [resetTrigger]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <Canvas
        camera={{ position: [0, -1.5, 3.5], fov: 40, near: 0.01, far: 1000, up: [0, 1, 0] }}
        gl={{
          antialias: true, alpha: true, preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.7,
        }}
        style={{ touchAction: 'none' }}
        dpr={[1, 2]}
      >
        <Scene
          onGuidanceUpdate={handleGuidance}
          onReset={resetTrigger}
          guidanceMode={guidanceMode}
          lockModel={lockModel}
          isScanningRef={isScanningRef}
          showArrows3D={showArrows}
          jaw={jaw}
        />
      </Canvas>

      <GuidanceOverlay
        guidance={guidance}
        elapsedSeconds={elapsed}
        pointerNDC={pointerNDC}
        flashActive={flashActive}
        containerSize={containerSize}
        mode={guidanceMode}
        wandOffset={wandOffset}
        hideTopBar={hideTopBar}
        showArrows={showArrows}
        ghostMain={ghostMain}
        syncMain={syncMain}
        keyDir={keyDir}
      />
    </div>
  );
}
