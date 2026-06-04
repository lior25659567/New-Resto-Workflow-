import { Suspense } from "react";
import { Patient } from "../components/PatientList";
import Header from "../components/Header";
import { MultiLayerOption2 } from "../components/MultiLayerOption2";
import { ToolbarView } from "../components/ToolbarView";
import ScanProgressBar from "../imports/ScanProgressBar";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import JawModelScene, { DEFAULT_BOTH_UPPER_POS, DEFAULT_BOTH_LOWER_POS } from "../components/jaw-viewer/JawModelScene";

interface ScannedLayer {
  id: string;
  label: string;
  type: "treatment" | "bite" | "pre-treatment" | "additional";
  scannedJaws: {
    upper: boolean;
    lower: boolean;
    bite: boolean;
  };
}

interface MultiLayerViewProps {
  patient: Patient | null;
  onBack: () => void;
  onHome: () => void;
  onNavigateToMultiLayer?: () => void;
  onNavigateToView?: () => void;
  onNavigateToSummary?: () => void;
  onNavigateToRx?: () => void;
  scannedLayers?: ScannedLayer[];
  scanType?: string | null;
  selectedBiteOptions?: string[];
  /** Custom canvas background color (default: #E0EDF4) */
  canvasBg?: string;
  onCanvasBgChange?: (color: string) => void;
}

export default function MultiLayerView({ patient, onBack, onHome, onNavigateToMultiLayer, onNavigateToView, onNavigateToSummary, onNavigateToRx, scannedLayers, scanType, selectedBiteOptions, canvasBg = '#E0EDF4', onCanvasBgChange }: MultiLayerViewProps) {
  // Determine if this is a crown workflow
  const isCrownWorkflow = scanType === 'crown';
  const isImplantWorkflow = scanType === 'implantPlanning';

  // Generate default complete layers for Crown and Implant-based workflows
  // This ensures the view always shows all necessary scans as if the full flow was completed
  // Memoized to prevent new array references on every render which would cause infinite update loops
  const effectiveLayers: ScannedLayer[] = useMemo(() => {
    if (isCrownWorkflow) {
      // Crown workflow ALWAYS shows the complete model regardless of scan state
      // Both pre-treatment and treatment have upper + lower fully available
      return [
        {
          id: 'default-pretreatment',
          label: 'Pre-treatment',
          type: 'pre-treatment' as const,
          scannedJaws: { upper: true, lower: true, bite: false },
        },
        {
          id: 'default-treatment',
          label: 'Treatment scan',
          type: 'treatment' as const,
          scannedJaws: { upper: true, lower: true, bite: false },
        },
      ];
    }

    if (isImplantWorkflow) {
      // Implant-based workflow ALWAYS shows the complete model regardless of scan state
      // Same pattern as Crown: hardcoded layers, no merging with scanned data
      return [
        {
          id: 'default-pretreatment',
          label: 'Pre-treatment',
          type: 'pre-treatment' as const,
          scannedJaws: { upper: true, lower: true, bite: false },
        },
        {
          id: 'default-treatment',
          label: 'Treatment scan',
          type: 'treatment' as const,
          scannedJaws: { upper: true, lower: true, bite: false },
        },
        {
          id: 'default-additional',
          label: 'Emergence profile',
          type: 'additional' as const,
          scannedJaws: { upper: false, lower: true, bite: false },
        },
      ];
    }

    // For other workflows, just use whatever was scanned
    return scannedLayers || [];
  }, [isCrownWorkflow, isImplantWorkflow, scannedLayers]);
  
  // For implant-based and crown workflows, start with lower arch view selected
  const hasLowerScans = effectiveLayers.some(layer => layer.scannedJaws.lower);
  const [selectedView, setSelectedView] = useState(hasLowerScans ? 1 : 2); // 0 = upper, 1 = lower, 2 = both jaws
  const [opacityValues, setOpacityValues] = useState({ upperOpacity: 1.0, lowerOpacity: 1.0 });
  
  // Track active tool from toolbar (1=Review, 2=Occlusogram, 3=Margin Line, 4=Prep QC, 5=Trim)
  const [activeTool, setActiveTool] = useState<number | null>(null);
  // Monochrome is independent of the active tool — can stack with occlusogram or be solo
  const [isMonochromeActive, setIsMonochromeActive] = useState(false);
  
  // When a tool is active, only show treatment scan (hide pre-treatment and additional)
  const isToolActive = activeTool !== null;
  
  // Prep QC (tool 4) is special - shows both pre-treatment and treatment layers
  const isPrepQCActive = activeTool === 4;

  const prepQCVariant = 1 as const;
  
  // Trim (tool 5) is special - shows layer selection
  const isTrimActive = activeTool === 5;
  const [trimSelectedLayer, setTrimSelectedLayer] = useState<'pre-treatment' | 'treatment'>('treatment');
  const isOcclusogramActive = activeTool === 2;
  const [occlusogramSelectedLayer, setOcclusogramSelectedLayer] = useState<'pre-treatment' | 'treatment' | 'additional'>('treatment');
  
  // Initialize layer states with default values based on scannedLayers
  const [layerStates, setLayerStates] = useState<{
    pretreatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
    treatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
    additional?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
  }>(() => {
    const initialStates: {
      pretreatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
      treatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
      additional?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
    } = {};
    
    const pretreatmentLayer = effectiveLayers.find(layer => layer.type === 'pre-treatment');
    const treatmentLayer = effectiveLayers.find(layer => layer.type === 'treatment' || layer.label === 'Treatment scan');
    const additionalLayer = effectiveLayers.find(layer => layer.type === 'additional');
    
    if (pretreatmentLayer) {
      initialStates.pretreatment = { 
        upper: 50, 
        lower: 50, 
        upperVisible: pretreatmentLayer.scannedJaws.upper ?? true, 
        lowerVisible: pretreatmentLayer.scannedJaws.lower ?? true 
      };
    }
    if (treatmentLayer) {
      initialStates.treatment = { 
        upper: 50, 
        lower: 50, 
        upperVisible: treatmentLayer.scannedJaws.upper ?? true, 
        lowerVisible: treatmentLayer.scannedJaws.lower ?? true 
      };
    }
    if (additionalLayer) {
      initialStates.additional = { 
        upper: 50, 
        lower: 50, 
        upperVisible: additionalLayer.scannedJaws.upper ?? true, 
        lowerVisible: additionalLayer.scannedJaws.lower ?? true 
      };
    }
    
    // Ensure we always have at least one layer visible for testing
    if (!initialStates.pretreatment && !initialStates.treatment && !initialStates.additional) {
      initialStates.treatment = {
        upper: 100,
        lower: 100,
        upperVisible: true,
        lowerVisible: true
      };
    }
    
    return initialStates;
  });
  // const [multiLayerOption, setMultiLayerOption] = useState<1 | 2>(1); // Backup: Option 1 available but hidden

  // Ensure additional layer state exists when Prep QC is activated
  useEffect(() => {
    if (isPrepQCActive && !layerStates.additional) {
      setLayerStates(prev => ({
        ...prev,
        additional: { upper: 50, lower: 50, upperVisible: true, lowerVisible: true }
      }));
    }
  }, [isPrepQCActive]);

  // Jaw position adjustment — Both view
  const [showToothMarkers, setShowToothMarkers] = useState(false);
  
  // Tooth markers are controlled independently by 'T' key, not by heatmap tools

  // 'T' key also toggles tooth markers
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 't' && !e.repeat) setShowToothMarkers(v => !v); };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, []);

  const [isJawMoveMode, setIsJawMoveMode] = useState(false);
  const [upperJawPos, setUpperJawPos] = useState<[number, number, number]>([...DEFAULT_BOTH_UPPER_POS]);
  const [lowerJawPos, setLowerJawPos] = useState<[number, number, number]>([...DEFAULT_BOTH_LOWER_POS]);
  // Jaw position adjustment — Single upper view
  const [isUpperSingleMoveMode, setIsUpperSingleMoveMode] = useState(false);
  const [upperSinglePos, setUpperSinglePos] = useState<[number, number, number]>([0, 0, 0]);
  const jawStep = 0.05;
  const nudgeUpper = useCallback((dx: number, dy: number, dz: number) => {
    setUpperJawPos(([x, y, z]) => [x + dx, y + dy, z + dz]);
  }, []);
  const nudgeLower = useCallback((dx: number, dy: number, dz: number) => {
    setLowerJawPos(([x, y, z]) => [x + dx, y + dy, z + dz]);
  }, []);
  const nudgeUpperSingle = useCallback((dx: number, dy: number, dz: number) => {
    setUpperSinglePos(([x, y, z]) => [x + dx, y + dy, z + dz]);
  }, []);
  const copyJawValues = useCallback(() => {
    const text = `Upper: [${upperJawPos.map(v => v.toFixed(2)).join(', ')}]  Lower: [${lowerJawPos.map(v => v.toFixed(2)).join(', ')}]`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [upperJawPos, lowerJawPos]);
  const copyUpperSingleValues = useCallback(() => {
    const text = `Upper single: [${upperSinglePos.map(v => v.toFixed(2)).join(', ')}]`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [upperSinglePos]);

  // Post-processing progress bar state
  const [postProcessingProgress, setPostProcessingProgress] = useState(0);
  const [isPostProcessing, setIsPostProcessing] = useState(true);

  // Simulate post-processing progress
  useEffect(() => {
    if (isPostProcessing) {
      const duration = 200;
      const interval = 16;
      const steps = duration / interval;
      const increment = 100 / steps;
      
      const timer = setInterval(() => {
        setPostProcessingProgress(prev => {
          const next = prev + increment;
          if (next >= 100) {
            clearInterval(timer);
            setIsPostProcessing(false);
            return 100;
          }
          return next;
        });
      }, interval);
      
      return () => clearInterval(timer);
    }
  }, [isPostProcessing]);

  // Handle bite click
  const handleBiteClick = useCallback((bite: string) => {
    // When a bite is clicked, switch to "both" view
    setSelectedView(2);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: canvasBg }}>
      <Header
        activeSteps={{ search: true }}
        onStepToggle={(step) => {
          if (step === 'email') {
            onNavigateToSummary?.();
          } else if (step === 'rx') {
            onNavigateToRx?.();
          } else if (step === 'stepIcon') {
            onNavigateToMultiLayer?.();
          }
        }}
        onNavigateToRx={onNavigateToRx}
        onNavigateToScan={onNavigateToMultiLayer}
        onNavigateToView={onNavigateToView}
        onNavigateToSummary={onNavigateToSummary}
        canvasBg={canvasBg}
        onCanvasBgChange={onCanvasBgChange}
      />

      {/* Main content area */}
      <div className="flex-1 relative p-6" style={{ background: canvasBg }}>
        {/* Multi Layer Panel - Top Left, next to toolbar */}
        <div className="absolute top-4 left-4 z-10">
          <MultiLayerOption2
            onViewChange={setSelectedView}
            onSliderChange={setOpacityValues}
            onLayerStatesChange={setLayerStates}
            scannedLayers={effectiveLayers}
            isViewTab={true}
            simplifiedMode={activeTool === 1 || activeTool === 3}
            selectedView={selectedView}
            prepQCMode={isPrepQCActive}
            prepQCVariant={prepQCVariant}
            trimMode={isTrimActive}
            onTrimLayerChange={setTrimSelectedLayer}
            occlusogramMode={isOcclusogramActive}
            onOcclusogramLayerChange={setOcclusogramSelectedLayer}
            selectedBiteOptions={selectedBiteOptions}
            onBiteClick={handleBiteClick}
            isDentures={scanType === "dentures"}
          />
        </div>
        

        {/* Post-processing Progress Bar - Top Center, aligned with panels */}
        {isPostProcessing && (
          <div 
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 w-[264px]"
            style={{
              opacity: postProcessingProgress >= 100 ? 0 : 1,
              transition: 'opacity 0.5s ease',
            }}
          >
            <ScanProgressBar progress={postProcessingProgress} label="Post processing" />
          </div>
        )}
        
        {/* ToolbarView - Top Right */}
        <div className="absolute top-4 right-4 z-10">
          <ToolbarView onActiveToolChange={setActiveTool} onMonochromeChange={setIsMonochromeActive} isDentures={scanType === "dentures"} />
        </div>

        {/* Jaw Position Panel — bottom-left, single upper view */}
        {selectedView === 0 && (
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 rounded-lg bg-white/95 p-3 shadow-md min-w-[200px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">Upper Jaw Position</span>
              <button
                type="button"
                onClick={() => setIsUpperSingleMoveMode(v => !v)}
                className={`rounded px-2 py-1 text-xs font-medium ${isUpperSingleMoveMode ? 'bg-[#009ACE] text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                {isUpperSingleMoveMode ? 'ON' : 'OFF'}
              </button>
            </div>
            {isUpperSingleMoveMode && (
              <>
                <div className="text-[11px] text-slate-600 font-mono">
                  {`(${upperSinglePos.map(v => v.toFixed(2)).join(', ')})`}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpperSingle(-jawStep, 0, 0)}>X−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpperSingle(0, 0, jawStep)}>Z+</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpperSingle(jawStep, 0, 0)}>X+</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpperSingle(0, -jawStep, 0)}>Y−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpperSingle(0, 0, -jawStep)}>Z−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpperSingle(0, jawStep, 0)}>Y+</button>
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    className="flex-1 rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                    onClick={() => setUpperSinglePos([0, 0, 0])}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded bg-[#009ACE] text-white px-2 py-1 text-xs hover:bg-[#007aaf]"
                    onClick={copyUpperSingleValues}
                  >
                    Copy Values
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Jaw Position Panel — bottom-left, only in Both view */}
        {selectedView === 2 && (
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 rounded-lg bg-white/95 p-3 shadow-md min-w-[200px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">Jaw Position</span>
              <button
                type="button"
                onClick={() => setIsJawMoveMode(v => !v)}
                className={`rounded px-2 py-1 text-xs font-medium ${isJawMoveMode ? 'bg-[#009ACE] text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                {isJawMoveMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {isJawMoveMode && (
              <>
                {/* Upper jaw */}
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1">Upper Jaw</div>
                <div className="text-[11px] text-slate-600 font-mono">
                  {`(${upperJawPos.map(v => v.toFixed(2)).join(', ')})`}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpper(-jawStep, 0, 0)}>X−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpper(0, 0, jawStep)}>Z+</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpper(jawStep, 0, 0)}>X+</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpper(0, -jawStep, 0)}>Y−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpper(0, 0, -jawStep)}>Z−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeUpper(0, jawStep, 0)}>Y+</button>
                </div>

                {/* Lower jaw */}
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1">Lower Jaw</div>
                <div className="text-[11px] text-slate-600 font-mono">
                  {`(${lowerJawPos.map(v => v.toFixed(2)).join(', ')})`}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeLower(-jawStep, 0, 0)}>X−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeLower(0, 0, jawStep)}>Z+</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeLower(jawStep, 0, 0)}>X+</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeLower(0, -jawStep, 0)}>Y−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeLower(0, 0, -jawStep)}>Z−</button>
                  <button type="button" className="rounded bg-slate-100 px-1.5 py-1 text-xs hover:bg-slate-200" onClick={() => nudgeLower(0, jawStep, 0)}>Y+</button>
                </div>

                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    className="flex-1 rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                    onClick={() => { setUpperJawPos([...DEFAULT_BOTH_UPPER_POS]); setLowerJawPos([...DEFAULT_BOTH_LOWER_POS]); }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded bg-[#009ACE] text-white px-2 py-1 text-xs hover:bg-[#007aaf]"
                    onClick={copyJawValues}
                  >
                    Copy Values
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3D Canvas — renders PLY jaw models based on view and layer states */}
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, -2, 4.5], fov: 40, near: 0.01, far: 1000, up: [0, 1, 0] }}
            gl={{
              antialias: true,
              alpha: true,
              preserveDrawingBuffer: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.85,
            }}
            style={{ touchAction: 'none', background: 'transparent' }}
            dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
          >
            <Suspense fallback={null}>
              <JawModelScene
                selectedView={selectedView}
                layerStates={layerStates}
                isToolActive={isToolActive}
                isPrepQCActive={isPrepQCActive}
                isTrimActive={isTrimActive}
                trimSelectedLayer={trimSelectedLayer}
                monochrome={isMonochromeActive}
                isOcclusogramActive={isOcclusogramActive}
                occlusogramSelectedLayer={occlusogramSelectedLayer}
                isPrepReductionActive={activeTool === 4}
                singleUpperPos={upperSinglePos}
                showToothMarkers={showToothMarkers}
              />
            </Suspense>
          </Canvas>
        </div>

      </div>
    </div>
  );
}