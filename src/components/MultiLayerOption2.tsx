import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock } from "lucide-react";
import CoordinateFullArch from "../imports/CoordinateFullArch";
import UpperJawIcon from "../imports/UpperJawIcon";
import LowerJawIcon from "../imports/LowerJawIcon";
import BothJawsIcon from "../imports/BothJawsIcon";
import CollapseButton from "../imports/CollapseButton";
import { BitesIconsNew, BiteIconWrapper } from "../imports/BitesPanel";

type SliderMode = 'default' | 'hidden' | 'disabled';

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

interface MultiLayerOption2Props {
  onViewChange?: (viewId: number) => void;
  onSliderChange?: (values: {
    upperOpacity: number;
    lowerOpacity: number;
  }) => void;
  onLayerStatesChange?: (layers: {
    pretreatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
    treatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
    additional?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
  }) => void;
  isReviewToolActive?: boolean;
  scannedLayers?: ScannedLayer[];
  isViewTab?: boolean; // Track if we're on the View tab (vs Scan tab)
  simplifiedMode?: boolean; // New prop for simplified display mode
  selectedView?: number; // Current selected view (0=upper, 1=lower, 2=both)
  prepQCMode?: boolean; // When Prep QC tool is active
  prepQCVariant?: 1 | 2 | 3; // Which Prep QC panel variant to show
  trimMode?: boolean; // When Trim tool is active
  onTrimLayerChange?: (layer: 'pre-treatment' | 'treatment') => void;
  occlusogramMode?: boolean; // When Occlusogram tool is active
  onOcclusogramLayerChange?: (layer: 'pre-treatment' | 'treatment' | 'additional') => void;
  onReferenceScanChange?: (scan: 'pre-treatment' | 'additional') => void;
  selectedBiteOptions?: string[]; // Bite options from scan page
  onBiteClick?: (bite: string) => void; // Callback when a bite is clicked
  isDentures?: boolean;
}

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  mode: SliderMode;
  onToggleMode: () => void;
  isLower?: boolean;
  sliderLocked?: boolean; // Slider disabled but eye toggle still works
  inactive?: boolean; // Card not selected — disable slider, show EyeOff in gray
}

function SliderControl({ label, value, onChange, mode, onToggleMode, isLower = false, sliderLocked = false, inactive = false }: SliderControlProps) {
  const isSliderDisabled = mode === 'disabled' || sliderLocked || inactive;
  const displayValue = sliderLocked ? 100 : value;
  return (
    <div className={`flex items-center gap-4 ${
      inactive
        ? 'opacity-40'
        : mode === 'hidden'
        ? 'opacity-65'
        : mode === 'disabled'
        ? 'opacity-40 grayscale'
        : ''
    }`}>
      <div className={`w-8 h-8 text-gray-400 flex-shrink-0 flex items-center justify-center ${sliderLocked && !inactive ? 'opacity-30' : ''}`}>
        <div className={`w-8 h-8 ${isLower ? 'rotate-180' : ''}`}>
          <CoordinateFullArch />
        </div>
      </div>
      <div className={`flex-1 relative ${sliderLocked && !inactive ? 'opacity-30' : ''}`}>
        <input
          type="range"
          min="0"
          max="100"
          value={displayValue}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={isSliderDisabled}
          className={`w-full h-[4px] bg-[#818181] rounded-full appearance-none slider-thumb ${
            isSliderDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          style={{
            background: inactive
              ? '#818181'
              : mode === 'hidden'
              ? `linear-gradient(to right, #00ADEF 0%, #00ADEF ${displayValue}%, #818181 ${displayValue}%, #818181 100%)`
              : sliderLocked
              ? `linear-gradient(to right, #00ADEF 0%, #00ADEF 100%, #818181 100%, #818181 100%)`
              : mode === 'disabled'
              ? '#818181'
              : `linear-gradient(to right, #00ADEF 0%, #00ADEF ${displayValue}%, #818181 ${displayValue}%, #818181 100%)`
          }}
        />
      </div>
      <button
        onClick={inactive ? undefined : onToggleMode}
        disabled={mode === 'disabled' || inactive}
        className={`flex-shrink-0 transition-colors ${
          mode === 'disabled' || inactive
            ? 'cursor-not-allowed'
            : 'hover:opacity-80'
        }`}
        style={{ color: inactive ? '#818181' : '#00ADEF' }}
      >
        {(mode === 'hidden' || inactive) ? (
          <EyeOff className="w-6 h-6" />
        ) : (
          <Eye className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}

// Simplified layer item - no sliders, just label with icon
function SimplifiedLayerItem({ label, icon }: { label: string; icon: 'upper' | 'lower' }) {
  return (
    <div className="flex items-center gap-4 px-[0px] py-[8px]">
      <div className="w-8 h-8 text-gray-400 flex-shrink-0 flex items-center justify-center">
        <div className={`w-8 h-8 ${icon === 'lower' ? 'rotate-180' : ''}`}>
          <CoordinateFullArch />
        </div>
      </div>
      <p className="font-['Roboto',sans-serif] text-[16px] leading-[20px] text-black">
        {label}
      </p>
    </div>
  );
}

// Trim layer item - clickable row with active state
function TrimLayerItem({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex gap-[16px] items-center p-[8px] rounded-[8px] w-full relative transition-colors ${
        isActive ? 'bg-[#dff5fc]' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {isActive && (
        <div className="absolute border-2 border-[#00adef] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
      )}
      <div className="shrink-0 w-[24px] h-[24px]">
        <CoordinateFullArch />
      </div>
      <p className="font-['Roboto',sans-serif] text-[18px] leading-[28px] text-[#3e3d40] text-left" style={{ fontWeight: 400 }}>
        {label}
      </p>
    </button>
  );
}

export function MultiLayerOption2({ onViewChange, onSliderChange, onLayerStatesChange, isReviewToolActive, scannedLayers, isViewTab, simplifiedMode, selectedView, prepQCMode, prepQCVariant = 1, trimMode, onTrimLayerChange, occlusogramMode, onOcclusogramLayerChange, onReferenceScanChange, selectedBiteOptions, onBiteClick, isDentures = false }: MultiLayerOption2Props) {
  // Determine initial view based on scanned layers
  const getInitialView = () => {
    if (!scannedLayers || scannedLayers.length === 0) return 2;
    
    // Check if this is implant-based or crown workflow (has pre-treatment layer)
    const hasPretreatment = scannedLayers.some(layer => layer.type === 'pre-treatment');
    if (hasPretreatment) {
      // For implant-based and crown workflows, start with lower jaw view
      return 1;
    }
    
    return 2; // Default to both jaws
  };

  const [currentView, setCurrentView] = useState(selectedView ?? getInitialView());
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Sync currentView when parent's selectedView prop changes
  useEffect(() => {
    if (selectedView !== undefined && selectedView !== currentView) {
      setCurrentView(selectedView);
    }
  }, [selectedView]);

  // Auto-collapse when on View tab with no scanned layers
  useEffect(() => {
    // If we're on the View tab and no layers are scanned, collapse the panel
    if (isViewTab && (!scannedLayers || scannedLayers.length === 0)) {
      setIsCollapsed(true);
    }
    // When layers are scanned on View tab, expand the panel
    else if (isViewTab && scannedLayers && scannedLayers.length > 0) {
      setIsCollapsed(false);
    }
  }, [isViewTab, scannedLayers?.length]);
  
  // Pre-treatment sliders - all default mode with 50% opacity
  const [pretreatmentUpper1, setPretreatmentUpper1] = useState(50);
  const [pretreatmentLower1, setPretreatmentLower1] = useState(50);
  const [pretreatmentUpper1Mode, setPretreatmentUpper1Mode] = useState<SliderMode>('default');
  const [pretreatmentLower1Mode, setPretreatmentLower1Mode] = useState<SliderMode>('default');
  
  // Emergence profile slider - default mode with 50% opacity
  const [emergenceProfile, setEmergenceProfile] = useState(50);
  const [emergenceProfileMode, setEmergenceProfileMode] = useState<SliderMode>('default');
  
  // Pre-treatment 2 sliders (Treatment scan) - default mode with 50% opacity
  const [pretreatmentUpper2, setPretreatmentUpper2] = useState(50);
  const [pretreatmentLower2, setPretreatmentLower2] = useState(50);
  const [pretreatmentUpper2Mode, setPretreatmentUpper2Mode] = useState<SliderMode>('default');
  const [pretreatmentLower2Mode, setPretreatmentLower2Mode] = useState<SliderMode>('default');

  // Per-layer slider state for dentures (keyed by layer id)
  type LayerSliderState = { upper: number; lower: number; upperMode: SliderMode; lowerMode: SliderMode };
  const [layerSliderStates, setLayerSliderStates] = useState<Record<string, LayerSliderState>>(() => {
    const init: Record<string, LayerSliderState> = {};
    scannedLayers?.forEach(l => {
      init[l.id] = { upper: 100, lower: 100, upperMode: 'default', lowerMode: 'default' };
    });
    return init;
  });

  const getLayerSlider = (id: string): LayerSliderState =>
    layerSliderStates[id] ?? { upper: 100, lower: 100, upperMode: 'default', lowerMode: 'default' };

  const setLayerSlider = (id: string, patch: Partial<LayerSliderState>) => {
    setLayerSliderStates(prev => ({ ...prev, [id]: { ...getLayerSlider(id), ...patch } }));
  };

  // Trim tool - selected layer
  const [selectedTrimLayer, setSelectedTrimLayer] = useState<'pre-treatment' | 'treatment'>('treatment');

  // Occlusogram tool - selected layer
  const [selectedOcclusogramLayer, setSelectedOcclusogramLayer] = useState<'pre-treatment' | 'treatment' | 'additional'>('treatment');

  // Prep QC - selected reference scan
  const [selectedReferenceScan, setSelectedReferenceScan] = useState<'pre-treatment' | 'additional'>('pre-treatment');

  const handleReferenceScanSelect = (scan: 'pre-treatment' | 'additional') => {
    setSelectedReferenceScan(scan);
    if (onReferenceScanChange) onReferenceScanChange(scan);
  };

  // Reset reference scan to pre-treatment when switching to upper jaw (additional scan is lower-only)
  useEffect(() => {
    if (prepQCMode && currentView === 0 && selectedReferenceScan === 'additional') {
      handleReferenceScanSelect('pre-treatment');
    }
  }, [currentView, prepQCMode]);

  // Active bite tracking
  const [activeBite, setActiveBite] = useState<string | null>(null);

  // Map scan page bite names to BitesIconsNew icon names
  const biteToIconName = (bite: string): "Centric Occlusion" | "Left lateral" | "Right lateral" | "Protrusive" | "Retrusive" => {
    const map: Record<string, "Centric Occlusion" | "Left lateral" | "Right lateral" | "Protrusive" | "Retrusive"> = {
      'Centric': 'Centric Occlusion',
      'Additional centric': 'Centric Occlusion',
      'Left lateral': 'Left lateral',
      'Right lateral': 'Right lateral',
      'Protrusive': 'Protrusive',
      'Retrusive': 'Retrusive',
    };
    return map[bite] || 'Centric Occlusion';
  };

  // Check which layers were scanned
  const hasPretreatment = scannedLayers?.some(layer => layer.type === 'pre-treatment');
  const hasTreatment = scannedLayers?.some(layer => layer.type === 'treatment' || layer.label === 'Treatment scan');
  const hasAdditional = scannedLayers?.some(layer => layer.type === 'additional');

  // Check which specific jaws were scanned for each layer
  const pretreatmentLayer = scannedLayers?.find(layer => layer.type === 'pre-treatment');
  const treatmentLayer = scannedLayers?.find(layer => layer.type === 'treatment' || layer.label === 'Treatment scan');
  const additionalLayer = scannedLayers?.find(layer => layer.type === 'additional');

  const pretreatmentHasUpper = pretreatmentLayer?.scannedJaws.upper ?? true;
  const pretreatmentHasLower = pretreatmentLayer?.scannedJaws.lower ?? true;
  const treatmentHasUpper = treatmentLayer?.scannedJaws.upper ?? true;
  const treatmentHasLower = treatmentLayer?.scannedJaws.lower ?? true;
  const additionalHasUpper = additionalLayer?.scannedJaws.upper ?? true;
  const additionalHasLower = additionalLayer?.scannedJaws.lower ?? true;

  // Only show layer sections if at least one jaw was scanned
  const showPretreatment = hasPretreatment && (pretreatmentHasUpper || pretreatmentHasLower);
  const showTreatment = hasTreatment && (treatmentHasUpper || treatmentHasLower);
  const showAdditional = hasAdditional && (additionalHasUpper || additionalHasLower);

  // Notify parent of layer states whenever they change
  useEffect(() => {
    if (onLayerStatesChange) {
      const layerStates: {
        pretreatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
        treatment?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
        additional?: { upper: number; lower: number; upperVisible: boolean; lowerVisible: boolean };
      } = {};

      if (hasPretreatment) {
        layerStates.pretreatment = {
          upper: pretreatmentUpper1,
          lower: pretreatmentLower1,
          upperVisible: pretreatmentUpper1Mode !== 'hidden',
          lowerVisible: pretreatmentLower1Mode !== 'hidden'
        };
      }

      if (hasTreatment) {
        layerStates.treatment = {
          upper: pretreatmentUpper2,
          lower: pretreatmentLower2,
          upperVisible: pretreatmentUpper2Mode !== 'hidden',
          lowerVisible: pretreatmentLower2Mode !== 'hidden'
        };
      }

      if (hasAdditional || prepQCMode) {
        layerStates.additional = {
          upper: emergenceProfile,
          lower: emergenceProfile,
          upperVisible: emergenceProfileMode !== 'hidden',
          lowerVisible: emergenceProfileMode !== 'hidden'
        };
      }

      onLayerStatesChange(layerStates);
    }
  }, [
    pretreatmentUpper1, pretreatmentLower1, pretreatmentUpper1Mode, pretreatmentLower1Mode,
    pretreatmentUpper2, pretreatmentLower2, pretreatmentUpper2Mode, pretreatmentLower2Mode,
    emergenceProfile, emergenceProfileMode,
    hasPretreatment, hasTreatment, hasAdditional, prepQCMode,
    onLayerStatesChange
  ]);

  // Helper to update opacity based on current view and slider values
  const updateOpacity = (upperVal: number, lowerVal: number) => {
    if (onSliderChange) {
      onSliderChange({
        upperOpacity: upperVal / 100,
        lowerOpacity: lowerVal / 100
      });
    }
  };

  // Cycle through modes: default -> hidden -> default
  const cycleMode = (currentMode: SliderMode): SliderMode => {
    if (currentMode === 'default') return 'hidden';
    return 'default';
  };

  const views = [
    { id: 0, placeholder: true },
    { id: 1, placeholder: true },
    { id: 2, placeholder: true },
    { id: 3, isArrow: true }
  ];

  return (
    <motion.div 
      className={`w-fit mx-auto bg-white rounded-[8px] ${!isCollapsed ? 'p-2' : ''} px-[0px] py-[8px]`}
      layout
      transition={{
        layout: { 
          duration: 0.25,
          ease: [0, 0, 1, 1]
        }
      }}
    >
      {/* View Selector */}
      <motion.div 
        className={`flex gap-3 m-[0px] ${!isCollapsed ? 'pb-[8px]' : ''} p-[8px]`}
        style={!isCollapsed ? { borderBottom: '1px solid #d1d1d1' } : { borderColor: 'transparent' }}
        layout
        transition={{
          duration: 0.25,
          ease: [0, 0, 1, 1]
        }}
      >
        <motion.div 
          className="flex gap-3"
          layout
          transition={{
            duration: 0.25,
            ease: [0, 0, 1, 1]
          }}
        >
          {views.slice(0, 3).map((view, index) => (
            <motion.button
              key={view.id}
              onClick={() => {
                setActiveBite(null); // Clear bite selection when jaw is clicked
                setCurrentView(view.id);
                if (onViewChange) onViewChange(view.id);
              }}
              className={`w-[60px] h-[60px] rounded-lg flex items-center justify-center transition-colors ${
                activeBite === null && currentView === view.id
                  ? 'bg-[#dff5fc] border border-[#00adef]'
                  : 'bg-white'
              }`}
              layout
              initial={false}
              transition={{
                duration: 0.25,
                ease: [0, 0, 1, 1]
              }}
            >
              <div className="w-full h-full flex items-center justify-center">
                {view.id === 0 && <UpperJawIcon />}
                {view.id === 1 && <LowerJawIcon />}
                {view.id === 2 && <BothJawsIcon />}
              </div>
            </motion.button>
          ))}
        </motion.div>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-[60px] h-[60px] rounded-r-lg flex items-center justify-center transition-all bg-white hover:bg-gray-50"
          style={{ borderLeft: '1px solid #d1d1d1' }}
        >
          <motion.div 
            className="w-8 h-8 flex items-center justify-center"
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{
              duration: 0.25,
              ease: [0, 0, 1, 1]
            }}
          >
            <CollapseButton />
          </motion.div>
        </button>
      </motion.div>

      {/* Bites Section - Show when bite options exist */}
      <AnimatePresence mode="wait">
        {currentView === 2 && selectedBiteOptions && selectedBiteOptions.length > 0 && !isCollapsed && (
          <motion.div 
            key="bites-section"
            className="relative overflow-hidden" 
            style={{ borderBottom: '1px solid #e0e0e0' }}
            initial={{ 
              opacity: 0, 
              height: 0
            }}
            animate={{ 
              opacity: 1, 
              height: 'auto'
            }}
            exit={{ 
              opacity: 0, 
              height: 0
            }}
            transition={{
              duration: 0.25,
              ease: [0, 0, 1, 1]
            }}
          >
            <motion.div 
              className="content-stretch flex flex-col gap-[2px] items-start p-[8px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.2,
                ease: [0, 0, 1, 1]
              }}
            >
              <p className="font-['Roboto',sans-serif] font-normal leading-[28px] shrink-0 text-[#3e3d40] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Bites
              </p>
              <div className="content-stretch flex gap-[12px] items-center shrink-0">
                {selectedBiteOptions.map((bite, index) => (
                  <motion.button
                    key={bite}
                    onClick={() => {
                      setActiveBite(bite);
                      if (onViewChange) onViewChange(-1);
                      if (onBiteClick) onBiteClick(bite);
                    }}
                    className={`cursor-pointer transition-colors rounded-[8px] h-[60px] min-h-[60px] min-w-[60px] w-[60px] flex items-center justify-center relative ${
                      activeBite === bite ? 'bg-[#dff5fc] border border-[#00adef]' : 'bg-white hover:bg-[#E8F4FA]'
                    }`}
                    title={bite}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.2,
                      ease: [0, 0, 1, 1]
                    }}
                  >
                    <BitesIconsNew
                      className="overflow-clip relative shrink-0 size-[48px]"
                      bite={biteToIconName(bite)}
                      size="48"
                    />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Content - Hidden when a bite is selected (no model to show) */}
      <AnimatePresence mode="wait">
        {!isCollapsed && activeBite === null && (
          <motion.div 
            key="collapsible-content"
            className="pt-[16px] overflow-hidden"
            initial={{ 
              opacity: 0, 
              height: 0
            }}
            animate={{ 
              opacity: 1, 
              height: 'auto'
            }}
            exit={{ 
              opacity: 0, 
              height: 0
            }}
            transition={{
              duration: 0.25,
              ease: [0, 0, 1, 1]
            }}
          >
            {simplifiedMode ? (
              // Simplified mode - only show "Treatment scan" labels without sliders
              <div>
                <div className="space-y-4 px-[8px] py-[0px]">
                  {/* Show upper treatment scan if upper or both jaws selected */}
                  {(currentView === 0 || currentView === 2) && (
                    <SimplifiedLayerItem label="Treatment scan" icon="upper" />
                  )}
                  
                  {/* Show lower treatment scan if lower or both jaws selected */}
                  {(currentView === 1 || currentView === 2) && (
                    <SimplifiedLayerItem label="Treatment scan" icon="lower" />
                  )}
                </div>
              </div>
            ) : trimMode ? (
              // Trim mode - show selectable layer items for Pre-treatment and Treatment scan
              <div className="flex flex-col gap-[16px] p-[8px]">
                {showPretreatment && (
                  <TrimLayerItem
                    label="Pre-treatment"
                    isActive={selectedTrimLayer === 'pre-treatment'}
                    onClick={() => {
                      setSelectedTrimLayer('pre-treatment');
                      if (onTrimLayerChange) onTrimLayerChange('pre-treatment');
                    }}
                  />
                )}
                {showTreatment && (
                  <TrimLayerItem
                    label="Treatment scan"
                    isActive={selectedTrimLayer === 'treatment'}
                    onClick={() => {
                      setSelectedTrimLayer('treatment');
                      if (onTrimLayerChange) onTrimLayerChange('treatment');
                    }}
                  />
                )}
              </div>
            ) : occlusogramMode ? (
              // Occlusogram mode - show selectable layer items (same UI as trim mode)
              <div className="flex flex-col gap-[16px] p-[8px]">
                {showPretreatment && (
                  <TrimLayerItem
                    label="Pre-treatment"
                    isActive={selectedOcclusogramLayer === 'pre-treatment'}
                    onClick={() => {
                      setSelectedOcclusogramLayer('pre-treatment');
                      if (onOcclusogramLayerChange) onOcclusogramLayerChange('pre-treatment');
                    }}
                  />
                )}
                {showTreatment && (
                  <TrimLayerItem
                    label="Treatment scan"
                    isActive={selectedOcclusogramLayer === 'treatment'}
                    onClick={() => {
                      setSelectedOcclusogramLayer('treatment');
                      if (onOcclusogramLayerChange) onOcclusogramLayerChange('treatment');
                    }}
                  />
                )}
                {showAdditional && (
                  <TrimLayerItem
                    label="Additional scan"
                    isActive={selectedOcclusogramLayer === 'additional'}
                    onClick={() => {
                      setSelectedOcclusogramLayer('additional');
                      if (onOcclusogramLayerChange) onOcclusogramLayerChange('additional');
                    }}
                  />
                )}
              </div>
            ) : prepQCMode ? (
              // Prep QC mode — 3 variants controlled by external prepQCVariant prop
              <>
                {/* ── Variant 1: current design (treatment scan + clickable reference cards) ── */}
                {prepQCVariant === 1 && (
                  <>
                    {/* Treatment scan */}
                    {showTreatment && (
                      (currentView === 0 && treatmentHasUpper) ||
                      (currentView === 1 && treatmentHasLower) ||
                      (currentView === 2 && (treatmentHasUpper || treatmentHasLower))
                    ) && (
                      <div className="mb-3 relative rounded-lg p-3 bg-transparent border-2 border-transparent">
                        <h2 className="mb-3">Treatment scan</h2>
                        <div className="space-y-3">
                          {currentView === 0 && treatmentHasUpper && (
                            <SliderControl label="∩" value={pretreatmentUpper2} onChange={(val) => { setPretreatmentUpper2(val); updateOpacity(val, pretreatmentLower2); }} mode={pretreatmentUpper2Mode} onToggleMode={() => setPretreatmentUpper2Mode(cycleMode(pretreatmentUpper2Mode))} isLower={false} />
                          )}
                          {currentView === 1 && treatmentHasLower && (
                            <SliderControl label="∪" value={pretreatmentLower2} onChange={(val) => { setPretreatmentLower2(val); updateOpacity(pretreatmentUpper2, val); }} mode={pretreatmentLower2Mode} onToggleMode={() => setPretreatmentLower2Mode(cycleMode(pretreatmentLower2Mode))} isLower={true} />
                          )}
                          {currentView === 2 && (
                            <>
                              {treatmentHasUpper && (
                                <SliderControl label="∩" value={pretreatmentUpper2} onChange={(val) => { setPretreatmentUpper2(val); updateOpacity(val, pretreatmentLower2); }} mode={pretreatmentUpper2Mode} onToggleMode={() => setPretreatmentUpper2Mode(cycleMode(pretreatmentUpper2Mode))} />
                              )}
                              {treatmentHasLower && (
                                <SliderControl label="∪" value={pretreatmentLower2} onChange={(val) => { setPretreatmentLower2(val); updateOpacity(pretreatmentUpper2, val); }} mode={pretreatmentLower2Mode} onToggleMode={() => setPretreatmentLower2Mode(cycleMode(pretreatmentLower2Mode))} isLower={true} />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mx-3 mb-3" style={{ borderTop: '1px solid #d1d1d1' }} />
                    <div className="px-3 mb-2">
                      <p className="font-['Roboto',sans-serif] text-[14px] leading-[20px] text-[#818181]">Select reference scan</p>
                    </div>
                    {/* Pre-treatment card */}
                    {showPretreatment && (
                      (currentView === 0 && pretreatmentHasUpper) ||
                      (currentView === 1 && pretreatmentHasLower) ||
                      (currentView === 2 && (pretreatmentHasUpper || pretreatmentHasLower))
                    ) && (() => {
                      const isSelected = selectedReferenceScan === 'pre-treatment';
                      return (
                        <div
                          onClick={!isSelected ? () => handleReferenceScanSelect('pre-treatment') : undefined}
                          className={`mx-3 mb-3 rounded-lg border-2 p-3 transition-colors ${isSelected ? 'border-[#00ADEF] bg-[#dff5fc] cursor-default' : 'border-[#d1d1d1] bg-white cursor-pointer hover:bg-gray-50'}`}
                        >
                          <h2 className="mb-3">Pre-treatment</h2>
                          <div className={!isSelected ? 'pointer-events-none' : ''}>
                            {currentView === 0 && pretreatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper1} onChange={(val) => { setPretreatmentUpper1(val); updateOpacity(val, pretreatmentLower1); }} mode={pretreatmentUpper1Mode} onToggleMode={() => setPretreatmentUpper1Mode(cycleMode(pretreatmentUpper1Mode))} isLower={false} inactive={!isSelected} />}
                            {currentView === 1 && pretreatmentHasLower && <SliderControl label="∪" value={pretreatmentLower1} onChange={(val) => { setPretreatmentLower1(val); updateOpacity(pretreatmentUpper1, val); }} mode={pretreatmentLower1Mode} onToggleMode={() => setPretreatmentLower1Mode(cycleMode(pretreatmentLower1Mode))} isLower={true} inactive={!isSelected} />}
                            {currentView === 2 && (
                              <>
                                {pretreatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper1} onChange={(val) => { setPretreatmentUpper1(val); updateOpacity(val, pretreatmentLower1); }} mode={pretreatmentUpper1Mode} onToggleMode={() => setPretreatmentUpper1Mode(cycleMode(pretreatmentUpper1Mode))} inactive={!isSelected} />}
                                {pretreatmentHasLower && <SliderControl label="∪" value={pretreatmentLower1} onChange={(val) => { setPretreatmentLower1(val); updateOpacity(pretreatmentUpper1, val); }} mode={pretreatmentLower1Mode} onToggleMode={() => setPretreatmentLower1Mode(cycleMode(pretreatmentLower1Mode))} isLower={true} inactive={!isSelected} />}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Additional scan card — lower jaw only */}
                    {(currentView === 1 || currentView === 2) && (() => {
                      const isSelected = selectedReferenceScan === 'additional';
                      return (
                        <div
                          onClick={!isSelected ? () => handleReferenceScanSelect('additional') : undefined}
                          className={`mx-3 mb-3 rounded-lg border-2 p-3 transition-colors ${isSelected ? 'border-[#00ADEF] bg-[#dff5fc] cursor-default' : 'border-[#d1d1d1] bg-white cursor-pointer hover:bg-gray-50'}`}
                        >
                          <h2 className="mb-3">Additional scan</h2>
                          <div className={!isSelected ? 'pointer-events-none' : ''}>
                            <SliderControl label="∪" value={emergenceProfile} onChange={setEmergenceProfile} mode={emergenceProfileMode} onToggleMode={() => setEmergenceProfileMode(cycleMode(emergenceProfileMode))} isLower={true} inactive={!isSelected} />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ── Variant 2: same as V1 but reference scan cards have radio buttons ── */}
                {prepQCVariant === 2 && (
                  <>
                    {/* Treatment scan */}
                    {showTreatment && (
                      (currentView === 0 && treatmentHasUpper) ||
                      (currentView === 1 && treatmentHasLower) ||
                      (currentView === 2 && (treatmentHasUpper || treatmentHasLower))
                    ) && (
                      <div className="mb-3 relative rounded-lg p-3 bg-transparent border-2 border-transparent">
                        <h2 className="mb-3">Treatment scan</h2>
                        <div className="space-y-3">
                          {currentView === 0 && treatmentHasUpper && (
                            <SliderControl label="∩" value={pretreatmentUpper2} onChange={(val) => { setPretreatmentUpper2(val); updateOpacity(val, pretreatmentLower2); }} mode={pretreatmentUpper2Mode} onToggleMode={() => setPretreatmentUpper2Mode(cycleMode(pretreatmentUpper2Mode))} isLower={false} />
                          )}
                          {currentView === 1 && treatmentHasLower && (
                            <SliderControl label="∪" value={pretreatmentLower2} onChange={(val) => { setPretreatmentLower2(val); updateOpacity(pretreatmentUpper2, val); }} mode={pretreatmentLower2Mode} onToggleMode={() => setPretreatmentLower2Mode(cycleMode(pretreatmentLower2Mode))} isLower={true} />
                          )}
                          {currentView === 2 && (
                            <>
                              {treatmentHasUpper && (
                                <SliderControl label="∩" value={pretreatmentUpper2} onChange={(val) => { setPretreatmentUpper2(val); updateOpacity(val, pretreatmentLower2); }} mode={pretreatmentUpper2Mode} onToggleMode={() => setPretreatmentUpper2Mode(cycleMode(pretreatmentUpper2Mode))} />
                              )}
                              {treatmentHasLower && (
                                <SliderControl label="∪" value={pretreatmentLower2} onChange={(val) => { setPretreatmentLower2(val); updateOpacity(pretreatmentUpper2, val); }} mode={pretreatmentLower2Mode} onToggleMode={() => setPretreatmentLower2Mode(cycleMode(pretreatmentLower2Mode))} isLower={true} />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mx-3 mb-3" style={{ borderTop: '1px solid #d1d1d1' }} />
                    <div className="px-3 mb-2">
                      <p className="font-['Roboto',sans-serif] text-[14px] leading-[20px] text-[#818181]">Select reference scan</p>
                    </div>
                    {/* Pre-treatment card with radio */}
                    {showPretreatment && (
                      (currentView === 0 && pretreatmentHasUpper) ||
                      (currentView === 1 && pretreatmentHasLower) ||
                      (currentView === 2 && (pretreatmentHasUpper || pretreatmentHasLower))
                    ) && (() => {
                      const isSelected = selectedReferenceScan === 'pre-treatment';
                      return (
                        <div
                          onClick={!isSelected ? () => handleReferenceScanSelect('pre-treatment') : undefined}
                          className={`mx-3 mb-3 rounded-lg border-2 p-3 transition-colors ${isSelected ? 'border-[#00ADEF] bg-[#dff5fc] cursor-default' : 'border-[#d1d1d1] bg-white cursor-pointer hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#00ADEF]' : 'border-[#818181]'}`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[#00ADEF]" />}
                            </div>
                            <h2>Pre-treatment</h2>
                          </div>
                          <div className={!isSelected ? 'pointer-events-none' : ''}>
                            {currentView === 0 && pretreatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper1} onChange={(val) => { setPretreatmentUpper1(val); updateOpacity(val, pretreatmentLower1); }} mode={pretreatmentUpper1Mode} onToggleMode={() => setPretreatmentUpper1Mode(cycleMode(pretreatmentUpper1Mode))} isLower={false} inactive={!isSelected} />}
                            {currentView === 1 && pretreatmentHasLower && <SliderControl label="∪" value={pretreatmentLower1} onChange={(val) => { setPretreatmentLower1(val); updateOpacity(pretreatmentUpper1, val); }} mode={pretreatmentLower1Mode} onToggleMode={() => setPretreatmentLower1Mode(cycleMode(pretreatmentLower1Mode))} isLower={true} inactive={!isSelected} />}
                            {currentView === 2 && (
                              <>
                                {pretreatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper1} onChange={(val) => { setPretreatmentUpper1(val); updateOpacity(val, pretreatmentLower1); }} mode={pretreatmentUpper1Mode} onToggleMode={() => setPretreatmentUpper1Mode(cycleMode(pretreatmentUpper1Mode))} inactive={!isSelected} />}
                                {pretreatmentHasLower && <SliderControl label="∪" value={pretreatmentLower1} onChange={(val) => { setPretreatmentLower1(val); updateOpacity(pretreatmentUpper1, val); }} mode={pretreatmentLower1Mode} onToggleMode={() => setPretreatmentLower1Mode(cycleMode(pretreatmentLower1Mode))} isLower={true} inactive={!isSelected} />}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Additional scan card with radio — lower jaw only */}
                    {(currentView === 1 || currentView === 2) && (() => {
                      const isSelected = selectedReferenceScan === 'additional';
                      return (
                        <div
                          onClick={!isSelected ? () => handleReferenceScanSelect('additional') : undefined}
                          className={`mx-3 mb-3 rounded-lg border-2 p-3 transition-colors ${isSelected ? 'border-[#00ADEF] bg-[#dff5fc] cursor-default' : 'border-[#d1d1d1] bg-white cursor-pointer hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#00ADEF]' : 'border-[#818181]'}`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[#00ADEF]" />}
                            </div>
                            <h2>Additional scan</h2>
                          </div>
                          <div className={!isSelected ? 'pointer-events-none' : ''}>
                            <SliderControl label="∪" value={emergenceProfile} onChange={setEmergenceProfile} mode={emergenceProfileMode} onToggleMode={() => setEmergenceProfileMode(cycleMode(emergenceProfileMode))} isLower={true} inactive={!isSelected} />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ── Variant 3: image design — radio cards at top, plain sliders below ── */}
                {prepQCVariant === 3 && (
                  <>
                    {/* "Compare treatment scan with" label */}
                    <div className="px-3 mb-2">
                      <p className="font-['Roboto',sans-serif] text-[14px] leading-[20px] text-[#818181]">Compare treatment scan with</p>
                    </div>

                    {/* Pre-treatment radio card (label only, no sliders) */}
                    {showPretreatment && (
                      (currentView === 0 && pretreatmentHasUpper) ||
                      (currentView === 1 && pretreatmentHasLower) ||
                      (currentView === 2 && (pretreatmentHasUpper || pretreatmentHasLower))
                    ) && (() => {
                      const isSelected = selectedReferenceScan === 'pre-treatment';
                      return (
                        <div
                          onClick={() => handleReferenceScanSelect('pre-treatment')}
                          className={`mx-3 mb-2 rounded-lg border-2 p-3 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'border-[#00ADEF] bg-[#dff5fc]' : 'border-[#d1d1d1] bg-white hover:bg-gray-50'}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#00ADEF]' : 'border-[#818181]'}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-[#00ADEF]" />}
                          </div>
                          <span className="font-['Roboto',sans-serif] text-[16px] leading-[24px] text-[#3e3d40] font-medium">Pre treatment</span>
                        </div>
                      );
                    })()}

                    {/* Additional scan radio card (label only, no sliders) — lower jaw only */}
                    {(currentView === 1 || currentView === 2) && (() => {
                      const isSelected = selectedReferenceScan === 'additional';
                      return (
                        <div
                          onClick={() => handleReferenceScanSelect('additional')}
                          className={`mx-3 mb-3 rounded-lg border-2 p-3 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'border-[#00ADEF] bg-[#dff5fc]' : 'border-[#d1d1d1] bg-white hover:bg-gray-50'}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#00ADEF]' : 'border-[#818181]'}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-[#00ADEF]" />}
                          </div>
                          <span className="font-['Roboto',sans-serif] text-[16px] leading-[24px] text-[#3e3d40]">Additional scan</span>
                        </div>
                      );
                    })()}

                    {/* Divider */}
                    <div className="mx-3 mb-3" style={{ borderTop: '1px solid #d1d1d1' }} />

                    {/* Treatment scan — plain label + sliders */}
                    {showTreatment && (
                      (currentView === 0 && treatmentHasUpper) ||
                      (currentView === 1 && treatmentHasLower) ||
                      (currentView === 2 && (treatmentHasUpper || treatmentHasLower))
                    ) && (
                      <div className="mb-3 px-3">
                        <h2 className="mb-2">Treatment scan</h2>
                        <div className="space-y-3">
                          {currentView === 0 && treatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper2} onChange={(val) => { setPretreatmentUpper2(val); updateOpacity(val, pretreatmentLower2); }} mode={pretreatmentUpper2Mode} onToggleMode={() => setPretreatmentUpper2Mode(cycleMode(pretreatmentUpper2Mode))} isLower={false} />}
                          {currentView === 1 && treatmentHasLower && <SliderControl label="∪" value={pretreatmentLower2} onChange={(val) => { setPretreatmentLower2(val); updateOpacity(pretreatmentUpper2, val); }} mode={pretreatmentLower2Mode} onToggleMode={() => setPretreatmentLower2Mode(cycleMode(pretreatmentLower2Mode))} isLower={true} />}
                          {currentView === 2 && (
                            <>
                              {treatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper2} onChange={(val) => { setPretreatmentUpper2(val); updateOpacity(val, pretreatmentLower2); }} mode={pretreatmentUpper2Mode} onToggleMode={() => setPretreatmentUpper2Mode(cycleMode(pretreatmentUpper2Mode))} />}
                              {treatmentHasLower && <SliderControl label="∪" value={pretreatmentLower2} onChange={(val) => { setPretreatmentLower2(val); updateOpacity(pretreatmentUpper2, val); }} mode={pretreatmentLower2Mode} onToggleMode={() => setPretreatmentLower2Mode(cycleMode(pretreatmentLower2Mode))} isLower={true} />}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Selected reference scan — plain label + sliders */}
                    {selectedReferenceScan === 'pre-treatment' && showPretreatment && (
                      (currentView === 0 && pretreatmentHasUpper) ||
                      (currentView === 1 && pretreatmentHasLower) ||
                      (currentView === 2 && (pretreatmentHasUpper || pretreatmentHasLower))
                    ) && (
                      <div className="mb-3 px-3">
                        <h2 className="mb-2">Pre-treatment</h2>
                        <div className="space-y-3">
                          {currentView === 0 && pretreatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper1} onChange={(val) => { setPretreatmentUpper1(val); updateOpacity(val, pretreatmentLower1); }} mode={pretreatmentUpper1Mode} onToggleMode={() => setPretreatmentUpper1Mode(cycleMode(pretreatmentUpper1Mode))} isLower={false} />}
                          {currentView === 1 && pretreatmentHasLower && <SliderControl label="∪" value={pretreatmentLower1} onChange={(val) => { setPretreatmentLower1(val); updateOpacity(pretreatmentUpper1, val); }} mode={pretreatmentLower1Mode} onToggleMode={() => setPretreatmentLower1Mode(cycleMode(pretreatmentLower1Mode))} isLower={true} />}
                          {currentView === 2 && (
                            <>
                              {pretreatmentHasUpper && <SliderControl label="∩" value={pretreatmentUpper1} onChange={(val) => { setPretreatmentUpper1(val); updateOpacity(val, pretreatmentLower1); }} mode={pretreatmentUpper1Mode} onToggleMode={() => setPretreatmentUpper1Mode(cycleMode(pretreatmentUpper1Mode))} />}
                              {pretreatmentHasLower && <SliderControl label="∪" value={pretreatmentLower1} onChange={(val) => { setPretreatmentLower1(val); updateOpacity(pretreatmentUpper1, val); }} mode={pretreatmentLower1Mode} onToggleMode={() => setPretreatmentLower1Mode(cycleMode(pretreatmentLower1Mode))} isLower={true} />}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedReferenceScan === 'additional' && (currentView === 1 || currentView === 2) && (
                      <div className="mb-3 px-3">
                        <h2 className="mb-2">Additional scan</h2>
                        <div className="space-y-3">
                          <SliderControl label="∪" value={emergenceProfile} onChange={setEmergenceProfile} mode={emergenceProfileMode} onToggleMode={() => setEmergenceProfileMode(cycleMode(emergenceProfileMode))} isLower={true} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              // Full mode with all sliders and sections
              <>
                {/* Review Tool Active Message */}
                {isReviewToolActive && (
                  <div className="mb-3 p-3 bg-[#FFF4E5] border border-[#FFD68F] rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-[#FF9800] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[13px] text-[#663C00]" style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 500 }}>
                          Review tool active
                        </p>
                        <p className="text-[12px] text-[#996600] mt-1" style={{ fontFamily: "'Roboto', sans-serif" }}>
                          Only the "Emergence profile" layer can be adjusted during review. Pre-treatment and Treatment scan layers are locked.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dentures: render each scanned layer individually */}
                {isDentures && scannedLayers?.filter(l => l.type !== 'bite').map(layer => {
                  const hasUpper = layer.scannedJaws.upper;
                  const hasLower = layer.scannedJaws.lower;
                  const visible = (currentView === 0 && hasUpper) || (currentView === 1 && hasLower) || (currentView === 2 && (hasUpper || hasLower));
                  if (!visible) return null;
                  const s = getLayerSlider(layer.id);
                  return (
                    <div key={layer.id} className="mb-3 rounded-lg p-3 bg-transparent border-2 border-transparent">
                      <h2 className="mb-3">{layer.label}</h2>
                      <div className="space-y-3">
                        {(currentView === 0 || currentView === 2) && hasUpper && (
                          <SliderControl
                            label="∩"
                            value={s.upper}
                            onChange={val => setLayerSlider(layer.id, { upper: val })}
                            mode={s.upperMode}
                            onToggleMode={() => setLayerSlider(layer.id, { upperMode: cycleMode(s.upperMode) })}
                            isLower={false}
                          />
                        )}
                        {(currentView === 1 || currentView === 2) && hasLower && (
                          <SliderControl
                            label="∪"
                            value={s.lower}
                            onChange={val => setLayerSlider(layer.id, { lower: val })}
                            mode={s.lowerMode}
                            onToggleMode={() => setLayerSlider(layer.id, { lowerMode: cycleMode(s.lowerMode) })}
                            isLower={true}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Pre-treatment Section */}
                {!isDentures && showPretreatment && (
                  (currentView === 0 && pretreatmentHasUpper) ||
                  (currentView === 1 && pretreatmentHasLower) ||
                  (currentView === 2 && (pretreatmentHasUpper || pretreatmentHasLower))
                ) && (
                  <div 
                    className={`mb-3 relative rounded-lg p-3 bg-transparent border-2 border-transparent ${
                      isReviewToolActive ? 'pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h2 className={isReviewToolActive ? 'text-gray-400' : ''}>Pre-treatment</h2>
                      {isReviewToolActive && (
                        <div className="flex items-center gap-2 text-[12px] text-gray-500">
                          <Lock className="w-3 h-3" />
                          <span style={{ fontFamily: "'Roboto', sans-serif" }}>Disabled during review</span>
                        </div>
                      )}
                    </div>
                    <div 
                      className={`space-y-3 ${isReviewToolActive ? 'opacity-40 grayscale' : ''}`}
                    >
                      {/* Upper Jaw View - Show only upper slider */}
                      {currentView === 0 && pretreatmentHasUpper && (
                        <SliderControl
                          label="∩"
                          value={pretreatmentUpper1}
                          onChange={(val) => {
                            setPretreatmentUpper1(val);
                            updateOpacity(val, pretreatmentLower1);
                          }}
                          mode={pretreatmentUpper1Mode}
                          onToggleMode={() => {
                            const newMode = cycleMode(pretreatmentUpper1Mode);
                            setPretreatmentUpper1Mode(newMode);
                          }}
                          isLower={false}
                        />
                      )}
                      
                      {/* Lower Jaw View - Show only lower slider */}
                      {currentView === 1 && pretreatmentHasLower && (
                        <SliderControl
                          label="∪"
                          value={pretreatmentLower1}
                          onChange={(val) => {
                            setPretreatmentLower1(val);
                            updateOpacity(pretreatmentUpper1, val);
                          }}
                          mode={pretreatmentLower1Mode}
                          onToggleMode={() => {
                            const newMode = cycleMode(pretreatmentLower1Mode);
                            setPretreatmentLower1Mode(newMode);
                          }}
                          isLower={true}
                        />
                      )}
                      
                      {/* Both Jaws View - Show both sliders */}
                      {currentView === 2 && (
                        <>
                          {pretreatmentHasUpper && (
                            <SliderControl
                              label="∩"
                              value={pretreatmentUpper1}
                              onChange={(val) => {
                                setPretreatmentUpper1(val);
                                updateOpacity(val, pretreatmentLower1);
                              }}
                              mode={pretreatmentUpper1Mode}
                              onToggleMode={() => {
                                const newMode = cycleMode(pretreatmentUpper1Mode);
                                setPretreatmentUpper1Mode(newMode);
                              }}
                            />
                          )}
                          {pretreatmentHasLower && (
                            <SliderControl
                              label="∪"
                              value={pretreatmentLower1}
                              onChange={(val) => {
                                setPretreatmentLower1(val);
                                updateOpacity(pretreatmentUpper1, val);
                              }}
                              mode={pretreatmentLower1Mode}
                              onToggleMode={() => {
                                const newMode = cycleMode(pretreatmentLower1Mode);
                                setPretreatmentLower1Mode(newMode);
                              }}
                              isLower={true}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Treatment Scan Section */}
                {!isDentures && showTreatment && (
                  (currentView === 0 && treatmentHasUpper) ||
                  (currentView === 1 && treatmentHasLower) ||
                  (currentView === 2 && (treatmentHasUpper || treatmentHasLower))
                ) && (
                  <div 
                    className={`mb-3 relative rounded-lg p-3 bg-transparent border-2 border-transparent ${
                      isReviewToolActive ? 'pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h2 className={isReviewToolActive ? 'text-gray-400' : ''}>Treatment scan</h2>
                      {isReviewToolActive && (
                        <div className="flex items-center gap-2 text-[12px] text-gray-500">
                          <Lock className="w-3 h-3" />
                          <span style={{ fontFamily: "'Roboto', sans-serif" }}>Disabled during review</span>
                        </div>
                      )}
                    </div>
                    <div 
                      className={`space-y-3 ${isReviewToolActive ? 'opacity-40 grayscale' : ''}`}
                    >
                      {/* Upper Jaw View - Show only upper slider */}
                      {currentView === 0 && treatmentHasUpper && (
                        <SliderControl
                          label="∩"
                          value={pretreatmentUpper2}
                          onChange={(val) => {
                            setPretreatmentUpper2(val);
                            updateOpacity(val, pretreatmentLower2);
                          }}
                          mode={pretreatmentUpper2Mode}
                          onToggleMode={() => {
                            const newMode = cycleMode(pretreatmentUpper2Mode);
                            setPretreatmentUpper2Mode(newMode);
                          }}
                          isLower={false}
                        />
                      )}
                      
                      {/* Lower Jaw View - Show only lower slider */}
                      {currentView === 1 && treatmentHasLower && (
                        <SliderControl
                          label="∪"
                          value={pretreatmentLower2}
                          onChange={(val) => {
                            setPretreatmentLower2(val);
                            updateOpacity(pretreatmentUpper2, val);
                          }}
                          mode={pretreatmentLower2Mode}
                          onToggleMode={() => {
                            const newMode = cycleMode(pretreatmentLower2Mode);
                            setPretreatmentLower2Mode(newMode);
                          }}
                          isLower={true}
                        />
                      )}
                      
                      {/* Both Jaws View - Show only lower slider */}
                      {currentView === 2 && (
                        <>
                          {treatmentHasUpper && (
                            <SliderControl
                              label="∩"
                              value={pretreatmentUpper2}
                              onChange={(val) => {
                                setPretreatmentUpper2(val);
                                updateOpacity(val, pretreatmentLower2);
                              }}
                              mode={pretreatmentUpper2Mode}
                              onToggleMode={() => {
                                const newMode = cycleMode(pretreatmentUpper2Mode);
                                setPretreatmentUpper2Mode(newMode);
                              }}
                            />
                          )}
                          {treatmentHasLower && (
                            <SliderControl
                              label="∪"
                              value={pretreatmentLower2}
                              onChange={(val) => {
                                setPretreatmentLower2(val);
                                updateOpacity(pretreatmentUpper2, val);
                              }}
                              mode={pretreatmentLower2Mode}
                              onToggleMode={() => {
                                const newMode = cycleMode(pretreatmentLower2Mode);
                                setPretreatmentLower2Mode(newMode);
                              }}
                              isLower={true}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Additional Scan Section */}
                {!isDentures && showAdditional && (
                  (currentView === 0 && additionalHasUpper) ||
                  (currentView === 1 && additionalHasLower) ||
                  (currentView === 2 && (additionalHasUpper || additionalHasLower))
                ) && (
                  <div 
                    className="rounded-lg p-3 bg-transparent border-2 border-transparent"
                  >
                    <h2 className="mb-3">{additionalLayer?.label || "Emergence profile"}</h2>
                    <div className="space-y-3">
                      {/* Upper Jaw View - Show only upper slider */}
                      {currentView === 0 && additionalHasUpper && (
                        <SliderControl
                          label="∩"
                          value={emergenceProfile}
                          onChange={setEmergenceProfile}
                          mode={emergenceProfileMode}
                          onToggleMode={() => {
                            const newMode = cycleMode(emergenceProfileMode);
                            setEmergenceProfileMode(newMode);
                          }}
                          isLower={false}
                        />
                      )}
                      
                      {/* Lower Jaw View - Show only lower slider */}
                      {currentView === 1 && additionalHasLower && (
                        <SliderControl
                          label="∪"
                          value={emergenceProfile}
                          onChange={setEmergenceProfile}
                          mode={emergenceProfileMode}
                          onToggleMode={() => {
                            const newMode = cycleMode(emergenceProfileMode);
                            setEmergenceProfileMode(newMode);
                          }}
                          isLower={true}
                        />
                      )}
                      
                      {/* Both Jaws View - Show upper slider */}
                      {currentView === 2 && (
                        <>
                          {additionalHasUpper && (
                            <SliderControl
                              label="∩"
                              value={emergenceProfile}
                              onChange={setEmergenceProfile}
                              mode={emergenceProfileMode}
                              onToggleMode={() => {
                                const newMode = cycleMode(emergenceProfileMode);
                                setEmergenceProfileMode(newMode);
                              }}
                            />
                          )}
                          {additionalHasLower && (
                            <SliderControl
                              label="∪"
                              value={emergenceProfile}
                              onChange={setEmergenceProfile}
                              mode={emergenceProfileMode}
                              onToggleMode={() => {
                                const newMode = cycleMode(emergenceProfileMode);
                                setEmergenceProfileMode(newMode);
                              }}
                              isLower={true}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #00ADEF;
          box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
        }

        .slider-thumb::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #00ADEF;
          box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
        }
      `}</style>
    </motion.div>
  );
}