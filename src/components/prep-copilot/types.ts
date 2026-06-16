export type ViewId = 'margin' | 'reduction' | 'insertion' | 'undercuts' | 'zones' | 'section' | 'crown';

export type MaterialType =
  | 'bruxzir-esthetic'
  | 'bruxzir-full-strength'
  | 'emax'
  | 'lithium-disilicate'
  | 'pfm';

export type CopilotPhase = 'idle' | 'uploading' | 'aligning' | 'brushing' | 'detecting' | 'detected' | 'zooming' | 'analyzing' | 'ready' | 'viewing';

export type ZoneId = 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal';

export type AnalysisStatus = 'pending' | 'running' | 'complete';

export type FindingStatus = 'pass' | 'warning' | 'fail';

export type CaseType = 'single-crown' | 'bridge' | 'full-arch';

export type UndercutSeverityLevel = 0 | 1 | 2 | 3;

export interface InsertionPathAngles {
  /** Lateral (buccal/lingual) tilt in degrees. Positive = buccal. Range: -30 to +30. */
  azimuth: number;
  /** Anterior-posterior (mesial/distal) tilt in degrees. Positive = mesial. Range: -15 to +15. */
  elevation: number;
}

export interface ZoneUndercutSeverity {
  distal: UndercutSeverityLevel;
  mesial: UndercutSeverityLevel;
  buccal: UndercutSeverityLevel;
  lingual: UndercutSeverityLevel;
}

export interface MaterialThresholds {
  ideal: number;
  min: number;
}

export interface ZoneReduction {
  zone: ZoneId;
  measured: number;
  target: number;
  status: FindingStatus;
}

export interface ViewFinding {
  title: string;
  area?: string;
  measurement?: string;
  target?: string;
  status: FindingStatus;
  statusLabel: string;
  recommendation: string;
}

export interface PrepCopilotState {
  phase: CopilotPhase;
  activeView: ViewId | null;
  analysisProgress: Record<ViewId, AnalysisStatus>;
  overallProgress: number;
  selectedMaterial: MaterialType;
  selectedZone: ZoneId | null;
  findings: Record<ViewId, ViewFinding>;
  zoneReductions: ZoneReduction[];
  caseType: CaseType;
  prepToothAda: number | null;
  linkedTeeth: number[];
  isBridgeMode: boolean;
  insertionPath: InsertionPathAngles;
  undercutSeverities: ZoneUndercutSeverity;
  hasUserModels: boolean;
  alignmentError: number | null;
  brushedVertexCount: number;
}

export type ViewAngleLabel =
  | 'Occlusal'
  | 'Buccal'
  | 'Lingual'
  | 'Mesial'
  | 'Distal'
  | 'Interproximal';

export interface CameraPreset {
  theta: number;
  phi: number;
  radius: number;
}
