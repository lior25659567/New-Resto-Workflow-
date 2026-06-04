import type { MaterialType, MaterialThresholds, ViewId, ViewFinding, ZoneReduction, CameraPreset, ZoneId, CaseType, InsertionPathAngles, ZoneUndercutSeverity, UndercutSeverityLevel } from './types';

// ─── Material Thresholds ────────────────────────────────────────────────────
export const MATERIAL_THRESHOLDS: Record<MaterialType, MaterialThresholds> = {
  'bruxzir-esthetic': { ideal: 1.25, min: 0.7 },
  'bruxzir-full-strength': { ideal: 1.0, min: 0.5 },
  'emax': { ideal: 1.5, min: 1.0 },
  'lithium-disilicate': { ideal: 1.3, min: 0.8 },
  'pfm': { ideal: 1.2, min: 0.8 },
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  'bruxzir-esthetic': 'BruxZir Esthetic',
  'bruxzir-full-strength': 'BruxZir Full-Strength',
  'emax': 'IPS e.max',
  'lithium-disilicate': 'Lithium Disilicate',
  'pfm': 'PFM',
};

// ─── Camera Presets ─────────────────────────────────────────────────────────
// The upper jaw model is rotated ~108° around X (BASE_ROT_X = PI*0.6), so
// occlusal surfaces face roughly -Y. Camera phi ~2.0 looks from below (front view).
// Original camera: [0, -1.5, 3.5] → phi≈1.97, theta≈0, radius≈3.81
export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  occlusal: { theta: 0, phi: 2.4, radius: 3.0 },
  buccal: { theta: 0, phi: 1.8, radius: 3.5 },
  lingual: { theta: Math.PI, phi: 1.8, radius: 3.5 },
  mesial: { theta: Math.PI / 2, phi: 1.9, radius: 3.5 },
  distal: { theta: -Math.PI / 2, phi: 1.9, radius: 3.5 },
};

export const VIEW_CAMERA_PRESETS: Record<ViewId, CameraPreset> = {
  margin: CAMERA_PRESETS.occlusal,
  reduction: { theta: 0.1, phi: 2.0, radius: 3.2 },
  insertion: CAMERA_PRESETS.buccal,
  undercuts: { theta: -Math.PI / 3, phi: 1.85, radius: 3.2 },
  zones: CAMERA_PRESETS.occlusal,
  crown: { theta: 0.2, phi: 2.1, radius: 3.0 },
};

// ─── Analysis Timings (ms) ──────────────────────────────────────────────────
export const ANALYSIS_DURATIONS: Record<ViewId, number> = {
  margin: 1500,
  reduction: 2000,
  insertion: 1500,
  undercuts: 1500,
  zones: 1000,
  crown: 2500,
};

export const PHASE_DURATIONS = {
  detecting: 2000,
  detected: 500,
  zooming: 1500,
};

// ─── View Findings (simulated results) ──────────────────────────────────────
export function getFindings(material: MaterialType): Record<ViewId, ViewFinding> {
  const t = MATERIAL_THRESHOLDS[material];
  return {
    margin: {
      title: 'Margin Line Analysis',
      area: 'Cervical',
      measurement: '0.3 mm avg depth',
      status: 'pass',
      statusLabel: 'Continuous',
      recommendation: 'Chamfer or shoulder preferred',
    },
    reduction: {
      title: 'Reduction Analysis',
      area: 'Occlusal',
      measurement: `1.1 mm (target ${t.ideal} mm)`,
      target: `${t.ideal} mm ideal`,
      status: 'warning',
      statusLabel: 'Below ideal',
      recommendation: 'Increase occlusal reduction',
    },
    insertion: {
      title: 'Insertion Path',
      area: 'Axial',
      measurement: '2.3° deviation',
      status: 'pass',
      statusLabel: 'Within range',
      recommendation: 'Axial walls convergent',
    },
    undercuts: {
      title: 'Undercut Analysis',
      area: 'Distal wall',
      measurement: '0.12 mm depth',
      status: 'warning',
      statusLabel: 'Minor undercut',
      recommendation: 'Adjust distal wall angle',
    },
    zones: {
      title: 'Zone Inspection',
      area: 'All zones',
      status: 'pass',
      statusLabel: 'Select a zone',
      recommendation: 'Click a zone to inspect',
    },
    crown: {
      title: 'Crown Preview',
      area: 'Full prep',
      status: 'pass',
      statusLabel: 'Generated',
      recommendation: 'AI-assisted crown design',
    },
  };
}

// ─── Zone Reductions (simulated) ────────────────────────────────────────────
export function getZoneReductions(material: MaterialType): ZoneReduction[] {
  const t = MATERIAL_THRESHOLDS[material];
  return [
    { zone: 'occlusal', measured: 1.1, target: t.ideal, status: t.ideal <= 1.1 ? 'pass' : 'warning' },
    { zone: 'buccal', measured: 0.9, target: t.min, status: 0.9 >= t.min ? 'pass' : 'fail' },
    { zone: 'lingual', measured: 0.8, target: t.min, status: 0.8 >= t.min ? 'pass' : 'fail' },
    { zone: 'mesial', measured: 0.85, target: t.min, status: 0.85 >= t.min ? 'pass' : 'fail' },
    { zone: 'distal', measured: 0.6, target: t.min, status: 0.6 >= t.min ? 'warning' : 'fail' },
  ];
}

export const ZONE_LABELS: Record<ZoneId, string> = {
  occlusal: 'Occlusal',
  buccal: 'Buccal',
  lingual: 'Lingual',
  mesial: 'Mesial',
  distal: 'Distal',
};

// ─── Existing Overlay Data (preserved) ──────────────────────────────────────
export const MARGIN_LINE_POINTS: [number, number, number][] = [
  [-0.8, 0.2, -0.3],
  [-0.7, 0.35, -0.25],
  [-0.55, 0.4, -0.15],
  [-0.4, 0.38, -0.05],
  [-0.3, 0.3, 0.05],
  [-0.25, 0.2, 0.1],
  [-0.3, 0.1, 0.05],
  [-0.4, 0.05, -0.05],
  [-0.55, 0.03, -0.15],
  [-0.7, 0.08, -0.25],
  [-0.8, 0.2, -0.3],
];

export const HEATMAP_COLORS = [
  { threshold: 0.3, color: [0.85, 0.1, 0.1] },
  { threshold: 0.5, color: [1.0, 0.3, 0.1] },
  { threshold: 0.7, color: [1.0, 0.55, 0.1] },
  { threshold: 0.9, color: [1.0, 0.8, 0.0] },
  { threshold: 1.1, color: [0.7, 0.9, 0.0] },
  { threshold: 1.3, color: [0.2, 0.85, 0.2] },
  { threshold: 1.6, color: [0.1, 0.7, 0.6] },
  { threshold: 2.0, color: [0.1, 0.5, 0.9] },
  { threshold: 2.5, color: [0.2, 0.2, 0.8] },
] as const;

export const INSERTION_ARROW = {
  position: [-0.5, 1.2, -0.1] as [number, number, number],
  direction: [0.05, -1, 0.02] as [number, number, number],
  length: 1.0,
};

export const PREP_CENTER: [number, number, number] = [-0.5, 0.25, -0.1];
export const PREP_RADIUS = 0.35;

export const CROWN_PARAMS = {
  position: [-0.5, 0.45, -0.1] as [number, number, number],
  radiusTop: 0.18,
  radiusBottom: 0.22,
  height: 0.35,
};

export const PANEL_WIDTH = 360;

// ─── Insertion Path ─────────────────────────────────────────────────────────
export const OPTIMAL_INSERTION_PATH: InsertionPathAngles = { azimuth: 0, elevation: 0 };

// ─── Undercut Severity Colours ───────────────────────────────────────────────
export const UNDERCUT_SEVERITY_COLORS: Record<UndercutSeverityLevel, { color: string; label: string; bg: string; text: string }> = {
  0: { color: '#16a34a', label: 'None',     bg: '#dcfce7', text: '#166534' },
  1: { color: '#ca8a04', label: 'Minor',    bg: '#fef9c3', text: '#713f12' },
  2: { color: '#f97316', label: 'Moderate', bg: '#ffedd5', text: '#7c2d12' },
  3: { color: '#dc2626', label: 'Severe',   bg: '#fee2e2', text: '#7f1d1d' },
};

/**
 * Simulates undercut severity per zone based on the insertion path angles.
 * At the optimal path (0°, 0°) a minor distal undercut is always present
 * (clinically realistic for most crown preps).  Tilting the path away from
 * optimal progressively exposes additional undercuts on the corresponding
 * axial walls.
 */
export function computeUndercutSeverities(azimuth: number, elevation: number): ZoneUndercutSeverity {
  // Positive azimuth = buccal tilt → distal wall undercut exposure
  const distalBase: UndercutSeverityLevel = azimuth >= 20 ? 3 : azimuth >= 10 ? 2 : azimuth >= 3 ? 1 : 0;
  // Always keep a minor distal undercut at optimal path (realistic baseline)
  const distal: UndercutSeverityLevel = (azimuth === 0 && elevation === 0) ? 1 : distalBase;

  // Negative azimuth = lingual tilt → mesial wall undercut exposure
  const mesial: UndercutSeverityLevel = azimuth <= -20 ? 3 : azimuth <= -10 ? 2 : azimuth <= -3 ? 1 : 0;

  // Positive elevation = mesial tilt → buccal wall
  const buccal: UndercutSeverityLevel = elevation >= 12 ? 2 : elevation >= 6 ? 1 : 0;

  // Negative elevation = distal tilt → lingual wall
  const lingual: UndercutSeverityLevel = elevation <= -12 ? 2 : elevation <= -6 ? 1 : 0;

  return { distal, mesial, buccal, lingual };
}

/** Returns the severity colour hex for a given level. */
export function getSeverityColor(severity: UndercutSeverityLevel): string {
  return UNDERCUT_SEVERITY_COLORS[severity].color;
}

/** Derives case type, primary tooth ADA, and linked teeth from toothTreatments map. */
export function detectCaseFromTreatments(
  toothTreatments?: Record<string, string>
): { caseType: CaseType; prepToothAda: number | null; linkedTeeth: number[] } {
  if (!toothTreatments) return { caseType: 'single-crown', prepToothAda: null, linkedTeeth: [] };

  const crownTeeth = Object.entries(toothTreatments)
    .filter(([, t]) => t === 'Crown' || t === 'Implant based')
    .map(([tooth]) => parseInt(tooth, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  if (crownTeeth.length === 0) return { caseType: 'single-crown', prepToothAda: null, linkedTeeth: [] };
  if (crownTeeth.length >= 2) return { caseType: 'bridge', prepToothAda: crownTeeth[0], linkedTeeth: crownTeeth };
  return { caseType: 'single-crown', prepToothAda: crownTeeth[0], linkedTeeth: crownTeeth };
}

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  'single-crown': 'Crown',
  'bridge': 'Bridge',
  'full-arch': 'Full Arch',
};
