import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import CopilotModelViewer from './CopilotModelViewer';
import PrepCopilotPanel from './PrepCopilotPanel';
import { usePrepCopilotStateMachine } from './usePrepCopilotStateMachine';
import type { ViewId, ZoneId } from './types';
import { detectCaseFromTreatments, PANEL_WIDTH } from './constants';

import MeasuredReductionHeatmap from './overlays/MeasuredReductionHeatmap';
import CopilotProgressStrip from './CopilotProgressStrip';
import { PlyUploadDropzone } from './PlyUploadDropzone';
import { PrepAreaBrushPanel } from './brush/PrepAreaBrushPanel';
import { usePlyUpload } from './usePlyUpload';
import { icpAlign } from './icp/icpAlign';
import { PrepModelsContext } from './usePrepModels';
import { AnimatePresence, motion } from 'framer-motion';

// Canonical model settings from skill: 3d model movement
const USER_MODEL_SCALE = 0.035;
const USER_MODEL_ROTATION: [number, number, number] = [Math.PI * 0.6, 0, Math.PI];

function UserPostTreatmentMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geometry} scale={USER_MODEL_SCALE} rotation={USER_MODEL_ROTATION}>
      <meshPhysicalMaterial
        vertexColors
        roughness={0.4}
        metalness={0.0}
        side={THREE.DoubleSide}
        clearcoat={0.15}
        clearcoatRoughness={0.4}
        reflectivity={0.3}
        envMapIntensity={0.5}
        ior={1.3}
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
  const showMeasuredHeatmap = activeView === 'reduction' && state.hasUserModels && !!alignmentMatrix && !!brushMask;

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
          <CopilotModelViewer>
            {/* User's post-treatment model */}
            {state.hasUserModels && upload.post.geometry && (
              <UserPostTreatmentMesh geometry={upload.post.geometry} />
            )}

            {/* Pre-treatment model aligned on top of post-treatment */}
            {alignmentMatrix && upload.pre.geometry && phase !== 'uploading' && (
              <GhostPretreatmentMesh geometry={upload.pre.geometry} alignmentMatrix={alignmentMatrix} />
            )}

            {/* Real measured reduction heatmap */}
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
          </CopilotModelViewer>

          <CopilotProgressStrip
            phase={phase}
            progress={state.overallProgress}
            statusText={statusText}
          />
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
            />
          )}
        </AnimatePresence>
      </div>
    </PrepModelsContext.Provider>
  );
}
