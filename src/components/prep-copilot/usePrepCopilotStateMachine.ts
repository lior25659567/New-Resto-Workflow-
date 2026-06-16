import { useState, useEffect, useRef, useCallback } from 'react';
import type { ViewId, MaterialType, CopilotPhase, AnalysisStatus, ZoneId, PrepCopilotState, CaseType, InsertionPathAngles } from './types';
import { ANALYSIS_DURATIONS, PHASE_DURATIONS, getFindings, getZoneReductions, OPTIMAL_INSERTION_PATH, computeUndercutSeverities } from './constants';

const VIEW_ORDER: ViewId[] = ['reduction', 'zones', 'undercuts', 'section'];

const INITIAL_ANALYSIS: Record<ViewId, AnalysisStatus> = {
  margin: 'pending',
  reduction: 'pending',
  insertion: 'pending',
  undercuts: 'pending',
  zones: 'pending',
  section: 'pending',
  crown: 'pending',
};

export interface StateMachineOptions {
  caseType?: CaseType;
  prepToothAda?: number | null;
  linkedTeeth?: number[];
}

export interface StateMachineResult {
  state: PrepCopilotState;
  setActiveView: (view: ViewId) => void;
  setSelectedMaterial: (material: MaterialType) => void;
  setSelectedZone: (zone: ZoneId | null) => void;
  setInsertionPath: (updates: Partial<InsertionPathAngles>) => void;
  resetInsertionPath: () => void;
  toggleBridgeMode: () => void;
  statusText: string;
  setModelsUploaded: () => void;
  setAlignmentComplete: (error: number) => void;
  setBrushedCount: (count: number) => void;
  startAnalysisFromBrush: () => void;
}

export function usePrepCopilotStateMachine(isActive: boolean, options?: StateMachineOptions): StateMachineResult {
  const [phase, setPhase] = useState<CopilotPhase>('idle');
  const [activeView, setActiveViewState] = useState<ViewId | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<Record<ViewId, AnalysisStatus>>({ ...INITIAL_ANALYSIS });
  const [overallProgress, setOverallProgress] = useState(0);
  const [selectedMaterial, setSelectedMaterialState] = useState<MaterialType>('bruxzir-esthetic');
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [statusText, setStatusText] = useState('');
  const [insertionPath, setInsertionPathState] = useState<InsertionPathAngles>(OPTIMAL_INSERTION_PATH);
  const [isBridgeMode, setIsBridgeMode] = useState(false);
  const [hasUserModels, setHasUserModels] = useState(false);
  const [alignmentError, setAlignmentError] = useState<number | null>(null);
  const [brushedVertexCount, setBrushedVertexCount] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const setActiveView = useCallback((view: ViewId) => {
    if (analysisProgress[view] === 'complete') {
      setActiveViewState(view);
      setPhase('viewing');
    }
  }, [analysisProgress]);

  const setSelectedMaterial = useCallback((material: MaterialType) => {
    setSelectedMaterialState(material);
  }, []);

  const setInsertionPath = useCallback((updates: Partial<InsertionPathAngles>) => {
    setInsertionPathState(prev => ({
      azimuth: Math.max(-30, Math.min(30, updates.azimuth ?? prev.azimuth)),
      elevation: Math.max(-15, Math.min(15, updates.elevation ?? prev.elevation)),
    }));
  }, []);

  const resetInsertionPath = useCallback(() => {
    setInsertionPathState(OPTIMAL_INSERTION_PATH);
  }, []);

  const toggleBridgeMode = useCallback(() => {
    setIsBridgeMode(prev => !prev);
  }, []);

  const setModelsUploaded = useCallback(() => {
    setHasUserModels(true);
    setPhase('aligning');
    setStatusText('Aligning models...');
  }, []);

  const setAlignmentCompleteAction = useCallback((error: number) => {
    setAlignmentError(error);
    setPhase('brushing');
    setStatusText('Define prep area');
  }, []);

  const setBrushedCount = useCallback((count: number) => {
    setBrushedVertexCount(count);
  }, []);

  const startAnalysisFromBrush = useCallback(() => {
    setPhase('detecting');
    setStatusText('Analyzing scan...');

    const t1 = setTimeout(() => {
      setPhase('detected');
      setStatusText('Prep detected');
    }, PHASE_DURATIONS.detecting);

    const t2 = setTimeout(() => {
      setPhase('analyzing');
      setStatusText('Running analysis...');
      startAnalysis();
    }, PHASE_DURATIONS.detecting + PHASE_DURATIONS.detected);

    timersRef.current.push(t1, t2);
  }, []);

  // Phase transitions
  useEffect(() => {
    if (!isActive) {
      clearTimers();
      setPhase('idle');
      setActiveViewState(null);
      setAnalysisProgress({ ...INITIAL_ANALYSIS });
      setOverallProgress(0);
      setSelectedZone(null);
      setStatusText('');
      setInsertionPathState(OPTIMAL_INSERTION_PATH);
      setIsBridgeMode(false);
      setHasUserModels(false);
      setAlignmentError(null);
      setBrushedVertexCount(0);
      return;
    }

    // Skip upload — default models are loaded automatically
    setHasUserModels(true);
    setPhase('analyzing');
    setStatusText('Analyzing prep...');
    startAnalysis();

    return clearTimers;
  }, [isActive, clearTimers]);

  function startAnalysis() {
    let cumulativeDelay = 0;
    const totalDuration = VIEW_ORDER.reduce((sum, v) => sum + ANALYSIS_DURATIONS[v], 0);
    let completedDuration = 0;

    VIEW_ORDER.forEach((view, idx) => {
      const startTimer = setTimeout(() => {
        setAnalysisProgress(prev => ({ ...prev, [view]: 'running' }));
      }, cumulativeDelay);
      timersRef.current.push(startTimer);

      cumulativeDelay += ANALYSIS_DURATIONS[view];
      completedDuration += ANALYSIS_DURATIONS[view];
      const progressAtEnd = Math.round((completedDuration / totalDuration) * 100);

      const endTimer = setTimeout(() => {
        setAnalysisProgress(prev => ({ ...prev, [view]: 'complete' }));
        setOverallProgress(progressAtEnd);

        if (idx === 0) {
          setActiveViewState('reduction');
          setPhase('viewing');
          setStatusText('');
        }

        if (idx === VIEW_ORDER.length - 1) {
          setPhase('ready');
        }
      }, cumulativeDelay);
      timersRef.current.push(endTimer);
    });
  }

  const findings = getFindings(selectedMaterial);
  const zoneReductions = getZoneReductions(selectedMaterial);
  const undercutSeverities = computeUndercutSeverities(insertionPath.azimuth, insertionPath.elevation);

  const state: PrepCopilotState = {
    phase,
    activeView,
    analysisProgress,
    overallProgress,
    selectedMaterial,
    selectedZone,
    findings,
    zoneReductions,
    caseType: options?.caseType ?? 'single-crown',
    prepToothAda: options?.prepToothAda ?? null,
    linkedTeeth: options?.linkedTeeth ?? [],
    isBridgeMode,
    insertionPath,
    undercutSeverities,
    hasUserModels,
    alignmentError,
    brushedVertexCount,
  };

  return {
    state,
    setActiveView,
    setSelectedMaterial,
    setSelectedZone,
    setInsertionPath,
    resetInsertionPath,
    toggleBridgeMode,
    statusText,
    setModelsUploaded,
    setAlignmentComplete: setAlignmentCompleteAction,
    setBrushedCount,
    startAnalysisFromBrush,
  };
}
