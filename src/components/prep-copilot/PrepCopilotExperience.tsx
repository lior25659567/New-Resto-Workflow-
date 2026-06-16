import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import CopilotModelViewer from './CopilotModelViewer';
import PrepCopilotPanel from './PrepCopilotPanel';
import { usePrepCopilotStateMachine } from './usePrepCopilotStateMachine';
import type { ViewId, ZoneId } from './types';
import { detectCaseFromTreatments, PANEL_WIDTH } from './constants';

import MeasuredReductionHeatmap from './overlays/MeasuredReductionHeatmap';
import ReductionHeatmap from './overlays/ReductionHeatmap';
import ZoneOverlay from './overlays/ZoneOverlay';
import HeatmapLegend from './overlays/HeatmapLegend';
import CrossSectionOverlay from './overlays/CrossSectionOverlay';
import { ModelContext } from './CopilotScene';
import CopilotProgressStrip from './CopilotProgressStrip';
import { PlyUploadDropzone } from './PlyUploadDropzone';
import { PrepAreaBrushPanel } from './brush/PrepAreaBrushPanel';
import { DefaultModelBrush } from './brush/DefaultModelBrush';
import { usePlyUpload } from './usePlyUpload';
import { icpAlign } from './icp/icpAlign';
import { PrepModelsContext } from './usePrepModels';
import { AnimatePresence, motion } from 'framer-motion';
import { useJawGeo } from '../jaw-viewer/jawPLYLoader';

import prepPretreatmentUrl from '@/assets/Prep copilot 3d models/upper_jaw_pretreatment_261974141.ply?url';
import prepWithDitchUrl from '@/assets/Prep copilot 3d models/upper_jaw_with_ditch_261974141.ply?url';

// Canonical model settings from skill: 3d model movement
const USER_MODEL_SCALE = 0.035;
const USER_MODEL_ROTATION: [number, number, number] = [Math.PI * 0.6, 0, Math.PI];

// Default positions for the prep copilot models — adjust and copy via the position controls
const DEFAULT_PRETREATMENT_POS: [number, number, number] = [0, 0, 0];
const DEFAULT_DITCH_POS: [number, number, number] = [0, 0, 0];

const GUM_SHEEN = new THREE.Color(0xffeee6);

function UserPostTreatmentMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geometry} scale={USER_MODEL_SCALE} rotation={USER_MODEL_ROTATION}>
      <meshPhysicalMaterial
        vertexColors
        roughness={0.2}
        metalness={0.0}
        side={THREE.DoubleSide}
        clearcoat={0.5}
        clearcoatRoughness={0.12}
        reflectivity={0.45}
        envMapIntensity={1.0}
        ior={1.52}
        sheen={0.28}
        sheenRoughness={0.65}
        sheenColor={GUM_SHEEN}
      />
    </mesh>
  );
}

function GhostPretreatmentMesh({ geometry, alignmentMatrix }: { geometry: THREE.BufferGeometry; alignmentMatrix: THREE.Matrix4 }) {
  const alignedGeo = useMemo(() => {
    const clone = geometry.clone();
    clone.applyMatrix4(alignmentMatrix);
    return clone;
  }, [geometry, alignmentMatrix]);

  return (
    <mesh geometry={alignedGeo} scale={USER_MODEL_SCALE} rotation={USER_MODEL_ROTATION}>
      <meshPhysicalMaterial
        color="#e8e4dc"
        transparent
        opacity={0.3}
        depthWrite={false}
        side={THREE.DoubleSide}
        roughness={0.6}
      />
    </mesh>
  );
}

const STONE_COLOR = new THREE.Color(0xe8e4dc);
const STONE_SHEEN = new THREE.Color(0xf2f0ec);

interface DefaultModelMeshProps {
  url: string;
  position: [number, number, number];
  meshRef?: React.Ref<THREE.Mesh>;
  onPointerDown?: (e: any) => void;
  onPointerUp?: (e: any) => void;
}

function DefaultModelMesh({ url, position, meshRef, onPointerDown, onPointerUp }: DefaultModelMeshProps) {
  const geometry = useJawGeo(url, '');
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      scale={USER_MODEL_SCALE}
      rotation={USER_MODEL_ROTATION}
      position={position}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <meshPhysicalMaterial
        color={STONE_COLOR}
        roughness={0.65}
        metalness={0.0}
        side={THREE.DoubleSide}
        clearcoat={0.08}
        clearcoatRoughness={0.7}
        reflectivity={0.2}
        envMapIntensity={0.4}
        ior={1.4}
        sheen={0.2}
        sheenRoughness={0.8}
        sheenColor={STONE_SHEEN}
      />
    </mesh>
  );
}

function PositionAdjustPanel({
  pretreatmentPos,
  ditchPos,
  onNudge,
  onCopy,
  visible,
  onToggle,
}: {
  pretreatmentPos: [number, number, number];
  ditchPos: [number, number, number];
  onNudge: (model: 'pretreatment' | 'ditch', dx: number, dy: number, dz: number) => void;
  onCopy: () => void;
  visible: boolean;
  onToggle: () => void;
}) {
  const step = 0.05;
  const fmt = (v: number) => v.toFixed(2);

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-2 left-2 z-[60] rounded bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-white/70 hover:bg-slate-700/90"
      >
        Adjust Positions
      </button>
    );
  }

  const ModelControls = ({ label, pos, model }: { label: string; pos: [number, number, number]; model: 'pretreatment' | 'ditch' }) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-white/80">{label} [{fmt(pos[0])}, {fmt(pos[1])}, {fmt(pos[2])}]</span>
      <div className="flex flex-wrap gap-1">
        <button className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] hover:bg-slate-200" onClick={() => onNudge(model, -step, 0, 0)}>X−</button>
        <button className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] hover:bg-slate-200" onClick={() => onNudge(model, step, 0, 0)}>X+</button>
        <button className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] hover:bg-slate-200" onClick={() => onNudge(model, 0, -step, 0)}>Y−</button>
        <button className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] hover:bg-slate-200" onClick={() => onNudge(model, 0, step, 0)}>Y+</button>
        <button className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] hover:bg-slate-200" onClick={() => onNudge(model, 0, 0, -step)}>Z−</button>
        <button className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] hover:bg-slate-200" onClick={() => onNudge(model, 0, 0, step)}>Z+</button>
      </div>
    </div>
  );

  return (
    <div className="absolute top-2 left-2 z-[60] flex flex-col gap-2 rounded-lg bg-slate-900/90 p-3 backdrop-blur-sm" style={{ maxWidth: 260 }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-white/90">Model Positions</span>
        <button onClick={onToggle} className="text-[10px] text-white/50 hover:text-white/80">Close</button>
      </div>
      <ModelControls label="Pretreatment" pos={pretreatmentPos} model="pretreatment" />
      <ModelControls label="With Ditch" pos={ditchPos} model="ditch" />
      <button onClick={onCopy} className="rounded bg-[#009ACE] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#0088b8]">
        Copy Values
      </button>
    </div>
  );
}

interface PrepCopilotExperienceProps {
  onClose: () => void;
  toolbarCollapsed?: boolean;
  toothTreatments?: Record<string, string>;
}

export default function PrepCopilotExperience({ onClose, toolbarCollapsed = true, toothTreatments }: PrepCopilotExperienceProps) {
  const caseData = useMemo(() => detectCaseFromTreatments(toothTreatments), [toothTreatments]);

  const {
    state,
    setActiveView,
    setSelectedMaterial,
    setSelectedZone,
    setInsertionPath,
    resetInsertionPath,
    toggleBridgeMode,
    statusText,
    setModelsUploaded,
    setAlignmentComplete,
    setBrushedCount,
    startAnalysisFromBrush,
  } = usePrepCopilotStateMachine(true, caseData);

  const [undercutBannerDismissed, setUndercutBannerDismissed] = useState(false);

  // Upload state
  const upload = usePlyUpload();

  // Model alignment state
  const [alignmentMatrix, setAlignmentMatrix] = useState<THREE.Matrix4 | null>(null);
  const [isAligning, setIsAligning] = useState(false);

  // Brush state
  const [brushMask, setBrushMask] = useState<Uint8Array | null>(null);
  const [brushSize, setBrushSize] = useState<'S' | 'M' | 'L'>('M');
  const [eraseMode, setEraseMode] = useState(false);
  const [paintedCount, setPaintedCount] = useState(0);
  const [brushEnabled, setBrushEnabled] = useState(false);
  const [heatmapKey, setHeatmapKey] = useState(0);
  const ditchMeshRef = useRef<THREE.Mesh>(null);
  const pretreatmentMeshRef = useRef<THREE.Mesh>(null);

  const handleBrushMaskUpdate = useCallback((mask: Uint8Array, count: number) => {
    setBrushMask(mask);
    setPaintedCount(count);
    setBrushedCount(count);
  }, [setBrushedCount]);

  // Default model position state
  const [pretreatmentPos, setPretreatmentPos] = useState<[number, number, number]>([...DEFAULT_PRETREATMENT_POS]);
  const [ditchPos, setDitchPos] = useState<[number, number, number]>([...DEFAULT_DITCH_POS]);
  const [showPosControls, setShowPosControls] = useState(false);

  const nudgeModel = useCallback((model: 'pretreatment' | 'ditch', dx: number, dy: number, dz: number) => {
    const setter = model === 'pretreatment' ? setPretreatmentPos : setDitchPos;
    setter(([x, y, z]) => [x + dx, y + dy, z + dz]);
  }, []);

  const copyPositionValues = useCallback(() => {
    const text = `Pretreatment: [${pretreatmentPos.map(v => v.toFixed(2)).join(', ')}]\nWith Ditch: [${ditchPos.map(v => v.toFixed(2)).join(', ')}]`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [pretreatmentPos, ditchPos]);

  // Reset banner each time the user enters the undercuts view
  useEffect(() => {
    if (state.activeView === 'undercuts') setUndercutBannerDismissed(false);
  }, [state.activeView]);

  // Handle upload ready → start ICP alignment
  const handleUploadsReady = useCallback(async () => {
    if (!upload.pre.geometry || !upload.post.geometry) return;
    setModelsUploaded();
    setIsAligning(true);

    // Run ICP in a setTimeout to not block render
    setTimeout(() => {
      try {
        const result = icpAlign(upload.pre.geometry!, upload.post.geometry!, {
          maxIterations: 50,
          sampleCount: 8000,
        });
        setAlignmentMatrix(result.matrix);
        setAlignmentComplete(result.meanError);
      } catch {
        setAlignmentComplete(-1);
      } finally {
        setIsAligning(false);
      }
    }, 50);
  }, [upload.pre.geometry, upload.post.geometry, setModelsUploaded, setAlignmentComplete]);

  // Handle brush analysis start
  const handleRunAnalysis = useCallback(() => {
    startAnalysisFromBrush();
  }, [startAnalysisFromBrush]);

  const handleViewChange = useCallback((view: ViewId) => {
    setActiveView(view);
  }, [setActiveView]);

  const handleZoneSelect = useCallback((zone: ZoneId) => {
    setSelectedZone(zone);
  }, [setSelectedZone]);

  const handleBrushClear = useCallback(() => {
    setBrushMask(null);
    setPaintedCount(0);
    setBrushedCount(0);
  }, [setBrushedCount]);

  const { activeView, phase } = state;
  const hasDefaultModelsForHeatmap = !!ditchMeshRef.current?.geometry && !!pretreatmentMeshRef.current?.geometry && !!brushMask && paintedCount > 0;
  const showMeasuredHeatmap = (
    (state.hasUserModels && !!alignmentMatrix && !!brushMask) || hasDefaultModelsForHeatmap
  );
  const showProceduralHeatmap = activeView === 'reduction' && state.hasUserModels && !showMeasuredHeatmap;
  const showZoneOverlay = activeView === 'zones' && state.hasUserModels;
  const showCrossSection = activeView === 'section';

  const modelContextValue = useMemo(() => {
    if (!upload.post.geometry) return null;
    const geo = upload.post.geometry;
    const pos = geo.attributes.position;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return {
      bounds: { minX, maxX, minY, maxY, minZ, maxZ, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, centerZ: (minZ + maxZ) / 2 },
      geometry: geo,
    };
  }, [upload.post.geometry]);

  const isUploadPhase = phase === 'uploading';
  const isBrushPhase = phase === 'brushing';

  // Context value for prep models
  const prepModelsValue = useMemo(() => ({
    preGeometry: upload.pre.geometry,
    postGeometry: upload.post.geometry,
    alignmentMatrix,
    alignmentError: state.alignmentError,
    isAligning,
    brushMask,
    setBrushMask,
  }), [upload.pre.geometry, upload.post.geometry, alignmentMatrix, state.alignmentError, isAligning, brushMask]);

  return (
    <PrepModelsContext.Provider value={prepModelsValue}>
      <div className="absolute inset-0 z-[15]">
        <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
          <CopilotModelViewer disableRotate={brushEnabled}>
            <ModelContext.Provider value={modelContextValue}>
              {/* Default prep copilot models — always visible */}
              <DefaultModelMesh url={prepPretreatmentUrl} position={pretreatmentPos} meshRef={pretreatmentMeshRef} />
              <DefaultModelMesh
                url={prepWithDitchUrl}
                position={ditchPos}
                meshRef={ditchMeshRef}
              />


              {/* User's post-treatment model */}
              {state.hasUserModels && upload.post.geometry && (
                <UserPostTreatmentMesh geometry={upload.post.geometry} />
              )}

              {/* Pre-treatment model aligned on top of post-treatment */}
              {alignmentMatrix && upload.pre.geometry && phase !== 'uploading' && (
                <GhostPretreatmentMesh geometry={upload.pre.geometry} alignmentMatrix={alignmentMatrix} />
              )}

              {/* Procedural reduction heatmap (before brush/measured analysis) */}
              {showProceduralHeatmap && (
                <ReductionHeatmap visible={true} scale={USER_MODEL_SCALE} rotation={USER_MODEL_ROTATION} />
              )}

              {/* Zone overlay (occlusalogram) */}
              {showZoneOverlay && (
                <ZoneOverlay
                  visible={true}
                  selectedZone={state.selectedZone ?? null}
                  onZoneClick={(zone) => setSelectedZone(zone)}
                  scale={USER_MODEL_SCALE}
                  rotation={USER_MODEL_ROTATION}
                />
              )}

              {/* Cross-section plane */}
              {showCrossSection && (
                <CrossSectionOverlay
                  visible={true}
                  planeNormal={[1, 0, 0]}
                  planeOffset={0}
                  scale={USER_MODEL_SCALE}
                  rotation={USER_MODEL_ROTATION}
                />
              )}

              {/* Real measured reduction heatmap — from uploaded models */}
              {showMeasuredHeatmap && upload.post.geometry && upload.pre.geometry && alignmentMatrix && brushMask && (
                <MeasuredReductionHeatmap
                  postGeometry={upload.post.geometry}
                  preGeometry={upload.pre.geometry}
                  alignmentMatrix={alignmentMatrix}
                  brushMask={brushMask}
                  visible={true}
                  scale={USER_MODEL_SCALE}
                  rotation={USER_MODEL_ROTATION}
                />
              )}

              {/* Measured reduction heatmap — from default models + brush */}
              {showMeasuredHeatmap && hasDefaultModelsForHeatmap && !upload.post.geometry && (
                <MeasuredReductionHeatmap
                  postGeometry={ditchMeshRef.current!.geometry}
                  preGeometry={pretreatmentMeshRef.current!.geometry}
                  alignmentMatrix={new THREE.Matrix4()}
                  brushMask={brushMask!}
                  visible={true}
                  scale={USER_MODEL_SCALE}
                  rotation={USER_MODEL_ROTATION}
                  recomputeKey={heatmapKey}
                />
              )}

              {/* Brush for painting prep area on default model */}
              <DefaultModelBrush
                meshRef={ditchMeshRef}
                enabled={brushEnabled}
                brushSize={brushSize}
                eraseMode={eraseMode}
                onMaskUpdate={handleBrushMaskUpdate}
                onStrokeEnd={() => setHeatmapKey(k => k + 1)}
              />
            </ModelContext.Provider>
          </CopilotModelViewer>

          <PositionAdjustPanel
            pretreatmentPos={pretreatmentPos}
            ditchPos={ditchPos}
            onNudge={nudgeModel}
            onCopy={copyPositionValues}
            visible={showPosControls}
            onToggle={() => setShowPosControls(v => !v)}
          />

          <CopilotProgressStrip
            phase={phase}
            progress={state.overallProgress}
            statusText={statusText}
          />

          {/* Heatmap legend for reduction view */}
          <HeatmapLegend visible={activeView === 'reduction' && state.hasUserModels} />
        </div>

        {/* Undercut banner */}
        <AnimatePresence>
          {activeView === 'undercuts' && !undercutBannerDismissed && (
            <motion.div
              key="undercut-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="absolute z-[46] flex overflow-hidden rounded-[8px]"
              style={{
                top: toolbarCollapsed ? 16 + 76 + 16 : 16 + 100 + 16,
                left: 16,
                right: PANEL_WIDTH + 32,
                background: '#fff',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.10), 0px 2px 4px rgba(0,0,0,0.20)',
              }}
            >
              <div className="w-3 shrink-0 self-stretch" style={{ background: '#00ADEF' }} />
              <div className="flex flex-1 items-start min-w-0 px-5 py-4 gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <p className="font-bold text-[15px] leading-[20px] text-[#3E3D40]">
                    Undercut Analysis Active
                  </p>
                  <p className="text-[13px] leading-[20px] font-normal text-[#3E3D40]">
                    Areas highlighted in red indicate undercuts that may prevent the restoration from seating. Adjust the insertion path to minimize undercut zones.
                  </p>
                </div>
                <button
                  onClick={() => setUndercutBannerDismissed(true)}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded"
                  style={{ color: '#3E3D40' }}
                  aria-label="Dismiss"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel content switches based on phase */}
        <AnimatePresence mode="wait">
          {isUploadPhase && (
            <motion.div
              key="upload-panel"
              className="absolute bottom-0 right-0 z-[45]"
              style={{ width: PANEL_WIDTH, height: '100%' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(30, 30, 34, 0.95)',
                  backdropFilter: 'blur(12px)',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <PlyUploadDropzone
                  pre={upload.pre}
                  post={upload.post}
                  onDrop={upload.handleDrop}
                  onReady={handleUploadsReady}
                  isReady={upload.isReady}
                />
              </div>
            </motion.div>
          )}

          {isBrushPhase && (
            <motion.div
              key="brush-panel"
              className="absolute bottom-0 right-0 z-[45]"
              style={{ width: PANEL_WIDTH, height: '100%' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(30, 30, 34, 0.95)',
                  backdropFilter: 'blur(12px)',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: 60,
                }}
              >
                <PrepAreaBrushPanel
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                  eraseMode={eraseMode}
                  onEraseModeChange={setEraseMode}
                  paintedCount={paintedCount}
                  onClear={handleBrushClear}
                  onRunAnalysis={handleRunAnalysis}
                />
              </div>
            </motion.div>
          )}

          {!isUploadPhase && !isBrushPhase && (
            <PrepCopilotPanel
              key="main-panel"
              onClose={onClose}
              state={state}
              statusText={statusText}
              onViewChange={handleViewChange}
              onMaterialChange={setSelectedMaterial}
              onZoneSelect={handleZoneSelect}
              onInsertionPathChange={setInsertionPath}
              onResetInsertionPath={resetInsertionPath}
              onToggleBridgeMode={toggleBridgeMode}
              toolbarCollapsed={toolbarCollapsed}
              brushEnabled={brushEnabled}
              onBrushToggle={() => setBrushEnabled(v => !v)}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              eraseMode={eraseMode}
              onEraseModeChange={setEraseMode}
              paintedCount={paintedCount}
              onBrushClear={handleBrushClear}
            />
          )}
        </AnimatePresence>
      </div>
    </PrepModelsContext.Provider>
  );
}
