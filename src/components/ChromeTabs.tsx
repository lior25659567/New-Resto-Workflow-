import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, ChevronDown, X, Pencil, Circle } from "lucide-react";
import { useInlineRename } from "./useInlineRename";
import InlineRenameInput from "./InlineRenameInput";
import Keyboard from "../imports/Keyboard";
import AdditionalCentric from "../imports/AdditionalCentric";
import RightLateral from "../imports/RightLateral";
import LeftLateral from "../imports/LeftLateral";
import Protrusive from "../imports/Protrusive";
import Retrusive from "../imports/Retrusive";
import ScanProgressBar from "../imports/ScanProgressBar";

interface Tab {
  id: string;
  label: string;
  type: "treatment" | "bite" | "pre-treatment" | "additional";
  hasScanned?: boolean;
}

interface ChromeTabsProps {
  tabs: Tab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  onAddTab: (scanType: "Pre-treatment" | "Additional scan" | "Reference scan" | "Denture copy" | "Emergence profile" | "Treatment scan") => void;
  selectedBiteOptions: string[];
  onBiteOptionsChange: (options: string[]) => void;
  activeBiteOptions?: string[];
  onBiteOptionClick?: (option: string) => void;
  onBiteOptionsVisibilityChange?: (visible: boolean) => void;
  onAddBiteTab?: () => void;
  onRemoveBiteTab?: () => void;
  workflow?: "study-model" | "fixed-restorative" | "implant-based" | "dentures" | "crown";
  setTabs: (tabs: Tab[]) => void;
  hasStudyModelAdditionalBite?: boolean;
  onStudyModelAdditionalBiteToggle?: () => void;
  isScanning?: boolean;
  onDeleteTab?: (tabId: string) => void;
}

export function ChromeTabs({
  tabs,
  activeTabId,
  setActiveTabId,
  onAddTab,
  selectedBiteOptions,
  onBiteOptionsChange,
  activeBiteOptions,
  onBiteOptionClick,
  onBiteOptionsVisibilityChange,
  onAddBiteTab,
  onRemoveBiteTab,
  workflow,
  setTabs,
  hasStudyModelAdditionalBite,
  onStudyModelAdditionalBiteToggle,
  isScanning,
  onDeleteTab,
}: ChromeTabsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBiteExpanded, setIsBiteExpanded] = useState(false);
  const [isBiteOverlayOpen, setIsBiteOverlayOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Inline rename hook for additional scan tabs
  const rename = useInlineRename({
    onRename: (id, newLabel) => {
      const newTabs = tabs.map(tab => tab.id === id ? { ...tab, label: newLabel } : tab);
      setTabs(newTabs);
    },
  });

  // Track newly added tab id to auto-trigger rename
  const pendingRenameTabId = useRef<string | null>(null);
  const prevAdditionalIdsRef = useRef<Set<string>>(new Set());

  // Wand initialization progress state
  const [wandInitProgress, setWandInitProgress] = useState(0);
  const [showWandInit, setShowWandInit] = useState(false);
  const prevWorkflowRef = useRef(workflow);

  // Trigger wand initialization when workflow changes
  useEffect(() => {
    if (workflow && workflow !== prevWorkflowRef.current) {
      prevWorkflowRef.current = workflow;
      setShowWandInit(true);
      setWandInitProgress(0);
    }
  }, [workflow]);

  // Also trigger on initial mount if a workflow is set
  useEffect(() => {
    if (workflow) {
      setShowWandInit(true);
      setWandInitProgress(0);
    }
  }, []);

  // Animate wand init progress from 0 to 100
  useEffect(() => {
    if (!showWandInit) return;
    const duration = 3000; // 3 seconds
    const interval = 50;
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setWandInitProgress(prev => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          // Hide after a short delay once complete
          setTimeout(() => {
            setShowWandInit(false);
            setWandInitProgress(0);
          }, 400);
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [showWandInit]);

  const biteOptions = [
    "Protrusive",
    "Retrusive",
    "Right lateral",
    "Left lateral",
    "Additional centric"
  ];

  // Get icon component for bite option
  const getBiteIcon = (option: string) => {
    switch (option) {
      case "Right lateral":
        return <div className="w-[48px] h-[32px]"><RightLateral /></div>;
      case "Left lateral":
        return <div className="w-[48px] h-[32px]"><LeftLateral /></div>;
      case "Additional centric":
        return <div className="w-[48px] h-[32px]"><AdditionalCentric /></div>;
      case "Protrusive":
        return <div className="w-[48px] h-[32px]"><Protrusive /></div>;
      case "Retrusive":
        return <div className="w-[48px] h-[32px]"><Retrusive /></div>;
      default:
        return null;
    }
  };

  const handleAddClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownOptionClick = (scanType: "Pre-treatment" | "Additional scan" | "Reference scan" | "Denture copy" | "Emergence profile" | "Treatment scan") => {
    // Track the current additional scan tab ids before adding
    if (scanType === "Additional scan") {
      const currentAdditionalIds = new Set(tabs.filter(t => t.type === "additional").map(t => t.id));
      pendingRenameTabId.current = `__pending_additional__`;
      // Store current ids to compare after tabs update
      prevAdditionalIdsRef.current = currentAdditionalIds;
    }
    onAddTab?.(scanType);
    setIsDropdownOpen(false);
    setIsBiteExpanded(false);
  };

  const handleBiteToggle = () => {
    setIsBiteExpanded(!isBiteExpanded);
  };

  const handleBiteCheckboxChange = (option: string) => {
    const newOptions = selectedBiteOptions.includes(option)
      ? selectedBiteOptions.filter(o => o !== option)
      : [...selectedBiteOptions, option];
    onBiteOptionsChange(newOptions);
    if (onBiteOptionsVisibilityChange) {
      onBiteOptionsVisibilityChange(newOptions.length > 0);
    }
    
    // Don't auto-switch to pre-treatment tab - stay on current tab (additional scan)
    // Switching happens when user clicks a bite in the toolbar
    
    // Keep the dropdown open after selecting a bite
    // Don't close dropdown or collapse bite section
  };

  // Check which options should be available in dropdown
  const hasPreTreatment = tabs.some(tab => tab.type === "pre-treatment");
  const additionalScanCount = tabs.filter(tab => tab.type === "additional").length;
  const canAddAdditionalScan = additionalScanCount < 2;
  const canAddAdditionalScanDentures = additionalScanCount < 1;
  const maxTabsReached = tabs.length >= 4;
  const hasReferenceScan = tabs.some(tab => tab.label === "Reference scan");
  const hasCopyDenture = tabs.some(tab => tab.label === "Denture copy");
  const isDenturesDropdownEmpty = workflow === "dentures" && hasReferenceScan && hasCopyDenture && !canAddAdditionalScanDentures;
  const hasEmergenceProfile = tabs.some(tab => tab.label === "Emergence profile");
  const hasTreatmentScan = tabs.some(tab => tab.label === "Treatment scan");

  // Remove the Bites tab logic - bites are now shown in the pre-treatment tab
  // No longer creating/removing a separate Bites tab

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsBiteExpanded(false);
      }
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        setIsBiteOverlayOpen(false);
      }
    }

    if (isDropdownOpen || isBiteOverlayOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isDropdownOpen, isBiteOverlayOpen]);

  const handleDeleteTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = tabs.filter(tab => tab.id !== id);
    setTabs(newTabs);
    
    // If the deleted tab was active, switch to the first tab
    if (activeTabId === id) {
      setActiveTabId(newTabs[0]?.id || "");
    }
    
    // Call onDeleteTab if provided
    if (onDeleteTab) {
      onDeleteTab(id);
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex items-end px-[16px] gap-[2px] bg-[rgba(255,255,255,0.2)] pt-[16px] border-t border-gray-300 pr-[16px] pb-[0px] pl-[16px]">
        {tabs?.map((tab, index) => {
          const isActive = activeTabId === tab.id;
          const isBitesTab = tab.type === "bite";
          const isFirstTab = index === 0;
          const isAdditionalScan = tab.label === "Additional scan";
          const hasScanned = tab.hasScanned ?? false;
          // Count includes centric bite + additional bites
          const biteCount = selectedBiteOptions.length + 1;
          
          // Check if currently active tab is an additional scan
          const activeTab = tabs.find(t => t.id === activeTabId);
          const isAdditionalScanActive = activeTab?.type === "additional";
          
          // Check if any bites have been selected
          const hasBitesSelected = selectedBiteOptions.length > 0;
          
          // Determine tab styling based on state
          let tabClasses = '';
          let textClasses = '';
          
          if (isActive) {
            // Active tab: Always blue background with white text (regardless of scan state)
            tabClasses = 'z-10 bg-[#009ace] rounded-tl-[8px] rounded-tr-[8px]';
            textClasses = 'text-white';
          } else if (!isActive && !hasScanned && !(tab.type === 'treatment' && (isAdditionalScanActive || hasBitesSelected))) {
            // Inactive + Not Scanned: Semi-transparent white with dark text
            // Exception: treatment tabs show as scanned when additional scan is active OR bites are selected
            tabClasses = 'z-0 bg-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.8)] rounded-tl-[8px] rounded-tr-[8px]';
            textClasses = 'text-[#3b3b3b]';
          } else {
            // Inactive + Scanned: Solid white background with dark text (variant 2)
            // OR treatment tabs when additional scan is active OR bites are selected
            tabClasses = 'z-0 bg-white hover:bg-[rgba(255,255,255,0.95)] rounded-tl-[8px] rounded-tr-[8px]';
            textClasses = 'text-[#121212]';
          }
          
          return (
            <div
              key={tab.id}
              className={`relative px-[16px] flex items-center justify-center transition-all group ${tabClasses}`}
              style={{
                fontFamily: "'Roboto', sans-serif",
                height: '52px',
              }}
            >
              {/* Tab Content */}
              {rename.editingId === tab.id ? (
                  <div
                    className="flex items-center justify-center gap-[8px] h-full w-full"
                  >
                    <InlineRenameInput
                      inputRef={rename.inputRef}
                      value={rename.editValue}
                      error={rename.editError}
                      onChange={rename.handleEditChange}
                      onKeyDown={rename.handleEditKeyDown}
                      onConfirm={rename.confirmRename}
                      onCancel={rename.cancelRename}
                      compact
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => setActiveTabId(tab.id)}
                    className="flex items-center justify-center gap-[8px] h-full w-full cursor-pointer"
                  >
                    <span className={`relative text-[18px] font-medium whitespace-nowrap ${textClasses}`}>
                      {tab.label}
                    </span>
                    
                    {/* Bite Count Indicator - Only show on Bites tab */}
                    {isBitesTab && selectedBiteOptions.length > 0 && (
                      <span className={`ml-[8px] text-[11px] font-medium px-[6px] py-[2px] rounded-full min-w-[20px] text-center ${
                        isActive ? 'bg-white text-[#009ace]' : 'bg-[#009ace] text-white'
                      }`}>
                        {biteCount}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Active tab action buttons - rename (additional only) + close (all non-first unscanned) */}
                {isActive && rename.editingId !== tab.id && !isFirstTab && (
                  <div className="flex gap-[4px] ml-[8px]">
                    {tab.type === 'additional' && (
                      <button
                        onClick={(e) => rename.startRename(tab.id, tab.label, e)}
                        className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] hover:bg-white/20 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-[14px] h-[14px] text-white" />
                      </button>
                    )}
                    {!hasScanned && (
                      <button
                        onClick={(e) => handleDeleteTab(e, tab.id)}
                        className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] hover:bg-white/20 transition-colors"
                        title="Remove scan"
                      >
                        <X className="w-[14px] h-[14px] text-white" />
                      </button>
                    )}
                  </div>
                )}
            </div>
          );
        })}

        {/* Add Tab Button */}
        <div className="relative ml-[8px] self-center">
          <button
            onClick={isDenturesDropdownEmpty ? undefined : handleAddClick}
            disabled={isDenturesDropdownEmpty}
            className={`w-[36px] h-[36px] flex items-center justify-center rounded-[6px] transition-colors z-20 ${isDenturesDropdownEmpty ? 'bg-white opacity-30 cursor-not-allowed' : 'bg-white hover:bg-[#f0f0f0]'}`}
          >
            <Plus className="w-[20px] h-[20px] text-[#5f6368]" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div 
              ref={dropdownRef}
              className="absolute left-[calc(100%+16px)] top-0 bg-white rounded-[8px] shadow-lg min-w-[280px] z-[70] border border-gray-200 overflow-hidden"
            >
              {/* Study Model - Only Additional bite */}
              {workflow === "study-model" && (
                <>
                  {!hasStudyModelAdditionalBite && (
                    <button
                      onClick={() => {
                        onStudyModelAdditionalBiteToggle?.();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Additional bite
                    </button>
                  )}
                </>
              )}

              {/* Fixed Restorative - Default menu */}
              {workflow === "fixed-restorative" && (
                <>
                  {!hasPreTreatment && (
                    <button
                      onClick={() => handleDropdownOptionClick("Pre-treatment")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Pre-treatment
                    </button>
                  )}
                  {canAddAdditionalScan && !maxTabsReached && (
                    <button
                      onClick={() => handleDropdownOptionClick("Additional scan")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Additional scan
                    </button>
                  )}
                  
                  {/* Additional bite - Always available in fixed-restorative */}
                  <div className="border-t border-gray-200">
                    <button
                      onClick={handleBiteToggle}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center justify-between whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      <span>Additional bite</span>
                      <svg
                        className="w-[20px] h-[20px] transition-transform"
                        style={{ transform: isBiteExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isBiteExpanded && (
                      <div className="bg-white">
                        {/* Additional bite options */}
                        {[
                          { key: "Additional centric", label: "Additional Centric" },
                          { key: "Left lateral", label: "Left lateral" },
                          { key: "Right lateral", label: "Right lateral" },
                          { key: "Protrusive", label: "Protrusive" },
                          { key: "Retrusive", label: "Retrusive" }
                        ].map(option => (
                          <label
                            key={option.key}
                            className="flex items-center gap-[16px] px-[16px] py-[8px] hover:bg-[#f5f5f5] transition-colors cursor-pointer h-[56px]"
                          >
                            <div className="relative shrink-0 size-[28px] flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedBiteOptions.includes(option.key)}
                                onChange={() => handleBiteCheckboxChange(option.key)}
                                className="sr-only"
                              />
                              <div 
                                className={`size-[20px] rounded-[4px] flex items-center justify-center transition-all ${
                                  selectedBiteOptions.includes(option.key)
                                    ? 'bg-[#009ace] border-0'
                                    : 'bg-white border border-[#939598]'
                                }`}
                              >
                                {selectedBiteOptions.includes(option.key) && (
                                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                                    <path d="M1 4.5L5 8.5L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-[18px] text-[#3e3d40] leading-[28px]" style={{ fontFamily: "'Roboto', sans-serif" }}>
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Dentures - Reference scan, Denture copy, Additional scan, Additional bites */}
              {workflow === "dentures" && (
                <>
                  {!hasReferenceScan && (
                    <button
                      onClick={() => handleDropdownOptionClick("Reference scan")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Reference scan
                    </button>
                  )}
                  {!hasCopyDenture && (
                    <button
                      onClick={() => handleDropdownOptionClick("Denture copy")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Denture copy
                    </button>
                  )}
                  {canAddAdditionalScanDentures && (
                    <button
                      onClick={() => handleDropdownOptionClick("Additional scan")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Additional scan
                    </button>
                  )}
                </>
              )}

              {/* Implant-based - Pre-treatment, Treatment scan, Emergence profile, Additional scan */}
              {workflow === "implant-based" && (
                <>
                  {!hasPreTreatment && (
                    <button
                      onClick={() => handleDropdownOptionClick("Pre-treatment")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Pre-treatment
                    </button>
                  )}
                  {canAddAdditionalScan && !maxTabsReached && (
                    <button
                      onClick={() => handleDropdownOptionClick("Additional scan")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Emergence profile
                    </button>
                  )}
                  <div className="border-t border-gray-200">
                    <button
                      onClick={handleBiteToggle}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center justify-between whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      <span>Additional bites</span>
                      <svg
                        className="w-[20px] h-[20px] transition-transform"
                        style={{ transform: isBiteExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isBiteExpanded && (
                      <div className="bg-white">
                        {/* Additional bite options */}
                        {[
                          { key: "Additional centric", label: "Additional Centric" },
                          { key: "Left lateral", label: "Left lateral" },
                          { key: "Right lateral", label: "Right lateral" },
                          { key: "Protrusive", label: "Protrusive" },
                          { key: "Retrusive", label: "Retrusive" }
                        ].map(option => (
                          <label
                            key={option.key}
                            className="flex items-center gap-[16px] px-[16px] py-[8px] hover:bg-[#f5f5f5] transition-colors cursor-pointer h-[56px]"
                          >
                            <div className="relative shrink-0 size-[28px] flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedBiteOptions.includes(option.key)}
                                onChange={() => handleBiteCheckboxChange(option.key)}
                                className="sr-only"
                              />
                              <div 
                                className={`size-[20px] rounded-[4px] flex items-center justify-center transition-all ${
                                  selectedBiteOptions.includes(option.key)
                                    ? 'bg-[#009ace] border-0'
                                    : 'bg-white border border-[#939598]'
                                }`}
                              >
                                {selectedBiteOptions.includes(option.key) && (
                                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                                    <path d="M1 4.5L5 8.5L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-[18px] text-[#3e3d40] leading-[28px]" style={{ fontFamily: "'Roboto', sans-serif" }}>
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Crown - Pre-treatment, Additional scan, Additional bites */}
              {workflow === "crown" && (
                <>
                  {!hasPreTreatment && (
                    <button
                      onClick={() => handleDropdownOptionClick("Pre-treatment")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Pre-treatment
                    </button>
                  )}
                  {canAddAdditionalScan && !maxTabsReached && (
                    <button
                      onClick={() => handleDropdownOptionClick("Additional scan")}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      Additional scan
                    </button>
                  )}
                  <div className="border-t border-gray-200">
                    <button
                      onClick={handleBiteToggle}
                      className="w-full text-left px-[20px] py-[14px] hover:bg-[#f5f5f5] transition-colors text-[16px] text-[#3e3d40] flex items-center justify-between whitespace-nowrap"
                      style={{ fontFamily: "'Roboto', sans-serif" }}
                    >
                      <span>Additional bite</span>
                      <svg
                        className="w-[20px] h-[20px] transition-transform"
                        style={{ transform: isBiteExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isBiteExpanded && (
                      <div className="bg-white">
                        {/* Additional bite options */}
                        {[
                          { key: "Additional centric", label: "Additional Centric" },
                          { key: "Left lateral", label: "Left lateral" },
                          { key: "Right lateral", label: "Right lateral" },
                          { key: "Protrusive", label: "Protrusive" },
                          { key: "Retrusive", label: "Retrusive" }
                        ].map(option => (
                          <label
                            key={option.key}
                            className="flex items-center gap-[16px] px-[16px] py-[8px] hover:bg-[#f5f5f5] transition-colors cursor-pointer h-[56px]"
                          >
                            <div className="relative shrink-0 size-[28px] flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedBiteOptions.includes(option.key)}
                                onChange={() => handleBiteCheckboxChange(option.key)}
                                className="sr-only"
                              />
                              <div 
                                className={`size-[20px] rounded-[4px] flex items-center justify-center transition-all ${
                                  selectedBiteOptions.includes(option.key)
                                    ? 'bg-[#009ace] border-0'
                                    : 'bg-white border border-[#939598]'
                                }`}
                              >
                                {selectedBiteOptions.includes(option.key) && (
                                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                                    <path d="M1 4.5L5 8.5L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-[18px] text-[#3e3d40] leading-[28px]" style={{ fontFamily: "'Roboto', sans-serif" }}>
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Wand Initializing Progress Bar - Aligned to the right */}
        {showWandInit && (
          <div 
            className="ml-auto self-center w-[264px] mr-[16px]"
            style={{
              opacity: wandInitProgress >= 100 ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
          >
            <ScanProgressBar progress={wandInitProgress} label="Wand is initializing" />
          </div>
        )}
      </div>

      {/* Bite Options Toggle Button and Floating Overlay - Show when on Additional bites tab */}
      {selectedBiteOptions.length > 0 && tabs.find(tab => tab.type === 'bite' && tab.id === activeTabId) && (
        <>
          {/* Toggle Button */}
          <button
            onClick={() => setIsBiteOverlayOpen(!isBiteOverlayOpen)}
            className="absolute left-[16px] top-[50px] z-30 px-[16px] py-[10px] rounded-[6px] bg-[#009ace] text-white hover:bg-[#0089b8] transition-colors shadow-md flex items-center gap-[8px]"
            style={{ fontFamily: "'Roboto', sans-serif" }}
          >
            <span className="text-[14px] font-medium">
              {isBiteOverlayOpen ? 'Hide Bites' : 'Show Bites'}
            </span>
            <ChevronDown 
              className={`w-[16px] h-[16px] transition-transform ${isBiteOverlayOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {/* Floating Overlay Panel */}
          {isBiteOverlayOpen && (
            <div 
              ref={overlayRef}
              className="absolute left-[16px] top-[94px] z-[80] bg-white rounded-[8px] shadow-2xl border border-gray-200 p-[20px] max-w-[calc(100vw-32px)]"
            >
              <div className="flex flex-wrap gap-[12px]">
                {/* Always show Centric bite as first option */}
                <button
                  onClick={() => {
                    onBiteOptionClick?.("Centric");
                    setIsBiteOverlayOpen(false);
                  }}
                  className={`px-[16px] py-[10px] rounded-[6px] text-[16px] transition-all ${
                    activeBiteOptions?.includes("Centric")
                      ? 'bg-[#009ace] text-white shadow-md'
                      : 'bg-transparent text-[#3e3d40] hover:bg-white/50 border border-gray-300'
                  }`}
                  style={{ fontFamily: "'Roboto', sans-serif" }}
                >
                  <div className={activeBiteOptions?.includes("Centric") ? '[&_path]:stroke-white' : ''}>
                    <div className="w-[48px] h-[32px]"><AdditionalCentric /></div>
                  </div>
                </button>
                
                {/* Show all selected additional bite options */}
                {selectedBiteOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      onBiteOptionClick?.(option);
                      setIsBiteOverlayOpen(false);
                    }}
                    className={`px-[16px] py-[10px] rounded-[6px] text-[16px] transition-all ${
                      activeBiteOptions?.includes(option)
                        ? 'bg-[#009ace] text-white shadow-md'
                        : 'bg-transparent text-[#3e3d40] hover:bg-white/50 border border-gray-300'
                    }`}
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    <div className={activeBiteOptions?.includes(option) ? '[&_path]:stroke-white' : ''}>
                      {getBiteIcon(option)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Study Model: Show 2 numbered centric bites below Main scan tab */}
      {workflow === "study-model" && hasStudyModelAdditionalBite && (
        <div className="absolute left-0 right-0 bg-transparent px-[16px] py-[12px] z-30">
          <div className="flex gap-[12px]">
            {/* Centric bite 1 */}
            <button
              onClick={() => onBiteOptionClick?.("Centric-1")}
              className={`px-[16px] py-[10px] rounded-[6px] text-[16px] transition-all relative ${
                activeBiteOptions?.includes("Centric-1")
                  ? 'bg-[#009ace] text-white shadow-md'
                  : 'bg-transparent text-[#3e3d40] hover:bg-white/50 border border-gray-300'
              }`}
              style={{ fontFamily: "'Roboto', sans-serif" }}
            >
              <div className={activeBiteOptions?.includes("Centric-1") ? '[&_path]:stroke-white' : ''}>
                <div className="w-[48px] h-[32px]"><AdditionalCentric /></div>
              </div>
              <span className={`absolute top-[2px] right-[2px] text-[10px] font-bold px-[4px] py-[1px] rounded ${
                activeBiteOptions?.includes("Centric-1") ? 'bg-white text-[#009ace]' : 'bg-[#009ace] text-white'
              }`}>1</span>
            </button>
            
            {/* Centric bite 2 */}
            <button
              onClick={() => onBiteOptionClick?.("Centric-2")}
              className={`px-[16px] py-[10px] rounded-[6px] text-[16px] transition-all relative ${
                activeBiteOptions?.includes("Centric-2")
                  ? 'bg-[#009ace] text-white shadow-md'
                  : 'bg-transparent text-[#3e3d40] hover:bg-white/50 border border-gray-300'
              }`}
              style={{ fontFamily: "'Roboto', sans-serif" }}
            >
              <div className={activeBiteOptions?.includes("Centric-2") ? '[&_path]:stroke-white' : ''}>
                <div className="w-[48px] h-[32px]"><AdditionalCentric /></div>
              </div>
              <span className={`absolute top-[2px] right-[2px] text-[10px] font-bold px-[4px] py-[1px] rounded ${
                activeBiteOptions?.includes("Centric-2") ? 'bg-white text-[#009ace]' : 'bg-[#009ace] text-white'
              }`}>2</span>
            </button>
          </div>
        </div>
      )}

      {/* Virtual Keyboard - slides up from bottom when renaming */}
      <AnimatePresence>
        {rename.isEditing && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[100]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25, ease: [0, 0, 1, 1] }}
          >
            <Keyboard
              onKeyPress={(char) => rename.insertChar(char)}
              onBackspace={() => rename.deleteChar()}
              onEnter={() => rename.confirmRename()}
              onClose={() => rename.cancelRename()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}