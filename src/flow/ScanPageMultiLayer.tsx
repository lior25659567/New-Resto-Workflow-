import Component3EModel from "../imports/3EModel-3004-1971";
import Component3EModelLower from "../imports/3EModel-3010-27";
import UpperModel from "../imports/UpperModel";
import LowerModel from "../imports/LowerModel";
import BiteModel from "../imports/BiteModel";
import Group562921 from "../imports/Group562921";
import Rectangle22322 from "../imports/Rectangle22322";
import Header from "../components/Header";
import { ChromeTabs } from "../components/ChromeTabs";
import { ToolbarScan } from "../components/ToolbarScan";
import UiJawUpper from "../imports/UiJawUpper";
import UiJawLower from "../imports/UiJawLower";
import UiJawBoth from "../imports/UiJawBoth";
import { BiteToolbarContainer } from "../components/BiteToolbarContainer";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import Component3DModelMary from "../imports/3DModelMary";
import MoveToPretreatmentModal from "../components/MoveToPretreatmentModal";
import PrepEditPanel from "../imports/Frame1618872979";
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useUndoHistory } from "../hooks/useUndoHistory";
import UndoFilmstripChip from "../components/UndoFilmstripChip";
import UndoBorderlessChip from "../components/UndoBorderlessChip";
import UndoCompactBar from "../components/UndoCompactBar";
import UndoLabeledList from "../components/UndoLabeledList";
import UndoPill from "../components/UndoPill";
import UndoIconsOnly from "../components/UndoIconsOnly";
import UndoStacked from "../components/UndoStacked";
import UndoHorizontalStacked from "../components/UndoHorizontalStacked";
import UndoLabeledChip from "../components/UndoLabeledChip";
import ScanGuidanceViewer from "../components/scan-guidance/ScanGuidanceViewer";
import PrepCopilotExperience from "../components/prep-copilot/PrepCopilotExperience";
import JawPlyViewer from "../components/jaw-viewer/JawPlyViewer";
import { UndoToast, useUndoToast } from "../components/UndoToast";
import imgEmergenceProfile from "figma:asset/59c5249493a5cf8767547ab4edc771958cf79908.png";
import imgScanWand from "figma:asset/6aa095904da22b160466272b62feb75140332534.png";
import implantUpperArchScan from "figma:asset/0739b756c08b73712f33f02a9c7bb00b11f87b89.png";
import implantLowerArchScan from "figma:asset/64cb500b2db813f97ee598c6ffdd80d6f5d5a1d5.png";
import implantTreatmentLowerScan from "figma:asset/646c1588e84153ab0f3a58f0c955f83f7d95b3b0.png";
import implantAdditionalLowerScan from "figma:asset/53d8f75306714da38cdb9f7814d0f84af89ca544.png";
import crownPreTreatmentUpperScan from "figma:asset/1a5bcf3da0e5c9324eb0e6ccf78bc69843e5e88e.png";
import crownPreTreatmentLowerScan from "figma:asset/febe43c81aeab5ab275db2c6ae589381ee1f8f33.png";
import crownTreatmentLowerScan from "figma:asset/24c58f3ce671456a5911284503eff6df6b81e11e.png";
const crownUpperArchScan = "https://images.unsplash.com/photo-1650739353152-5488298a9d38?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZW50YWwlMjBjcm93biUyMHVwcGVyJTIwdGVldGglMjBzY2FufGVufDF8fHx8MTc3MDczMjIwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const crownLowerArchScan = "https://images.unsplash.com/photo-1687810953487-7b92e3f7df85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZW50YWwlMjBjcm93biUyMGxvd2VyJTIwdGVldGglMjBzY2FufGVufDF8fHx8MTc3MDczMjIwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

function solidColor(bg: string): string {
  if (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) {
    const m = bg.match(/#[0-9a-fA-F]{6}/);
    return m ? m[0] : '#E0EDF4';
  }
  return bg;
}

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  chartNumber: string;
}

interface ScanPageMultiLayerProps {
  patient: Patient | null;
  onBack: () => void;
  onHome: () => void;
  onNavigateToMultiLayer?: () => void;
  onNavigateToView?: () => void;
  onNavigateToRx?: () => void;
  onNavigateToSummary?: () => void;
  scanType?: string;
  onScannedLayersChange?: (layers: Array<{
    id: string;
    label: string;
    type: "treatment" | "bite" | "pre-treatment" | "additional";
    scannedJaws: {
      upper: boolean;
      lower: boolean;
      bite: boolean;
    };
  }>) => void;
  onWorkflowChange?: (workflow: string) => void;
  onBiteOptionsChange?: (biteOptions: string[]) => void;
  toothTreatments?: { [tooth: string]: string };
  preTreatmentEnabled?: boolean;
  /** When true, shows the interactive 3D scan guidance (Full Ghost + Arrow) in the center instead of flat images */
  enableScanGuidance?: boolean;
  /** Custom canvas background color (default: #E0EDF4) */
  canvasBg?: string;
  /** Callback when canvas background changes from settings */
  onCanvasBgChange?: (color: string) => void;
  /** When true, hides the Lumina Wand and workflow selector (entered from canvas theme page) */
  isCanvasThemeMode?: boolean;
}

export default function ScanPageMultiLayer({ patient, onBack, onHome, onNavigateToMultiLayer, onNavigateToView, onNavigateToRx, onNavigateToSummary, scanType, onScannedLayersChange, onWorkflowChange, onBiteOptionsChange, toothTreatments, preTreatmentEnabled, enableScanGuidance, canvasBg = '#E0EDF4', onCanvasBgChange, isCanvasThemeMode = false }: ScanPageMultiLayerProps) {
  type WorkflowType = "fixed-restorative" | "implant-based" | "dentures" | "crown";
  const [workflow, setWorkflow] = useState<WorkflowType>(() => {
    // First, check toothTreatments to determine workflow based on assigned treatments
    if (toothTreatments && Object.keys(toothTreatments).length > 0) {
      const treatments = Object.values(toothTreatments);
      
      // Count treatment types to determine primary workflow
      const crownCount = treatments.filter(t => t === "Crown").length;
      const implantCount = treatments.filter(t => t === "Implant based").length;
      
      // If only Crown treatments exist, use crown workflow
      if (crownCount > 0 && implantCount === 0) return "crown";
      
      // If only Implant treatments exist, use implant-based workflow
      if (implantCount > 0 && crownCount === 0) return "implant-based";
      
      // If both exist, prioritize based on majority
      if (crownCount > 0 && implantCount > 0) {
        return crownCount >= implantCount ? "crown" : "implant-based";
      }
    }
    // Fallback: set initial workflow based on scanType
    if (scanType === 'implantPlanning') return "implant-based";
    if (scanType === 'dentures') return "dentures";
    return "crown";
  });
  const [biteOptionsVisible, setBiteOptionsVisible] = useState(false);
  const [hasStudyModelAdditionalBite, setHasStudyModelAdditionalBite] = useState(false);
  
  // Chrome Tabs State
  const [tabs, setTabs] = useState([
    { id: "treatment-scan", label: "Treatment scan", type: "treatment" as const }
  ]);
  const [activeTabId, setActiveTabId] = useState("treatment-scan");
  const [selectedBiteOptions, setSelectedBiteOptions] = useState<string[]>([]);
  const [activeBiteOptions, setActiveBiteOptions] = useState<string[]>([]);
  
  // Scanning animation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedTabs, setScannedTabs] = useState<Set<string>>(new Set());

  // Scan guidance viewer reset counter, active mode and lock state
  const [guidanceResetCounter, setGuidanceResetCounter] = useState(0);
  const [lockModel, setLockModel] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [ghostMain, setGhostMain] = useState(false);
  const [syncMain, setSyncMain] = useState(false);

  // Controls panel drag + collapse state
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Initialise panel position (bottom-left) after first render
  useLayoutEffect(() => {
    if (panelPos === null) {
      setPanelPos({ x: 16, y: window.innerHeight - 80 });
    }
  }, [panelPos]);

  const onPanelDragStart = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    e.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const onMove = (mv: MouseEvent) => {
      if (!dragState.current) return;
      const dx = mv.clientX - dragState.current.startX;
      const dy = mv.clientY - dragState.current.startY;
      setPanelPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);
  const [guidanceMode, setGuidanceMode] = useState<
    'fagwand-tilt3d' | 'fagwand-spin3d' | 'fagwand-nod3d' | 'fagwand-sweep3d' | 'fagwand-rock3d' | 'fagwand-tumble3d' | 'fagwand-wobble3d' | 'smart-nav'
  >('fagwand-tilt3d');
  
  // Jaw scanning state - track which jaw is being viewed/scanned
  const [currentJaw, setCurrentJaw] = useState<'upper' | 'lower' | 'bite' | null>(null);

  // Per-tab jaw scanned states: tracks which jaws have been scanned for each tab
  const [tabJawStates, setTabJawStates] = useState<Record<string, { upper: boolean; lower: boolean; bite: boolean }>>({});
  
  // Track which layer contains the reference bite (first bite scanned becomes the reference)
  const [referenceBiteLayerId, setReferenceBiteLayerId] = useState<string | null>(null);
  
  // Toast for bite layer navigation
  const biteLayerToast = useUndoToast();
  
  // Helper to get jaw state for a tab
  const getTabJawState = (tabId: string) => tabJawStates[tabId] || { upper: false, lower: false, bite: false };
  
  // Helper to set a specific jaw as scanned for a tab
  const setTabJawScanned = (tabId: string, jaw: 'upper' | 'lower' | 'bite') => {
    setTabJawStates(prev => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] || { upper: false, lower: false, bite: false }),
        [jaw]: true
      }
    }));
  };
  
  // Helper to check if any jaw has been scanned for a tab
  const hasAnyJawScanned = (tabId: string) => {
    const state = getTabJawState(tabId);
    return state.upper || state.lower || state.bite;
  };

  // Move to pre-treatment modal state
  const [showMoveToPretreatmentModal, setShowMoveToPretreatmentModal] = useState(false);
  const [pendingPreTreatmentTabId, setPendingPreTreatmentTabId] = useState<string | null>(null);
  // Use a ref to ensure the pending ID is always available in handlers (avoids stale closure)
  const pendingPreTreatmentTabIdRef = useRef<string | null>(null);

  // Prep Edit panel state - controlled by ToolbarScan
  const [isPrepEditOpen, setIsPrepEditOpen] = useState(false);

  // Prep Copilot state - controlled by ToolbarScan
  const [isCopilotActive, setIsCopilotActive] = useState(false);
  // Toolbar collapsed state — passed to Copilot panel for positioning
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(true);

  // Track whether any toolbar tool is active (to hide workflow selector + rectangle)
  const [isAnyToolActive, setIsAnyToolActive] = useState(false);
  // Monochrome mode (stone view) - controlled by ToolbarScan
  const [isMonochrome, setIsMonochrome] = useState(false);

  const [showToothMarkers, setShowToothMarkers] = useState(false);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 't' && !e.repeat) setShowToothMarkers(v => !v); };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, []);

  // Undo panel open state (panels render here at bottom-left, ToolbarScan controls open/close)
  const [isUndoPanelOpen, setIsUndoPanelOpen] = useState(false);
  const undoPanelCloseRef = useRef<(() => void) | null>(null);
  const isRestoringRef = useRef(false);

  // Visual reveal step for undo/redo 3D clipping effect (1-10, 10 = full model)
  const [revealStep, setRevealStep] = useState(10);
  // Keeps the accepted undo preview visible after the panel closes
  const [hasAppliedUndoState, setHasAppliedUndoState] = useState(false);

  // Undo history
  const undoHistory = useUndoHistory();
  // Which undo UI variant: 1=ActionBar, 2=Timeline, 3=DirectToast, 4=List, 5=Filmstrip, 6=3DFilm
  const [undoVariant, setUndoVariant] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9>(1);
  // Undo panel position: 'left-bottom', 'center-bottom', 'under-toolbar'
  type UndoPosition = 'left-bottom' | 'center-bottom' | 'under-toolbar';
  const [undoPosition, setUndoPosition] = useState<UndoPosition>('left-bottom');
  // Switcher panel visibility (toggle with 'E' key)
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(true);
  // Draggable switcher position
  const [switcherDragPos, setSwitcherDragPos] = useState<{ x: number; y: number } | null>(null);
  const switcherDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Define tab configurations for each workflow
  const workflowTabConfigs: Record<WorkflowType, Array<{ id: string; label: string; type: "treatment" | "bite" | "pre-treatment" | "additional" }>> = {
    "fixed-restorative": [
      { id: "treatment-scan", label: "Treatment scan", type: "treatment" }
    ],
    "implant-based": [
      { id: "treatment-scan", label: "Treatment scan", type: "treatment" }
    ],
    "dentures": [
      { id: "soft-tissue", label: "Soft tissue", type: "treatment" }
    ],
    "crown": [
      { id: "crown-treatment-scan", label: "Treatment scan", type: "treatment" }
    ]
  };

  // Update tabs when workflow changes
  useEffect(() => {
    const newTabs = workflowTabConfigs[workflow];
    setTabs(newTabs);
    setActiveTabId(newTabs[0].id);
    // Reset bite options when changing workflow
    setSelectedBiteOptions([]);
    setActiveBiteOptions([]);
    setHasStudyModelAdditionalBite(false);
    // Reset scanned tabs when workflow changes
    setScannedTabs(new Set());
    // Reset jaw scanning state
    setCurrentJaw(null);
    setTabJawStates({});
    setGuidanceResetCounter(c => c + 1);
    setHasAppliedUndoState(false);
    undoHistory.reset();
  }, [workflow]);

  // 'E' key toggles the undo switcher visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        setIsSwitcherVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync auto-detected workflow back to parent (e.g. when detected from toothTreatments on mount)
  useEffect(() => {
    const workflowToScanType: Record<WorkflowType, string> = {
      "crown": "crown",
      "implant-based": "implantPlanning",
      "dentures": "dentures",
      "fixed-restorative": "fixed-restorative",
    };
    onWorkflowChange?.(workflowToScanType[workflow]);
  }, [workflow, onWorkflowChange]);

  // Auto-add pre-treatment tab when preTreatmentEnabled was toggled on in the Rx phase
  const hasAutoAddedPreTreatment = useRef(false);
  useEffect(() => {
    if (preTreatmentEnabled && !hasAutoAddedPreTreatment.current) {
      // Check if a pre-treatment tab already exists
      const alreadyHasPreTreatment = tabs.some(tab => tab.type === 'pre-treatment');
      if (!alreadyHasPreTreatment) {
        const pretreatmentId = `pre-treatment-auto-${Date.now()}`;
        const newTab = {
          id: pretreatmentId,
          label: "Pre-treatment",
          type: "pre-treatment" as const
        };
        setTabs(prevTabs => [newTab, ...prevTabs]);
        setActiveTabId(pretreatmentId);
        setCurrentJaw('upper');
        hasAutoAddedPreTreatment.current = true;
      }
    }
  }, [preTreatmentEnabled]);

  const handleAddTab = (scanType: "Pre-treatment" | "Additional scan" | "Reference scan" | "Copy denture" | "Emergence profile" | "Treatment scan") => {
    // Check if adding pre-treatment when treatment scan has any scanned jaws (for crown and implant workflows)
    if (scanType === "Pre-treatment" && (workflow === "crown" || workflow === "implant-based")) {
      // Find the initial treatment scan tab that has any jaw scanned
      const treatmentScanTab = tabs.find(tab => 
        tab.type === "treatment" && 
        (tab.id === "crown-treatment-scan" || tab.id === "treatment-scan") &&
        hasAnyJawScanned(tab.id)
      );
      
      // If treatment scan exists and has any jaw scanned, show the modal
      if (treatmentScanTab) {
        const newId = `${scanType.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        setPendingPreTreatmentTabId(newId);
        pendingPreTreatmentTabIdRef.current = newId;
        setShowMoveToPretreatmentModal(true);
        return;
      }
    }
    
    const newId = `${scanType.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    // Determine the type based on scan type
    let tabType: "treatment" | "bite" | "pre-treatment" | "additional";
    if (scanType === "Pre-treatment") {
      tabType = "pre-treatment";
    } else if (scanType === "Treatment scan") {
      tabType = "treatment";
    } else if (scanType === "Reference scan" || scanType === "Copy denture" || scanType === "Emergence profile") {
      tabType = "treatment";
    } else {
      tabType = "additional";
    }
    
    // Set the label - auto-number additional scans
    let label: string;
    if (scanType === "Additional scan" && workflow === "implant-based") {
      label = "Emergence profile";
    } else if (scanType === "Additional scan") {
      const existingAdditionalCount = tabs.filter(t => t.type === "additional").length;
      label = existingAdditionalCount >= 1 ? `Additional scan (${existingAdditionalCount})` : "Additional scan";
    } else {
      label = scanType;
    }
    
    const newTab = {
      id: newId,
      label: label,
      type: tabType
    };
    
    // Pre-treatment and Reference scan always go first
    if (scanType === "Pre-treatment" || scanType === "Reference scan") {
      setTabs([newTab, ...tabs]);
    } 
    // Treatment scan goes after Pre-treatment but before Emergence profile
    else if (scanType === "Treatment scan") {
      const preTreatmentIndex = tabs.findIndex(tab => tab.type === "pre-treatment");
      if (preTreatmentIndex !== -1) {
        // Insert right after pre-treatment
        const newTabs = [...tabs];
        newTabs.splice(preTreatmentIndex + 1, 0, newTab);
        setTabs(newTabs);
      } else {
        // If no pre-treatment, add at the beginning
        setTabs([newTab, ...tabs]);
      }
    }
    // Emergence profile goes between Treatment scan and Additional scans
    else if (scanType === "Emergence profile") {
      // Find the index of the first treatment scan (usually the original "Treatment scan")
      const firstTreatmentIndex = tabs.findIndex(tab => 
        tab.type === "treatment" && (tab.id === "treatment-scan" || tab.id === "soft-tissue" || tab.label === "Treatment scan")
      );
      
      if (firstTreatmentIndex !== -1) {
        // Insert after the treatment scan
        const newTabs = [...tabs];
        newTabs.splice(firstTreatmentIndex + 1, 0, newTab);
        setTabs(newTabs);
      } else {
        // If no treatment scan found, add at the end
        setTabs([...tabs, newTab]);
      }
    } 
    // Additional scans go at the end
    else {
      setTabs([...tabs, newTab]);
    }
    
    undoHistory.push(
      { tabJawStates, scannedTabs: [...scannedTabs], activeTabId, tabs, currentJaw },
      `Added "${label}" tab`
    );

    // Auto-select the new tab
    setActiveTabId(newId);

    // Reset jaw scanning state for pre-treatment tabs
    if (scanType === "Pre-treatment") {
      setCurrentJaw(null);
    }
  };

  const handleBiteOptionClick = (option: string) => {
    // Check if we already have a reference bite layer (first layer where bite was scanned)
    if (referenceBiteLayerId && referenceBiteLayerId !== activeTabId) {
      // Find the reference layer that contains the bite
      const referenceTab = tabs.find(tab => tab.id === referenceBiteLayerId);
      
      if (referenceTab) {
        // Verify the reference tab actually has a bite scan
        const referenceBiteState = getTabJawState(referenceBiteLayerId);
        
        if (referenceBiteState.bite) {
          // Switch to the reference bite layer
          setActiveTabId(referenceBiteLayerId);
          setCurrentJaw('bite');
          setActiveBiteOptions([option]);
          
          // Show Ogilvy-style toast: benefit-focused, clear, specific
          // Promise: "Navigate instantly to your bite scan" 
          // Proof: Shows which layer contains the bite
          // News: Uses action language that conveys completion
          biteLayerToast.show(
            `Bite found in ${referenceTab.label} — switched automatically`
          );
          
          return;
        } else {
          // Reference layer lost its bite scan - reset reference
          setReferenceBiteLayerId(null);
        }
      } else {
        // Reference tab no longer exists - reset reference
        setReferenceBiteLayerId(null);
      }
    }
    
    // Normal bite selection behavior
    setCurrentJaw('bite');
    setIsScanning(false);
    setScanProgress(0);
    
    setActiveBiteOptions(prev => 
      prev.includes(option) 
        ? [] // Deselect if clicking the currently active one
        : [option] // Select only this one (radio button behavior)
    );
    
    // When a bite is clicked in the toolbar, switch to pre-treatment tab
    const preTreatmentTab = tabs.find(tab => tab.type === 'pre-treatment');
    if (preTreatmentTab) {
      setActiveTabId(preTreatmentTab.id);
    }
  };

  // Toggle bite selection and auto-switch to pre-treatment tab
  const handleBiteToggle = (bite: string) => {
    // Toggle the bite in selectedBiteOptions
    setSelectedBiteOptions(prev => {
      if (prev.includes(bite)) {
        return prev.filter(b => b !== bite);
      } else {
        return [...prev, bite];
      }
    });
    
    // Auto-switch to pre-treatment tab
    const preTreatmentTab = tabs.find(tab => tab.type === 'pre-treatment');
    if (preTreatmentTab) {
      setActiveTabId(preTreatmentTab.id);
    }
  };

  // Convert bite option key to display name
  const getBiteDisplayName = (biteKey: string) => {
    const biteNameMap: Record<string, string> = {
      'Centric': 'Centric',
      'centric': 'Centric',
      'Left lateral': 'Left lateral',
      'left-lateral': 'Left lateral',
      'Right lateral': 'Right lateral',
      'right-lateral': 'Right lateral',
      'Additional centric': 'Additional centric',
      'additional-centric': 'Additional centric',
      'Protrusive': 'Protrusive',
      'protrusive': 'Protrusive',
      'Retrusive': 'Retrusive',
      'retrusive': 'Retrusive',
    };
    return biteNameMap[biteKey] || biteKey;
  };
  
  // Set default jaw view when a tab becomes active (NO auto-scanning)
  // Scanning only starts when user clicks on an arch
  useEffect(() => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab || activeTab.type === 'bite') return;
    
    // Don't change jaw view if this tab already has any jaw scanned - preserve user's last view
    if (hasAnyJawScanned(activeTabId)) return;
    
    // Just set the default view jaw - NO scanning
    if (activeTab.type === 'additional' || activeTab.label === 'Emergence profile') {
      setCurrentJaw(workflow === 'implant-based' ? 'lower' : 'upper');
    } else {
      // Default to upper jaw view for treatment, pre-treatment, etc.
      setCurrentJaw('upper');
    }
    // Stop any ongoing scanning when switching tabs
    setIsScanning(false);
    setScanProgress(0);
  }, [activeTabId, tabs, workflow]);
  
  // Universal jaw click handler - NOW ONLY FOR VIEWING, NOT SCANNING
  const handleJawClick = (jaw: 'upper' | 'lower' | 'bite') => {
    // Only allow switching to the clicked jaw view - NO SCANNING
    setCurrentJaw(jaw);
  };
  
  // Handler for the wand button - initiates scanning for current jaw
  const handleWandScan = () => {
    if (!currentJaw) return; // Need a jaw selected first
    if (isScanning) return; // Already scanning
    
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;
    
    const jawState = getTabJawState(activeTabId);
    const isLeftLateralActive = activeBiteOptions.includes('Left lateral');
    
    // For bite/both view: scan directly like upper/lower
    if (currentJaw === 'bite') {
      if (!jawState.bite) {
        setHasAppliedUndoState(false);
        setIsScanning(true);
        setScanProgress(0);
      }
      return;
    }
    
    // For upper/lower jaw
    // Left lateral allows re-scanning
    if (isLeftLateralActive && activeTab.type === 'pre-treatment') {
      setHasAppliedUndoState(false);
      setIsScanning(true);
      setScanProgress(0);
      return;
    }
    
    // Start scanning if this jaw hasn't been scanned yet for this tab
    if (!jawState[currentJaw]) {
      setHasAppliedUndoState(false);
      setIsScanning(true);
      setScanProgress(0);
    }
  };
  
  const handleUpperJawClick = () => handleJawClick('upper');
  const handleLowerJawClick = () => handleJawClick('lower');
  const handleBiteClick = () => handleJawClick('bite');
  
  // Animate scan progress
  useEffect(() => {
    if (isScanning) {
      const duration = 2000; // 2 seconds total scan time (faster)
      const interval = 50; // Update every 50ms
      const steps = duration / interval;
      const increment = 100 / steps;
      
      const timer = setInterval(() => {
        setScanProgress(prev => {
          const next = prev + increment;
          if (next >= 100) {
            clearInterval(timer);
            setIsScanning(false);
            
            // Universal completion: mark the current jaw as scanned for the active tab
            if (currentJaw && (currentJaw === 'upper' || currentJaw === 'lower' || currentJaw === 'bite')) {
              undoHistory.push(
                { tabJawStates, scannedTabs: [...scannedTabs], activeTabId, tabs, currentJaw },
                `Scanned ${currentJaw} jaw`
              );
              setTabJawScanned(activeTabId, currentJaw);

              // Set reference bite layer (first bite scan becomes the reference)
              if (currentJaw === 'bite' && !referenceBiteLayerId) {
                setReferenceBiteLayerId(activeTabId);
              }

              // Mark tab as having scan data
              setScannedTabs(prev => new Set([...prev, activeTabId]));
              setTabs(prevTabs => prevTabs.map(tab => 
                tab.id === activeTabId ? { ...tab, hasScanned: true } : tab
              ));
              // No auto-advance — user must click the next arch to scan it
            }
            
            return 100;
          }
          return next;
        });
      }, interval);
      
      return () => clearInterval(timer);
    }
  }, [isScanning, activeTabId, currentJaw]);

  // Send scanned layers to parent whenever tabs or scannedTabs change
  useEffect(() => {
    if (onScannedLayersChange) {
      // Filter tabs that have any scan data and map with per-tab jaw states
      const completedLayers = tabs
        .filter(tab => scannedTabs.has(tab.id))
        .map(tab => ({
          id: tab.id,
          label: tab.label,
          type: tab.type,
          scannedJaws: getTabJawState(tab.id)
        }));
      
      onScannedLayersChange(completedLayers);
    }
  }, [tabs, scannedTabs, tabJawStates, workflow, onScannedLayersChange]);

  // Notify parent of bite options whenever they change
  useEffect(() => {
    onBiteOptionsChange?.(selectedBiteOptions);
  }, [selectedBiteOptions, onBiteOptionsChange]);

  // Handle modal "Yes" - Move scan to pre-treatment
  const handleMoveToPretreatment = () => {
    // Find the treatment scan tab dynamically (could be 'treatment-scan' or 'crown-treatment-scan')
    const treatmentTab = tabs.find(tab => 
      tab.type === "treatment" && 
      (tab.id === "crown-treatment-scan" || tab.id === "treatment-scan") &&
      hasAnyJawScanned(tab.id)
    );
    
    if (!treatmentTab) return; // Safety check
    
    const oldTabId = treatmentTab.id;
    const pretreatmentId = pendingPreTreatmentTabIdRef.current;
    
    if (pretreatmentId) {
      // Get the jaw states from the old treatment tab
      const oldJawState = getTabJawState(oldTabId);
      
      // Create the pre-treatment tab
      const newTab = {
        id: pretreatmentId,
        label: "Pre-treatment",
        type: "pre-treatment" as const
      };
      
      // Add pre-treatment tab at the beginning
      setTabs([newTab, ...tabs]);
      
      // Transfer jaw states from old treatment tab to new pre-treatment tab AND clear the old one
      setTabJawStates(prev => {
        const newStates = { ...prev };
        // Clear the old treatment tab's jaw states
        newStates[oldTabId] = { upper: false, lower: false, bite: false };
        // Set the pre-treatment tab's jaw states
        newStates[pretreatmentId] = oldJawState;
        return newStates;
      });
      
      // Clear the treatment tab from scannedTabs
      setScannedTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(oldTabId);
        newSet.add(pretreatmentId);
        return newSet;
      });
      
      // Update the tabs to mark treatment as not scanned
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === oldTabId ? { ...tab, hasScanned: false } : tab
      ));
      
      // Switch to the pre-treatment tab (to show the moved scan)
      setActiveTabId(pretreatmentId);
      setCurrentJaw('upper');
    }
    
    // Close modal and reset
    setShowMoveToPretreatmentModal(false);
    setPendingPreTreatmentTabId(null);
    pendingPreTreatmentTabIdRef.current = null;
  };
  
  // Handle modal "No" - Keep treatment scan as is and add new pre-treatment (ready to scan from scratch)
  const handleKeepTreatmentScan = () => {
    if (pendingPreTreatmentTabId) {
      // Just add the pre-treatment tab normally (with no jaw states - ready to scan from scratch)
      const newTab = {
        id: pendingPreTreatmentTabId,
        label: "Pre-treatment",
        type: "pre-treatment" as const
      };
      
      // Add pre-treatment tab at the beginning
      setTabs([newTab, ...tabs]);
      
      // Switch to the new pre-treatment tab (ready for user to scan from scratch)
      setActiveTabId(pendingPreTreatmentTabId);
      
      // Reset jaw scanning state for fresh scanning
      setCurrentJaw('upper'); // Default to upper jaw view, ready to scan
    }
    
    // Close modal and reset
    setShowMoveToPretreatmentModal(false);
    setPendingPreTreatmentTabId(null);
    pendingPreTreatmentTabIdRef.current = null;
  };

  // Handle tab deletion cleanup - clean up orphaned jaw states and scanned tabs
  const handleDeleteTab = (tabId: string) => {
    undoHistory.push(
      { tabJawStates, scannedTabs: [...scannedTabs], activeTabId, tabs, currentJaw },
      `Deleted tab "${tabs.find(t => t.id === tabId)?.label ?? tabId}"`
    );
    setScannedTabs(prev => {
      const newSet = new Set(prev);
      newSet.delete(tabId);
      return newSet;
    });
    setTabJawStates(prev => {
      const newStates = { ...prev };
      delete newStates[tabId];
      return newStates;
    });
  };

  // Restore component state from a ScanSnapshot
  const restoreSnapshot = (snap: import("../hooks/useUndoHistory").ScanSnapshot) => {
    isRestoringRef.current = true;
    setTabs(snap.tabs as typeof tabs);
    setTabJawStates(snap.tabJawStates);
    setScannedTabs(new Set(snap.scannedTabs));
    setActiveTabId(snap.activeTabId);
    setCurrentJaw(snap.currentJaw);
    setIsScanning(false);
    setScanProgress(0);
    requestAnimationFrame(() => { isRestoringRef.current = false; });
  };

  const TOTAL_REVEAL_STEPS = 10;

  // Unified handler for undo tool actions
  const handleUndoAction = (action: "undo" | "redo" | "accept") => {
    if (action === "undo") {
      setHasAppliedUndoState(false);
      setRevealStep(prev => Math.max(1, prev - 1));
    } else if (action === "redo") {
      setHasAppliedUndoState(false);
      setRevealStep(prev => Math.min(TOTAL_REVEAL_STEPS, prev + 1));
    } else if (action === "accept") {
      // Keep the current reveal step — model stays at whatever state user accepted
      setHasAppliedUndoState(true);
      setCurrentJaw((prev) => prev ?? 'upper');
      undoPanelCloseRef.current?.();
    }
  };

  // Jump to a specific history index (Option 2 timeline)
  const handleUndoJumpTo = (index: number) => {
    const totalSteps = undoHistory.past.length + undoHistory.future.length + 1;
    const mappedStep = totalSteps > 0 ? Math.max(1, Math.min(TOTAL_REVEAL_STEPS, Math.round(((index + 1) / totalSteps) * TOTAL_REVEAL_STEPS))) : TOTAL_REVEAL_STEPS;
    setRevealStep(mappedStep);
    const snap = undoHistory.jumpTo(index);
    if (snap) restoreSnapshot(snap);
  };

  return (
    <div className="flex flex-col h-screen w-full relative" style={{ background: canvasBg }}>
      {/* Controls panel — draggable + collapsible when scan guidance is active (hidden when any toolbar tool is active) */}
      <div
        ref={panelRef}
        className={`${isPrepEditOpen ? 'z-[40]' : 'z-[60]'} ${isAnyToolActive ? 'hidden' : ''}`}
        style={
          enableScanGuidance && panelPos
            ? { position: 'fixed', left: panelPos.x, top: panelPos.y, userSelect: 'none' }
            : { position: 'absolute', bottom: 16, left: 16 }
        }
      >
        {enableScanGuidance ? (
          /* Scan Guidance draggable panel */
          <div className="bg-white rounded-[10px] shadow-xl overflow-hidden" style={{ minWidth: 0 }}>
            {/* Drag handle + collapse button */}
            <div
              className="flex items-center justify-between gap-[8px] px-[12px] py-[8px] bg-gray-50 border-b border-gray-100 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={onPanelDragStart}
            >
              <div className="flex items-center gap-[6px]">
                {/* Grip dots */}
                <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                  {[0,4,8,12].map(y => [0,4].map(x => (
                    <circle key={`${x}-${y}`} cx={x+1} cy={y+2} r="1.2" fill="#9ca3af"/>
                  )))}
                </svg>
                <span className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Scan Guidance</span>
              </div>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setPanelCollapsed(v => !v)}
                className="flex items-center justify-center w-[22px] h-[22px] rounded hover:bg-gray-200 transition-colors"
                title={panelCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: panelCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
            </div>

            {/* Collapsible content */}
            {!panelCollapsed && (
              <div className="p-[10px] flex flex-col gap-[8px]">
                {/* Direction buttons row */}
                <div className="flex flex-row flex-wrap items-center gap-[4px]">
                  {([
                    { id: 'fagwand-tilt3d',   label: '3D Tilt' },
                    { id: 'fagwand-spin3d',   label: '3D Spin' },
                    { id: 'fagwand-nod3d',    label: '3D Nod' },
                    { id: 'fagwand-sweep3d',  label: '3D Sweep' },
                    { id: 'fagwand-rock3d',   label: '3D Rock' },
                    { id: 'fagwand-tumble3d', label: '3D Tumble' },
                    { id: 'fagwand-wobble3d', label: '3D Wobble' },
                    { id: 'smart-nav',        label: 'Smart Nav' },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => { setGuidanceMode(id); setGuidanceResetCounter(c => c + 1); }}
                      className={`px-[14px] py-[7px] rounded-[6px] transition-all text-center text-[13px] whitespace-nowrap ${
                        guidanceMode === id ? 'bg-[#009ace] text-white' : 'bg-gray-50 text-[#3e3d40] hover:bg-gray-100'
                      }`}
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100" />

                {/* Toggle buttons row */}
                <div className="flex flex-row flex-wrap items-center gap-[4px]">
                  {/* Lock model */}
                  <button
                    onClick={() => setLockModel(v => !v)}
                    title={lockModel ? 'Model locked' : 'Model free'}
                    className={`flex items-center gap-[6px] px-[14px] py-[7px] rounded-[6px] transition-all text-[13px] whitespace-nowrap ${
                      lockModel ? 'bg-[#3e3d40] text-white' : 'bg-gray-50 text-[#3e3d40] hover:bg-gray-100'
                    }`}
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {lockModel
                        ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
                        : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>
                      }
                    </svg>
                    {lockModel ? 'Locked' : 'Lock model'}
                  </button>

                  {/* Arrows */}
                  <button
                    onClick={() => setShowArrows(v => !v)}
                    className={`flex items-center gap-[6px] px-[14px] py-[7px] rounded-[6px] transition-all text-[13px] whitespace-nowrap ${
                      showArrows ? 'bg-[#009ace] text-white' : 'bg-gray-50 text-[#3e3d40] hover:bg-gray-100'
                    }`}
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                    </svg>
                    Arrows
                  </button>

                  {/* Ghost main */}
                  <button
                    onClick={() => setGhostMain(v => !v)}
                    title="Toggle main silhouette as ghost"
                    className={`flex items-center gap-[6px] px-[14px] py-[7px] rounded-[6px] transition-all text-[13px] whitespace-nowrap ${
                      ghostMain ? 'bg-[#009ace] text-white' : 'bg-gray-50 text-[#3e3d40] hover:bg-gray-100'
                    }`}
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a7 7 0 0 0-7 7v5l-2 2v1h18v-1l-2-2V9a7 7 0 0 0-7-7z" strokeDasharray="4 2"/>
                      <path d="M9 20a3 3 0 0 0 6 0"/>
                    </svg>
                    Ghost main
                  </button>

                  {/* Sync main */}
                  <button
                    onClick={() => setSyncMain(v => !v)}
                    title="Main silhouette follows ghost animation"
                    className={`flex items-center gap-[6px] px-[14px] py-[7px] rounded-[6px] transition-all text-[13px] whitespace-nowrap ${
                      syncMain ? 'bg-[#009ace] text-white' : 'bg-gray-50 text-[#3e3d40] hover:bg-gray-100'
                    }`}
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      <path d="M5 5v14" strokeDasharray="3 2"/>
                    </svg>
                    Sync main
                  </button>

                  {/* Restart ghost */}
                  <button
                    onClick={() => setGuidanceResetCounter(c => c + 1)}
                    title="Restart ghost animation"
                    className="flex items-center gap-[6px] px-[14px] py-[7px] rounded-[6px] transition-all text-[13px] whitespace-nowrap bg-gray-50 text-[#3e3d40] hover:bg-gray-100"
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 1 9 9"/><polyline points="3 3 3 12 12 12"/>
                    </svg>
                    Restart ghost
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Normal workflow selector - hidden in canvas theme mode */
          !isCanvasThemeMode && (
          <div className="flex flex-row items-center gap-[8px] bg-white rounded-[8px] p-[12px] shadow-lg">
            <button
              onClick={() => { setWorkflow("crown"); onWorkflowChange?.("crown"); }}
              className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${workflow === "crown" ? 'bg-[#009ace] text-white' : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'}`}
              style={{ fontFamily: "'Roboto', sans-serif" }}
            >Crown</button>
            <button
              onClick={() => { setWorkflow("implant-based"); onWorkflowChange?.("implantPlanning"); }}
              className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${workflow === "implant-based" ? 'bg-[#009ace] text-white' : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'}`}
              style={{ fontFamily: "'Roboto', sans-serif" }}
            >Implant based</button>
            <button
              onClick={() => { setWorkflow("dentures"); onWorkflowChange?.("dentures"); }}
              className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${workflow === "dentures" ? 'bg-[#009ace] text-white' : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'}`}
              style={{ fontFamily: "'Roboto', sans-serif" }}
            >Dentures</button>
            <button
              onClick={() => { setWorkflow("fixed-restorative"); onWorkflowChange?.("fixed-restorative"); }}
              className={`px-[16px] py-[8px] rounded-[6px] transition-all text-center text-[14px] whitespace-nowrap ${workflow === "fixed-restorative" ? 'bg-[#009ace] text-white' : 'bg-transparent text-[#3e3d40] hover:bg-gray-50'}`}
              style={{ fontFamily: "'Roboto', sans-serif" }}
            >Multi bite</button>
          </div>
          )
        )}
      </div>

      <Header
        activeSteps={{ stepIcon: true }}
        onStepToggle={(step) => {
          if (step === 'search') {
            onNavigateToView?.();
          } else if (step === 'rx') {
            onNavigateToRx?.();
          } else if (step === 'email') {
            onNavigateToSummary?.();
          }
        }}
        onNavigateToRx={onNavigateToRx}
        onNavigateToScan={onNavigateToMultiLayer}
        onNavigateToView={onNavigateToView}
        onNavigateToSummary={onNavigateToSummary}
        canvasBg={canvasBg}
        onCanvasBgChange={onCanvasBgChange}
        settingsOverlay
      />

      {/* Chrome Tabs - Below Header, with solid background (no gradient) */}
      <div style={{ backgroundColor: tabs.find(tab => tab.id === activeTabId)?.type === 'pre-treatment' ? '#C5EAD0' : solidColor(canvasBg) }}>
        <ChromeTabs 
          tabs={tabs}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          onAddTab={handleAddTab}
          selectedBiteOptions={selectedBiteOptions}
          onBiteOptionsChange={setSelectedBiteOptions}
          activeBiteOptions={activeBiteOptions}
          onBiteOptionClick={handleBiteOptionClick}
          onBiteOptionsVisibilityChange={setBiteOptionsVisible}
          workflow={workflow}
          setTabs={setTabs}
          hasStudyModelAdditionalBite={hasStudyModelAdditionalBite}
          onStudyModelAdditionalBiteToggle={() => setHasStudyModelAdditionalBite(!hasStudyModelAdditionalBite)}
          isScanning={isScanning}
          onDeleteTab={handleDeleteTab}
        />
      </div>
      
      {/* Main content area */}
      <div className="flex-1 relative" style={{ background: tabs.find(tab => tab.id === activeTabId)?.type === 'pre-treatment' ? '#C5EAD0' : canvasBg }}>
        {/* ToolbarScan - Fixed in top right corner */}
        <div className="absolute right-4 top-4 z-50">
          <ToolbarScan
            onPrepEditChange={setIsPrepEditOpen}
            onCopilotChange={setIsCopilotActive}
            onCollapseChange={setIsToolbarCollapsed}
            onAnyToolActiveChange={setIsAnyToolActive}
            onMonochromeChange={setIsMonochrome}
            onUndoPanelOpenChange={(isOpen, closeHandler) => {
              setIsUndoPanelOpen(isOpen);
              undoPanelCloseRef.current = closeHandler ?? null;
              if (isOpen) {
                setCurrentJaw((prev) => prev ?? 'upper');
              } else {
                setIsMonochrome(false);
              }
            }}
            undoState={{
              canUndo: revealStep > 1,
              canRedo: revealStep < TOTAL_REVEAL_STEPS,
              stepInfo: `${revealStep} / ${TOTAL_REVEAL_STEPS}`,
              lastLabel: `Step ${revealStep}`,
              past: undoHistory.past,
              future: undoHistory.future,
            }}
            onUndo={handleUndoAction}
            undoVariant={undoVariant}
          />
        </div>

        {/* Bite Layer Navigation Toast */}
        <div className="absolute right-4 top-20 z-50">
          <UndoToast message={biteLayerToast.message} visible={biteLayerToast.visible} />
        </div>

        {/* Undo variant switcher — draggable, toggle with 'E' key */}
        {isUndoPanelOpen && isSwitcherVisible && (
          <motion.div
            ref={switcherRef}
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragEnd={(_e, info) => {
              setSwitcherDragPos(prev => ({
                x: (prev?.x ?? 0) + info.offset.x,
                y: (prev?.y ?? 0) + info.offset.y,
              }));
            }}
            style={switcherDragPos ? { x: switcherDragPos.x, y: switcherDragPos.y } : undefined}
            className={`absolute left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1 bg-white/90 backdrop-blur-sm rounded-[16px] px-3 py-2 shadow-lg border border-black/8 cursor-grab active:cursor-grabbing ${undoVariant === 1 || undoVariant === 2 || undoVariant === 5 || undoVariant === 6 || undoVariant === 8 || undoVariant === 9 ? 'bottom-20' : 'bottom-4'}`}
          >
            {/* Drag handle */}
            <div className="w-8 h-1 rounded-full bg-black/15 mb-0.5" />
            {/* Variant row */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#8a8a8a] mr-1 font-medium">UI:</span>
              {([1, 3, 8, 9] as const).map(v => (
                <button
                  key={v}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setUndoVariant(v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    undoVariant === v
                      ? 'bg-[#009ACE] text-white'
                      : 'text-[#3E3D40] hover:bg-gray-100'
                  }`}
                >
                  {v === 1 ? 'Bordered' : v === 2 ? 'Borderless' : v === 3 ? 'Compact' : v === 4 ? 'Labeled' : v === 5 ? 'Pill' : v === 6 ? 'Icons' : v === 7 ? 'Stacked' : v === 8 ? 'H-Stack' : 'Labeled+'}
                </button>
              ))}
            </div>
            {/* Position row */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#8a8a8a] mr-1 font-medium">Pos:</span>
              {(['left-bottom', 'center-bottom', 'under-toolbar'] as const).map(pos => (
                <button
                  key={pos}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setUndoPosition(pos)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    undoPosition === pos
                      ? 'bg-[#009ACE] text-white'
                      : 'text-[#3E3D40] hover:bg-gray-100'
                  }`}
                >
                  {pos === 'left-bottom' ? 'Left' : pos === 'center-bottom' ? 'Center' : 'Under toolbar'}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-[#aaa] mt-0.5">Press E to hide</span>
          </motion.div>
        )}

        
        {/* Left side - JawSelector - stays in fixed position (hidden when Copilot active) */}
        <div
          className={`absolute left-4 flex flex-col items-start gap-8 z-50 transition-all duration-200 top-4 ${isCopilotActive ? 'hidden' : ''}`}
        >
          <div className="w-[232px] self-start">
            {/* Bite Toolbar - Show above jaw selector when additional bites are selected */}
            {selectedBiteOptions.length > 0 && (
              <motion.div 
                className="mb-[16px]"
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              >
                <BiteToolbarContainer
                  selectedBiteOptions={selectedBiteOptions}
                  activeBite={activeBiteOptions[0]}
                  onBiteClick={(bite) => handleBiteOptionClick(bite)}
                  onBiteToggle={(bite) => handleBiteToggle(bite)}
                />
              </motion.div>
            )}

            {/* Jaw Selector - 3 states: Upper active, Lower active, Both active */}
            <motion.div 
              className="relative w-[232px] h-[432px]"
              layout
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Render the appropriate jaw state */}
              {currentJaw === 'bite' ? (
                <UiJawBoth />
              ) : currentJaw === 'lower' ? (
                <UiJawLower />
              ) : (
                <UiJawUpper />
              )}
              
              {/* Click areas overlaid on the jaw selector */}
              {/* Upper Jaw Click Area */}
              <div 
                className="absolute top-0 left-0 right-0 h-[40%] cursor-pointer z-10"
                onClick={handleUpperJawClick}
              />
              {/* Bite/Both Click Area */}
              <div 
                className="absolute top-[38%] left-[15%] right-[15%] h-[24%] cursor-pointer z-10"
                onClick={handleBiteClick}
              />
              {/* Lower Jaw Click Area */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-[40%] cursor-pointer z-10"
                onClick={handleLowerJawClick}
              />
            </motion.div>
            
            {/* Jaw Scan Button */}
            <div className="mt-[16px] w-full">
              {(() => {
                const jawState = getTabJawState(activeTabId);
                const isAlreadyScanned = !!(currentJaw && jawState[currentJaw as keyof typeof jawState] && !activeBiteOptions.includes('Left lateral'));
                const isDisabled = !currentJaw || isScanning || isAlreadyScanned;
                const jawLabel = activeBiteOptions.length > 0
                  ? getBiteDisplayName(activeBiteOptions[0])
                  : currentJaw === 'bite' ? 'Both' : currentJaw === 'lower' ? 'Lower' : 'Upper';
                return (
                  <button
                    onClick={handleWandScan}
                    disabled={isDisabled}
                    className={`relative w-full rounded-[4px] overflow-hidden transition-all group ${
                      !isDisabled ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {/* Background */}
                    <div className="absolute inset-0 rounded-[4px] bg-white" />
                    {/* Scan line sweeping top → bottom */}
                    <AnimatePresence>
                      {isScanning && (
                        <motion.div
                          key="scan-line"
                          className="absolute left-0 right-0 h-[2px] bg-[#009ACE]/70 z-10"
                          style={{ boxShadow: '0 0 6px 2px rgba(0,154,206,0.4)' }}
                          initial={{ top: '0%' }}
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </AnimatePresence>
                    {/* Row: jaw name centered */}
                    <div className="relative flex flex-row items-center justify-center px-[16px] py-[12px]">
                      <p className="font-['Roboto',sans-serif] font-normal leading-[28px] text-[#3e3d40] text-[18px] text-center" style={{ fontVariationSettings: "'wdth' 100" }}>
                        {jawLabel}
                      </p>
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
        
        {/* Bottom left: Prep Edit Panel or Rectangle (hidden when any toolbar tool is active, except Prep Edit itself) */}
        <div className={`absolute bottom-4 left-4 z-50 ${isAnyToolActive && !isPrepEditOpen ? 'hidden' : ''}`}>
          {isPrepEditOpen ? (
            <div className="w-[284px]">
              <PrepEditPanel />
            </div>
          ) : (
            <Rectangle22322 />
          )}
        </div>

        {/* Undo panels — positioned based on undoPosition state */}
        {isUndoPanelOpen && (
          <div className={`absolute z-50 ${
            undoPosition === 'left-bottom' ? 'bottom-4 left-4' :
            undoPosition === 'center-bottom' ? 'bottom-4 left-1/2 -translate-x-1/2' :
            'top-[108px] right-4'
          }`}>
            <AnimatePresence>
              {undoVariant === 1 && (
                <UndoFilmstripChip
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
              {undoVariant === 2 && (
                <UndoBorderlessChip
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
              {undoVariant === 3 && (
                <UndoCompactBar
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                  onClose={() => undoPanelCloseRef.current?.()}
                />
              )}
              {undoVariant === 4 && (
                <UndoLabeledList
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                  onClose={() => undoPanelCloseRef.current?.()}
                />
              )}
              {undoVariant === 5 && (
                <UndoPill
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
              {undoVariant === 6 && (
                <UndoIconsOnly
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
              {undoVariant === 7 && (
                <UndoStacked
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
              {undoVariant === 8 && (
                <UndoHorizontalStacked
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
              {undoVariant === 9 && (
                <UndoLabeledChip
                  canUndo={revealStep > 1}
                  canRedo={revealStep < TOTAL_REVEAL_STEPS}
                  onUndo={() => handleUndoAction("undo")}
                  onRedo={() => handleUndoAction("redo")}
                  onAccept={() => handleUndoAction("accept")}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Scan Guidance 3D Viewer - shown only when enableScanGuidance is true and Copilot is off */}
        {enableScanGuidance && !isCopilotActive && (
          <div className="absolute inset-0 z-0" style={{ pointerEvents: 'auto' }}>
            <ScanGuidanceViewer
              resetTrigger={guidanceResetCounter}
              guidanceMode={guidanceMode}
              lockModel={lockModel}
              hideTopBar
              showArrows={showArrows}
              ghostMain={ghostMain}
              syncMain={syncMain}
              requireRightClick
              jaw={currentJaw || 'upper'}
            />
          </div>
        )}

        {/* Center Area - Scanning Animation and 3D Model (only shown in normal test flow) */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${enableScanGuidance || isCopilotActive ? 'hidden' : ''} ${isUndoPanelOpen ? 'z-[5]' : 'z-0'}`}>
          {/* 3D Teeth Model - Show when scanning, jaw scanned, or undo panel is open */}
          {(isScanning || isUndoPanelOpen || hasAppliedUndoState || (currentJaw && (
            currentJaw === 'bite'
              ? (getTabJawState(activeTabId).upper || getTabJawState(activeTabId).lower || getTabJawState(activeTabId).bite)
              : getTabJawState(activeTabId)[currentJaw]
          ))) && (() => {
            const activeTab = tabs.find(tab => tab.id === activeTabId);
            const isPreTreatment = activeTab?.type === 'pre-treatment';
            const isTreatmentFixedRestorative = activeTab?.type === 'treatment' && workflow === 'fixed-restorative';
            const isEmergenceProfile = activeTab?.label === 'Emergence profile';
            const isTreatmentCrown = activeTab?.label === 'Treatment scan' && workflow === 'crown';
            const isTreatmentImplant = activeTab?.label === 'Treatment scan' && workflow === 'implant-based';
            
            // Check if left lateral bite is active
            const isLeftLateralActive = activeBiteOptions.includes('Left lateral');
            
            return (
              <motion.div
                initial={{ opacity: isRestoringRef.current || isUndoPanelOpen ? 1 : 0 }}
                animate={{ opacity: isScanning ? scanProgress / 100 : 1 }}
                transition={{ opacity: { duration: isUndoPanelOpen ? 0 : 0.3 } }}
                key={`${currentJaw}-${activeTabId}-${isUndoPanelOpen ? 'undo' : 'scan'}-${isLeftLateralActive ? 'left-lateral' : ''}`}
                className="absolute inset-0 pointer-events-auto"
              >
                <JawPlyViewer
                  jaw={currentJaw || 'upper'}
                  monochrome={isMonochrome}
                  revealStep={(isUndoPanelOpen || hasAppliedUndoState) ? revealStep : TOTAL_REVEAL_STEPS}
                  showGhost={isUndoPanelOpen}
                  showMarkers={showToothMarkers}
                />
              </motion.div>
            );
          })()}
          
          {/* Scanning Wand Animation - Only show while scanning (hidden in canvas theme mode) */}
          {isScanning && !isCanvasThemeMode && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ transformOrigin: 'bottom center' }}
              initial={{ opacity: 0, rotate: -55, x: -150 }}
              animate={{ 
                opacity: 1,
                rotate: [-55, -45, -35, -45, -55],
                x: [-150, -50, 150, -50, -150],
                y: [20, -10, 20, -10, 20],
              }}
              transition={{ 
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                opacity: { duration: 0.3 },
              }}
            >
              <img src={imgScanWand} alt="Scanning wand" className="w-[450px] object-contain" />
            </motion.div>
          )}
        </div>

        {/* Prep Copilot - full experience: 3D viewer + overlays + side panel */}
        {isCopilotActive && (
          <PrepCopilotExperience onClose={() => setIsCopilotActive(false)} toolbarCollapsed={isToolbarCollapsed} />
        )}
      </div>

      {/* Move to Pre-treatment Modal */}
      {showMoveToPretreatmentModal && (
        <MoveToPretreatmentModal
          onYes={handleMoveToPretreatment}
          onNo={handleKeepTreatmentScan}
        />
      )}
    </div>
  );
}