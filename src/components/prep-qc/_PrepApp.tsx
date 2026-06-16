import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  Magnet,
  Scissors,
  RotateCcw,
  Stethoscope,
  Move,
  RotateCw,
  X,
  Layers,
  SquareDashedBottom,
  PenLine,
  Columns3,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ArrowDownToLine,
  Circle,
} from "lucide-react";
import {
  createScene,
  frameObjects,
  applyDistanceHeatmap,
  type SceneHandle,
  type UndercutResult,
} from "./three-utils";
import {
  type CrossSectionData,
  type SectionViewMode,
  type UndercutAxisMode,
  runUndercutAnalysis,
  makeInsertionArrow,
  makeDraggableInsertionArrow,
  arrowDirection,
  disposeArrowGroup,
  computeCrossSectionProfiles,
  computeReductionStats,
  buildMarginLine,
} from "./prep-geometry";
import {
  countLabel,
  regionMask,
  regionLabelValue,
  type PrepRegion,
  LABEL_PREP,
  LABEL_MARGINAL,
  LABEL_OCCLUSAL,
} from "./prep-label";
import {
  type PreState,
  MATERIALS,
  getMaterial,
  regionTargetMm,
  regionMinMm,
  applyCamera,
} from "./pre-state";
import { Legend, SectionPanel } from "./_prep-ui";

// ---------------------------------------------------------------------------
// Main App — analysis-only stage. Consumes a PreState produced by the guided
// Pre-Entry stage and never re-runs any preprocessing. All heavy lifting
// (undercut solve, heatmap, cross-section profiles) is delegated to the shared
// prep-geometry module, so there is a single source of truth for the math.
// ---------------------------------------------------------------------------

type AppMode = "undercut" | "reduction" | "section";
type SectionGizmoMode = "translate" | "rotate";

// ---------------------------------------------------------------------------
// Clinical check model. The five QC tasks the clinician steps through map onto
// the three underlying 3D engines we already have (reduction-distance, undercut
// solve, cross-section). Splitting them by anatomical intent — instead of by
// engine — is what makes the panel read as a focused checklist rather than a
// pile of toggles.
// ---------------------------------------------------------------------------
type CheckId =
  | "margin"
  | "undercut"
  | "reduction"
  | "occlusal"
  | "interproximal";
type CheckStatus = "pass" | "warn" | "fail" | "na";

// Which 3D engine + (for reduction-family checks) which prep region each task
// drives. Margin/occlusal reuse the reduction heatmap scoped to their region;
// interproximal opens the cross-section tool for a visual slice review.
const CHECK_MODE: Record<CheckId, AppMode> = {
  margin: "reduction",
  undercut: "undercut",
  reduction: "reduction",
  occlusal: "reduction",
  interproximal: "section",
};
const CHECK_REGION: Record<CheckId, PrepRegion> = {
  margin: "marginal",
  undercut: "all",
  reduction: "all",
  occlusal: "occlusal",
  interproximal: "all",
};
const CHECK_META: Record<
  CheckId,
  { label: string; icon: typeof PenLine; blurb: string }
> = {
  margin: {
    label: "Margin line",
    icon: PenLine,
    blurb: "Clearance along the finish line.",
  },
  undercut: {
    label: "Undercuts",
    icon: Magnet,
    blurb: "Walls that trap the insertion path.",
  },
  reduction: {
    label: "Reduction depth",
    icon: ArrowDownToLine,
    blurb: "Overall material removed vs. target.",
  },
  occlusal: {
    label: "Occlusal space",
    icon: Layers,
    blurb: "Clearance on the occlusal table.",
  },
  interproximal: {
    label: "Interproximal space",
    icon: Columns3,
    blurb: "Proximal clearance to the neighbours.",
  },
};
const CHECK_ORDER: CheckId[] = [
  "margin",
  "reduction",
  "occlusal",
  "interproximal",
  "undercut",
];

type CheckInfo = {
  id: CheckId;
  status: CheckStatus;
  value: string;
  detail: string;
};

// The three crown materials surfaced in the panel (id → display label). Each
// has its own reduction thresholds, so switching material re-judges the prep.
const DISPLAY_MATERIALS: { id: string; label: string }[] = [
  { id: "zirconia", label: "Zirconia" },
  { id: "pfm", label: "Porcelain" },
  { id: "fullgold", label: "Gold" },
];

type MaterialImpact = {
  id: string;
  label: string;
  targetMm: number;
  status: CheckStatus; // pass / warn / fail / na for the whole prep
};

// Draft tolerance is fixed at 0° (any wall past parallel is a true undercut);
// manual aiming is done by dragging the 3D arrow instead of angle sliders.
const DRAFT_TOL_DEG = 0;

// Per-region clearance read-out shown in the reduction card.
type RegionReductionStat = {
  region: PrepRegion;
  label: string;
  pass: boolean;
  minMm: number;
  targetMm: number;
};

type SectionXform = { origin: THREE.Vector3; quaternion: THREE.Quaternion };

// True when any prep sub-region (generic prep / marginal / occlusal) is marked.
function hasPrepLabels(labels: Uint8Array): boolean {
  return (
    countLabel(labels, LABEL_PREP) +
      countLabel(labels, LABEL_MARGINAL) +
      countLabel(labels, LABEL_OCCLUSAL) >
    0
  );
}

export function PrepApp({
  state,
  onReDrill,
  onClose,
  autoAccept = false,
}: {
  state: PreState;
  onReDrill: () => void;
  onClose?: () => void;
  // When the prep was auto-built we skip the "Preparation detected" gate and
  // open straight on the QC panel.
  autoAccept?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const preMeshRef = useRef<THREE.Mesh | null>(null);
  const txMeshRef = useRef<THREE.Mesh | null>(null);
  const txSolidMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const txHeatMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const arrowRef = useRef<THREE.Group | null>(null);
  const marginLineRef = useRef<THREE.LineLoop | null>(null);
  // Manual insertion axis (driven by the draggable arrow) + its rotate gizmo.
  const manualAxisRef = useRef<THREE.Vector3 | null>(null);
  const manualArrowTcRef = useRef<TransformControls | null>(null);
  // Mirror of insertionGizmo so the arrow effect can read it without depending
  // on it (which would rebuild the gizmo whenever the mode toggles).
  const insertionGizmoRef = useRef<"aim" | "move">("aim");
  // Cross-section gizmo plumbing.
  const sectionGroupRef = useRef<THREE.Group | null>(null);
  const sectionPlaneRef = useRef<THREE.Mesh | null>(null);
  const sectionEdgesRef = useRef<THREE.LineSegments | null>(null);
  const sectionTcRef = useRef<TransformControls | null>(null);
  // Live (mid-drag) section transform — read by the profile memo without
  // rebuilding the gizmo, so the cross-section updates as the plane moves.
  const sectionLiveXformRef = useRef<SectionXform | null>(null);
  // Clip mode: shared clipping plane mutated live during drag, plus the
  // separate group holding the on-model 3D contour outline at the cut.
  const clipPlaneRef = useRef<THREE.Plane | null>(null);
  const sectionContourRef = useRef<THREE.Group | null>(null);
  // Latest computed cut data, mirrored into a ref so the gizmo effect can size
  // the plane to the actual prep extent without depending on (and rebuilding
  // mid-drag from) the cross-section memo.
  const crossSectionDataRef = useRef<CrossSectionData[]>([]);

  // Auto Prep Check confirmation gate — shown until the user accepts. Skipped
  // entirely when the prep was auto-built (we open straight on the QC panel).
  const [accepted, setAccepted] = useState(autoAccept);
  // The active clinical check drives everything: it derives the 3D engine
  // (`mode`) and the scoped prep region below. Start on reduction depth.
  const [activeCheck, setActiveCheck] = useState<CheckId>("reduction");
  const [mode, setMode] = useState<AppMode>("reduction");
  const [materialId, setMaterialId] = useState(MATERIALS[0].id);
  // Flips true once the meshes are mounted, so the all-checks status memo can
  // run its geometry queries (which need a live, world-transformed mesh).
  const [meshReady, setMeshReady] = useState(false);

  // Insertion-path controls: an Optimized solve and a hand-aimed Manual path.
  // Start Optimized so the prep is judged against its best path.
  const [axisMode, setAxisMode] = useState<UndercutAxisMode>("optimized");
  // Manual insertion path tilt (degrees) relative to the natural occlusal axis:
  // x = mesiodistal lean, y = buccolingual lean. The panel sliders drive these
  // and the undercut heatmap + area update live as they change.
  const [insertionTilt, setInsertionTilt] = useState({ x: 0, y: 0 });
  // 3D-arrow gizmo mode: "aim" rotates the withdrawal direction, "move"
  // translates the arrow so it can be repositioned over the prep.
  const [insertionGizmo, setInsertionGizmo] = useState<"aim" | "move">("aim");
  const [heatStep, setHeatStep] = useState<0.1 | 0.2>(0.1);
  const [undercutRecomputeKey, setUndercutRecomputeKey] = useState(0);

  const [undercutResult, setUndercutResult] = useState<UndercutResult | null>(
    null,
  );

  // Reduction-heatmap controls.
  const [heatRegion, setHeatRegion] = useState<PrepRegion>("all");
  const [showOnlyMarked, setShowOnlyMarked] = useState(true);

  // Cross-section: which saved cut, its live (gizmo-driven) transform, and the
  // Move/Rotate gizmo mode. The transform replaces the old offset-only slider.
  const [activeSectionId, setActiveSectionId] = useState<number>(
    state.defaultSectionId,
  );
  const [sectionXform, setSectionXform] = useState<SectionXform | null>(null);
  const [sectionGizmoMode, setSectionGizmoMode] =
    useState<SectionGizmoMode>("translate");
  // Bumped (throttled) during a gizmo drag to recompute the live profile.
  const [sectionProfileKey, setSectionProfileKey] = useState(0);
  // "clip" slices the model to reveal the cut face; "overlay" shows a
  // translucent plane over the full model. Default to the slice so the
  // cross-section is visible immediately.
  const [sectionViewMode, setSectionViewMode] =
    useState<SectionViewMode>("clip");

  const material = getMaterial(materialId);

  // --- Build the scene from the PreState ---------------------------------
  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createScene(hostRef.current, { background: "#D6E7F1" });
    sceneRef.current = handle;

    const preMat = new THREE.MeshStandardMaterial({
      color: 0xeab895,
      roughness: 0.38,
      metalness: 0.0,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
    });
    const txSolid = new THREE.MeshStandardMaterial({
      color: 0xf2ead6,
      roughness: 0.32,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 1,
    });
    const txHeat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 1,
    });
    txSolidMatRef.current = txSolid;
    txHeatMatRef.current = txHeat;

    const preMesh = new THREE.Mesh(state.preGeom, preMat);
    const txMesh = new THREE.Mesh(state.txGeom, txSolid);

    // Restore the exact transforms captured at hand-off (no re-alignment).
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    state.preMatrix.decompose(p, q, s);
    preMesh.position.copy(p);
    preMesh.quaternion.copy(q);
    preMesh.scale.copy(s);
    state.txMatrix.decompose(p, q, s);
    txMesh.position.copy(p);
    txMesh.quaternion.copy(q);
    txMesh.scale.copy(s);

    handle.scene.add(preMesh);
    handle.scene.add(txMesh);
    preMeshRef.current = preMesh;
    txMeshRef.current = txMesh;

    frameObjects(handle, [preMesh, txMesh]);
    // Bound zoom proportionally to the model so scroll-zoom can't fly away or
    // punch through the prep — matching the scan/view jaw viewers' clamped feel.
    state.txGeom.computeBoundingSphere();
    const rad = state.txGeom.boundingSphere?.radius ?? 25;
    handle.controls.minDistance = rad * 0.4;
    handle.controls.maxDistance = rad * 12;
    handle.controls.update();
    setMeshReady(true);

    return () => {
      handle.dispose();
      sceneRef.current = null;
      preMeshRef.current = null;
      txMeshRef.current = null;
      txSolidMatRef.current = null;
      txHeatMatRef.current = null;
      arrowRef.current = null;
      setMeshReady(false);
    };
  }, [state]);

  // Active check → 3D engine + scoped region. Keeping `mode`/`heatRegion` as
  // derived state (rather than threading the check id through every effect)
  // leaves all the existing scene effects untouched.
  useEffect(() => {
    setMode(CHECK_MODE[activeCheck]);
    if (CHECK_MODE[activeCheck] === "reduction") {
      setHeatRegion(CHECK_REGION[activeCheck]);
    }
  }, [activeCheck]);

  // --- Mode switch: pick materials + visibility --------------------------
  useEffect(() => {
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (!preMesh || !txMesh) return;
    if (mode === "undercut") {
      if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
      preMesh.visible = false;
    } else if (mode === "reduction") {
      if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
      preMesh.visible = true;
      const m = preMesh.material as THREE.MeshStandardMaterial;
      m.opacity = 0.15;
    } else {
      if (txSolidMatRef.current) txMesh.material = txSolidMatRef.current;
      preMesh.visible = true;
      const m = preMesh.material as THREE.MeshStandardMaterial;
      m.opacity = 0.32;
    }
  }, [mode]);

  // --- Undercut analysis (shared solver) ---------------------------------
  useEffect(() => {
    if (mode !== "undercut") {
      setUndercutResult(null);
      return;
    }
    const txMesh = txMeshRef.current;
    if (!txMesh) return;
    txMesh.updateMatrixWorld(true);
    const labels = state.labels;

    // Manual mode: the withdrawal axis is whatever the draggable arrow points
    // at. Seed it once (from the last solve, else the persisted insertion
    // vector) when the user first enters Manual.
    if (axisMode !== "manual") {
      manualAxisRef.current = null;
    } else if (!manualAxisRef.current) {
      manualAxisRef.current =
        undercutResult?.insertionAxis.clone() ??
        new THREE.Vector3().fromArray(state.insertionAxis);
    }
    const manualAxis =
      axisMode === "manual" ? (manualAxisRef.current ?? undefined) : undefined;

    const out = runUndercutAnalysis(txMesh, state.txGeom, labels, {
      axisMode,
      draftTolDeg: DRAFT_TOL_DEG,
      manualAxis,
    });
    if (!out) {
      setUndercutResult(null);
      return;
    }
    state.txGeom.setAttribute(
      "color",
      new THREE.BufferAttribute(out.colors, 3),
    );
    if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
    setUndercutResult(out.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, state, axisMode, undercutRecomputeKey]);

  // --- Static insertion-axis arrow (Optimized read-out) ------------------
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle) return;
    const disposeArrow = () => {
      if (!arrowRef.current) return;
      handle.scene.remove(arrowRef.current);
      disposeArrowGroup(arrowRef.current);
      arrowRef.current = null;
    };
    // In Manual mode the draggable-arrow effect owns arrowRef (arrow + gizmo);
    // this read-out effect must not touch it, or a live recompute would dispose
    // the manual arrow out from under its TransformControls.
    if (mode === "undercut" && axisMode === "manual") return;
    disposeArrow();
    if (mode !== "undercut" || !undercutResult) return;
    const txMesh = txMeshRef.current;
    state.txGeom.computeBoundingSphere();
    const radius =
      (state.txGeom.boundingSphere?.radius ?? 10) * (txMesh?.scale.x ?? 1);
    const group = makeInsertionArrow(
      undercutResult.insertionAxis,
      undercutResult.center,
      radius,
    );
    handle.scene.add(group);
    arrowRef.current = group;
    return disposeArrow;
  }, [mode, axisMode, undercutResult, state]);

  // --- Draggable insertion arrow (Manual mode) ---------------------------
  // A rotate gizmo re-aims the arrow; on drag end it commits the new axis and
  // triggers a live undercut recompute. Independent of `undercutResult` so a
  // recompute never rebuilds (and snaps back) the handle under the user.
  useEffect(() => {
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    if (!handle || !txMesh) return;
    if (mode !== "undercut" || axisMode !== "manual") return;

    if (!manualAxisRef.current) {
      manualAxisRef.current =
        undercutResult?.insertionAxis.clone() ??
        new THREE.Vector3().fromArray(state.insertionAxis);
    }
    txMesh.updateMatrixWorld(true);
    state.txGeom.computeBoundingSphere();
    const bs = state.txGeom.boundingSphere;
    const radius = (bs?.radius ?? 10) * (txMesh.scale.x ?? 1);
    const center =
      undercutResult?.center.clone() ??
      (bs
        ? bs.center.clone().applyMatrix4(txMesh.matrixWorld)
        : new THREE.Vector3());

    const group = makeDraggableInsertionArrow(
      manualAxisRef.current,
      center,
      radius,
    );
    handle.scene.add(group);
    arrowRef.current = group;

    const tc = new TransformControls(handle.camera, handle.renderer.domElement);
    tc.attach(group);
    tc.setMode(insertionGizmoRef.current === "move" ? "translate" : "rotate");
    tc.setSize(0.9);
    // Live recompute while aiming: re-solve undercuts as the arrow rotates,
    // throttled to keep the interaction smooth. The draggable arrow effect does
    // not depend on the recompute key, so the handle never rebuilds mid-drag.
    let lastRecompute = 0;
    tc.addEventListener("objectChange", () => {
      manualAxisRef.current = arrowDirection(group);
      const now = performance.now();
      if (now - lastRecompute < 60) return;
      lastRecompute = now;
      setUndercutRecomputeKey((k) => k + 1);
    });
    tc.addEventListener("dragging-changed", (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      handle.controls.enabled = !dragging;
      if (!dragging) {
        // Final, un-throttled solve at the released orientation.
        manualAxisRef.current = arrowDirection(group);
        setUndercutRecomputeKey((k) => k + 1);
      }
    });
    handle.scene.add(tc.getHelper());
    manualArrowTcRef.current = tc;

    return () => {
      // Re-enable orbit controls in case we tear down mid-drag.
      handle.controls.enabled = true;
      tc.detach();
      handle.scene.remove(tc.getHelper());
      tc.dispose();
      manualArrowTcRef.current = null;
      if (arrowRef.current) {
        handle.scene.remove(arrowRef.current);
        disposeArrowGroup(arrowRef.current);
        arrowRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, axisMode, state]);

  // --- Reduction heatmap (region + material aware) -----------------------
  useEffect(() => {
    if (mode !== "reduction") return;
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (!preMesh || !txMesh) return;
    preMesh.updateMatrixWorld(true);
    txMesh.updateMatrixWorld(true);
    const labels = state.labels;
    const haveLabels = hasPrepLabels(labels);
    // Scope the heatmap to the selected region. "All" without show-only-marked
    // falls back to the whole prep surface (no mask).
    const mask =
      haveLabels && (heatRegion !== "all" || showOnlyMarked)
        ? regionMask(labels, heatRegion)
        : null;
    // Color ramp tops out at the region's reduction target so "full color"
    // means adequate clearance for that region/material.
    const maxDistance = Math.max(regionTargetMm(heatRegion, material), 0.2);
    applyDistanceHeatmap(
      state.txGeom,
      txMesh.matrixWorld,
      state.preGeom,
      preMesh.matrixWorld,
      maxDistance,
      mask,
      heatStep,
    );
    if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
  }, [mode, state, material, heatStep, heatRegion, showOnlyMarked]);

  // --- Margin line overlay (margin task only) ----------------------------
  // Traces the finish line as a bright loop on the model so the clinician sees
  // the actual margin, not just the heatmap band scoped to it.
  useEffect(() => {
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    const remove = () => {
      if (handle && marginLineRef.current) {
        handle.scene.remove(marginLineRef.current);
        marginLineRef.current.geometry.dispose();
        (marginLineRef.current.material as THREE.Material).dispose();
        marginLineRef.current = null;
      }
    };
    remove();
    if (!handle || !txMesh || activeCheck !== "margin") return;
    txMesh.updateMatrixWorld(true);
    const line = buildMarginLine(
      state.txGeom,
      txMesh.matrixWorld,
      state.labels,
      state.prepFrame,
    );
    if (line) {
      handle.scene.add(line);
      marginLineRef.current = line;
    }
    return remove;
  }, [activeCheck, state]);

  // --- Per-region marked counts ------------------------------------------
  const { prepCount, marginalCount, occlusalCount } = useMemo(() => {
    const labels = state.labels;
    const prepOnly = countLabel(labels, LABEL_PREP);
    const marginal = countLabel(labels, LABEL_MARGINAL);
    const occlusal = countLabel(labels, LABEL_OCCLUSAL);
    return {
      prepCount: prepOnly + marginal + occlusal,
      marginalCount: marginal,
      occlusalCount: occlusal,
    };
  }, [state]);

  // --- Per-region reduction sufficiency (material-aware) -----------------
  const reductionStats = useMemo<RegionReductionStat[]>(() => {
    if (mode !== "reduction") return [];
    const labels = state.labels;
    if (!hasPrepLabels(labels)) return [];
    const regions: { region: PrepRegion; label: string; count: number }[] =
      heatRegion === "all"
        ? [
            { region: "all", label: "All", count: prepCount },
            { region: "marginal", label: "Marginal", count: marginalCount },
            { region: "occlusal", label: "Occlusal", count: occlusalCount },
          ]
        : heatRegion === "marginal"
          ? [{ region: "marginal", label: "Marginal", count: marginalCount }]
          : [{ region: "occlusal", label: "Occlusal", count: occlusalCount }];
    const out: RegionReductionStat[] = [];
    for (const { region, label, count } of regions) {
      if (count === 0) continue;
      const stats = computeReductionStats(
        state.txGeom,
        state.txMatrix,
        state.preGeom,
        state.preMatrix,
        labels,
        regionMinMm(region, material),
        regionTargetMm(region, material),
        regionLabelValue(region),
      );
      if (!stats) continue;
      out.push({
        region,
        label,
        pass: stats.pass,
        minMm: stats.minMm,
        targetMm: regionTargetMm(region, material),
      });
    }
    return out;
  }, [mode, state, material, heatRegion, prepCount, marginalCount, occlusalCount]);

  // --- All-checks status (mode-independent) ------------------------------
  // Runs once per state/material change so the checklist chips and the smart
  // suggestion always reflect every task — not just the one on screen. The
  // reduction-family checks reuse computeReductionStats per region; the
  // undercut check runs the optimized solve once (we read only its summary,
  // the on-model recolouring stays owned by the undercut-mode effect).
  const checks = useMemo<Record<CheckId, CheckInfo>>(() => {
    const na = (id: CheckId, detail: string): CheckInfo => ({
      id,
      status: "na",
      value: "—",
      detail,
    });
    const result: Record<CheckId, CheckInfo> = {
      margin: na("margin", "Not marked"),
      undercut: na("undercut", "Analyzing…"),
      reduction: na("reduction", "Not marked"),
      occlusal: na("occlusal", "Not marked"),
      interproximal: na("interproximal", "Visual review"),
    };
    const labels = state.labels;
    if (!meshReady || !hasPrepLabels(labels)) return result;

    // Reduction-family: margin, reduction (all), occlusal.
    const regionFor: Record<"margin" | "reduction" | "occlusal", PrepRegion> = {
      margin: "marginal",
      reduction: "all",
      occlusal: "occlusal",
    };
    (["margin", "reduction", "occlusal"] as const).forEach((id) => {
      const region = regionFor[id];
      const target = regionTargetMm(region, material);
      const s = computeReductionStats(
        state.txGeom,
        state.txMatrix,
        state.preGeom,
        state.preMatrix,
        labels,
        regionMinMm(region, material),
        target,
        regionLabelValue(region),
      );
      if (!s) return; // stays "Not marked"
      const status: CheckStatus = !s.pass
        ? "fail"
        : s.pctBelowTarget >= 15
          ? "warn"
          : "pass";
      result[id] = {
        id,
        status,
        value: `${s.minMm.toFixed(2)} mm`,
        detail: `min · target ${target.toFixed(1)} mm`,
      };
    });

    // Undercut: optimized solve, summary only.
    const txMesh = txMeshRef.current;
    if (txMesh) {
      const out = runUndercutAnalysis(txMesh, state.txGeom, labels, {
        axisMode: "optimized",
        draftTolDeg: DRAFT_TOL_DEG,
      });
      if (out) {
        const pct = out.result.undercutAreaPct;
        const status: CheckStatus =
          pct > 2 ? "fail" : pct > 0.5 ? "warn" : "pass";
        result.undercut = {
          id: "undercut",
          status,
          value: `${pct.toFixed(1)}%`,
          detail: "of the prep wall undercuts",
        };
      }
    }

    // Interproximal stays a guided visual review (cross-section slice).
    if (state.sections.length > 0) {
      result.interproximal = {
        id: "interproximal",
        status: "na",
        value: "Review",
        detail: "Slice through the contact",
      };
    }
    return result;
    // runUndercutAnalysis recolours state.txGeom as a side effect; re-running
    // when the undercut-mode effect also recolours is harmless and idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, material, meshReady]);

  // --- Smart suggestion: surface the single most important issue ---------
  const suggestion = useMemo(() => {
    const rank: Record<CheckStatus, number> = { fail: 0, warn: 1, na: 2, pass: 3 };
    // Only the four quantitative checks can drive an actionable suggestion.
    const quant: CheckId[] = ["margin", "undercut", "reduction", "occlusal"];
    const worst = quant
      .map((id) => checks[id])
      .filter((c) => c.status === "fail" || c.status === "warn")
      .sort((a, b) => rank[a.status] - rank[b.status])[0];

    if (!worst) {
      const anyMeasured = quant.some((id) => checks[id].status !== "na");
      return {
        tone: "good" as const,
        target: "interproximal" as CheckId,
        title: anyMeasured ? "Prep looks solid" : "Ready to review",
        body: anyMeasured
          ? `All measured checks pass for ${material.name}. Finish by eyeballing the margin and interproximal slices.`
          : "Step through each check on the left to verify the prep.",
      };
    }
    const tone = worst.status === "fail" ? ("bad" as const) : ("warn" as const);
    const bodyByCheck: Record<CheckId, string> = {
      margin: `Finish line clears only ${worst.value} — deepen the chamfer toward target for a clean seat.`,
      undercut: `${worst.value} of the wall traps the path — re-aim the insertion axis or relieve the red zones.`,
      reduction: `Reduction is short of target — bring the prep down for ${material.name}.`,
      occlusal: `Occlusal table clears ${worst.value} — reduce more for ${material.name} strength.`,
      interproximal: "Inspect the interproximal slice.",
    };
    return {
      tone,
      target: worst.id,
      title:
        worst.status === "fail"
          ? `${CHECK_META[worst.id].label} needs work`
          : `${CHECK_META[worst.id].label} is tight`,
      body: bodyByCheck[worst.id],
    };
  }, [checks, material]);

  // Overall readiness count for the panel header (quantitative checks only).
  const passCount = useMemo(
    () =>
      (["margin", "undercut", "reduction", "occlusal"] as CheckId[]).filter(
        (id) => checks[id].status === "pass",
      ).length,
    [checks],
  );
  const measuredCount = useMemo(
    () =>
      (["margin", "undercut", "reduction", "occlusal"] as CheckId[]).filter(
        (id) => checks[id].status !== "na",
      ).length,
    [checks],
  );

  // --- Material impact: how the marked prep would fare for each material -----
  // Same reduction measurement judged against each material's own thresholds,
  // so the panel can show at a glance that (e.g.) Gold passes where Zirconia is
  // tight and Porcelain fails. Computed once per prep (material-independent
  // measurement, per-material thresholds).
  const materialImpact = useMemo<MaterialImpact[]>(() => {
    const labels = state.labels;
    return DISPLAY_MATERIALS.map(({ id, label }) => {
      const m = getMaterial(id);
      if (!meshReady || !hasPrepLabels(labels)) {
        return { id, label, targetMm: m.targetReductionMm, status: "na" as CheckStatus };
      }
      const s = computeReductionStats(
        state.txGeom,
        state.txMatrix,
        state.preGeom,
        state.preMatrix,
        labels,
        m.minReductionMm,
        m.targetReductionMm,
        undefined, // whole prep
      );
      const status: CheckStatus = !s
        ? "na"
        : !s.pass
          ? "fail"
          : s.pctBelowTarget >= 15
            ? "warn"
            : "pass";
      return { id, label, targetMm: m.targetReductionMm, status };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, meshReady]);

  // --- Initialize / reset the section transform from the saved cut -------
  useEffect(() => {
    if (mode !== "section" || state.sections.length === 0) return;
    const base =
      state.sections.find((s) => s.id === activeSectionId) ?? state.sections[0];
    sectionLiveXformRef.current = null;
    setSectionXform({
      origin: base.origin.clone(),
      quaternion: base.quaternion.clone(),
    });
  }, [mode, activeSectionId, state]);

  // --- Cross-section profile for the chosen + gizmo-adjusted cut ----------
  // Prefers the live (mid-drag) transform so the profile tracks the plane as it
  // moves; falls back to the committed transform, then the saved cut.
  const crossSectionData = useMemo<CrossSectionData[]>(() => {
    if (mode !== "section" || state.sections.length === 0) return [];
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (!preMesh || !txMesh) return [];
    const base =
      state.sections.find((s) => s.id === activeSectionId) ?? state.sections[0];
    const live = sectionLiveXformRef.current;
    const origin = live?.origin ?? sectionXform?.origin ?? base.origin;
    const quaternion =
      live?.quaternion ?? sectionXform?.quaternion ?? base.quaternion;
    const adjusted = { ...base, origin: origin.clone(), quaternion: quaternion.clone() };
    return computeCrossSectionProfiles(
      [adjusted],
      preMesh,
      state.preGeom,
      txMesh,
      state.txGeom,
      4,
    );
    // sectionProfileKey drives live recompute during a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, state, activeSectionId, sectionXform, sectionProfileKey]);

  // Mirror the latest cut into a ref (defined before the gizmo effect so it runs
  // first), so the gizmo can size its plane to the prep without rebuilding.
  useEffect(() => {
    crossSectionDataRef.current = crossSectionData;
  }, [crossSectionData]);

  // --- Cross-section gizmo: draggable + rotatable section plane -----------
  useEffect(() => {
    const handle = sceneRef.current;
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (!handle || !preMesh || !txMesh) return;

    const disposeGizmo = () => {
      // Always re-enable orbit controls in case we tear down mid-drag.
      handle.controls.enabled = true;
      // Clear any clip-mode slicing from all candidate materials so leaving
      // section mode (or switching to overlay) restores the full model.
      clipPlaneRef.current = null;
      const clearMats = [
        txSolidMatRef.current,
        txHeatMatRef.current,
        preMesh.material as THREE.MeshStandardMaterial,
      ].filter(Boolean) as THREE.MeshStandardMaterial[];
      for (const m of clearMats) {
        if (m.clippingPlanes && m.clippingPlanes.length) {
          m.clippingPlanes = [];
          m.needsUpdate = true;
        }
      }
      if (sectionTcRef.current) {
        sectionTcRef.current.detach();
        handle.scene.remove(sectionTcRef.current.getHelper());
        sectionTcRef.current.dispose();
        sectionTcRef.current = null;
      }
      if (sectionGroupRef.current) {
        handle.scene.remove(sectionGroupRef.current);
        sectionGroupRef.current.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) mat.dispose();
        });
        sectionGroupRef.current = null;
      }
      sectionPlaneRef.current = null;
      sectionEdgesRef.current = null;
    };
    disposeGizmo();

    if (mode !== "section" || state.sections.length === 0 || !accepted) return;
    const isClip = sectionViewMode === "clip";
    const base =
      state.sections.find((s) => s.id === activeSectionId) ?? state.sections[0];

    preMesh.updateMatrixWorld(true);
    txMesh.updateMatrixWorld(true);
    state.txGeom.computeBoundingSphere();
    const radius =
      (state.txGeom.boundingSphere?.radius ?? 10) * (txMesh.scale.x ?? 1);
    // Size the plane to the actual cut extent (prep-sized) rather than the whole
    // mesh, so it doesn't swamp the model. Fall back to a fraction of the mesh
    // radius before the first profile is available.
    const cut = crossSectionDataRef.current.find((c) => c.id === base.id);
    let planeW = radius * 0.9;
    let planeH = radius * 0.9;
    if (cut) {
      planeW = Math.max(cut.bounds.xMax - cut.bounds.xMin, 4) * 1.3;
      planeH = Math.max(cut.bounds.yMax - cut.bounds.yMin, 4) * 1.3;
    }

    const group = new THREE.Group();
    group.renderOrder = 999;

    const planeGeom = new THREE.PlaneGeometry(1, 1);
    const planeMat = new THREE.MeshBasicMaterial({
      color: base.color,
      transparent: true,
      // Faint fill in clip mode so the sliced model stays visible while the
      // plane remains grabbable; bolder fill in overlay mode.
      opacity: isClip ? 0.06 : 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.position.copy(sectionXform?.origin ?? base.origin);
    planeMesh.quaternion.copy(sectionXform?.quaternion ?? base.quaternion);
    planeMesh.scale.set(planeW, planeH, 1);
    planeMesh.renderOrder = 999;
    group.add(planeMesh);

    const edgeGeom = new THREE.EdgesGeometry(planeGeom);
    const edgeMat = new THREE.LineBasicMaterial({
      color: base.color,
      depthTest: false,
      transparent: true,
    });
    const edges = new THREE.LineSegments(edgeGeom, edgeMat);
    edges.position.copy(planeMesh.position);
    edges.quaternion.copy(planeMesh.quaternion);
    edges.scale.copy(planeMesh.scale);
    edges.renderOrder = 1001;
    group.add(edges);

    const tc = new TransformControls(handle.camera, handle.renderer.domElement);
    tc.attach(planeMesh);
    tc.setMode(sectionGizmoMode);
    tc.setSize(0.85);
    // Live profile while dragging: track the plane outline and recompute the
    // cross-section (throttled) without rebuilding the gizmo. objectChange fires
    // only when the plane is actually transformed (not on orbit).
    let lastProfile = 0;
    tc.addEventListener("objectChange", () => {
      edges.position.copy(planeMesh.position);
      edges.quaternion.copy(planeMesh.quaternion);
      sectionLiveXformRef.current = {
        origin: planeMesh.position.clone(),
        quaternion: planeMesh.quaternion.clone(),
      };
      // In clip mode, drive the shared clipping plane straight off the plane
      // mesh so the model slices in real time as it is dragged/rotated.
      const cp = clipPlaneRef.current;
      if (cp) {
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(
          planeMesh.quaternion,
        );
        cp.setFromNormalAndCoplanarPoint(n, planeMesh.position);
      }
      const now = performance.now();
      if (now - lastProfile < 60) return;
      lastProfile = now;
      setSectionProfileKey((k) => k + 1);
    });
    tc.addEventListener("dragging-changed", (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      handle.controls.enabled = !dragging;
      if (!dragging) {
        const fin = {
          origin: planeMesh.position.clone(),
          quaternion: planeMesh.quaternion.clone(),
        };
        sectionLiveXformRef.current = fin;
        setSectionXform(fin);
        setSectionProfileKey((k) => k + 1);
      }
    });
    handle.scene.add(tc.getHelper());

    // In clip mode, slice both meshes with a single shared clipping plane so
    // the cut is revealed on the model itself. THREE keeps the half-space on
    // the +normal side; the objectChange handler mutates this same plane during
    // drag, so the cut tracks the gizmo live. Materials are already DoubleSide,
    // so interior faces show at the cut.
    if (isClip) {
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
        planeMesh.quaternion,
      );
      const clipPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        normal,
        planeMesh.position,
      );
      clipPlaneRef.current = clipPlane;
      const clipMats = [
        txMesh.material as THREE.MeshStandardMaterial,
        preMesh.material as THREE.MeshStandardMaterial,
      ];
      for (const m of clipMats) {
        m.clippingPlanes = [clipPlane];
        m.needsUpdate = true;
      }
    }

    handle.scene.add(group);
    sectionGroupRef.current = group;
    sectionPlaneRef.current = planeMesh;
    sectionEdgesRef.current = edges;
    sectionTcRef.current = tc;

    return disposeGizmo;
  }, [mode, accepted, activeSectionId, state, sectionXform, sectionViewMode]);

  // --- On-model contour overlay (clip mode only) --------------------------
  // Lifts the computed 2D cross-section segments back into 3D and draws them as
  // crisp outlines right at the cut, so the slice reads as a true section (tx
  // solid, pre dashed). Rebuilds on cut change; during a drag crossSectionData
  // updates (throttled) so the contour tracks the gizmo too.
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle) return;

    const prev = sectionContourRef.current;
    if (prev) {
      handle.scene.remove(prev);
      prev.traverse((o) => {
        const line = o as THREE.Line;
        if (line.geometry) line.geometry.dispose();
        const mat = line.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      sectionContourRef.current = null;
    }

    if (mode !== "section" || sectionViewMode !== "clip") return;

    const group = new THREE.Group();
    group.renderOrder = 1002;

    const lift = (
      segs: Float32Array,
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      up: THREE.Vector3,
      color: number,
      dashed: boolean,
    ) => {
      if (segs.length < 4) return;
      const pts: number[] = [];
      for (let i = 0; i < segs.length; i += 2) {
        const x = segs[i];
        const y = segs[i + 1];
        pts.push(
          origin.x + dir.x * x + up.x * y,
          origin.y + dir.y * x + up.y * y,
          origin.z + dir.z * x + up.z * y,
        );
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const mat = dashed
        ? new THREE.LineDashedMaterial({
            color,
            dashSize: 0.4,
            gapSize: 0.25,
            depthTest: false,
            transparent: true,
          })
        : new THREE.LineBasicMaterial({
            color,
            depthTest: false,
            transparent: true,
          });
      const line = new THREE.LineSegments(geom, mat);
      if (dashed) line.computeLineDistances();
      line.renderOrder = 1002;
      group.add(line);
    };

    for (const cs of crossSectionData) {
      // tx contour in the section color, pre contour dashed grey for reference.
      lift(cs.preSegments, cs.origin, cs.dir, cs.up, 0x9aa7b4, true);
      lift(cs.txSegments, cs.origin, cs.dir, cs.up, cs.color, false);
    }

    handle.scene.add(group);
    sectionContourRef.current = group;
  }, [crossSectionData, sectionViewMode, mode]);

  // Sync the gizmo Move/Rotate toggle without rebuilding the plane (so the
  // current placement is preserved across toggles).
  useEffect(() => {
    if (sectionTcRef.current) sectionTcRef.current.setMode(sectionGizmoMode);
  }, [sectionGizmoMode]);

  // Restore the prepared view once the user accepts AND the scene is ready.
  // Guarded as an effect (rather than inline in the click handler) so a fast
  // click before scene init still restores the camera when the scene mounts.
  useEffect(() => {
    if (!accepted) return;
    const handle = sceneRef.current;
    if (!handle) return;
    applyCamera(handle, state.camera);
  }, [accepted, state]);

  const resetSectionToSaved = () => {
    const base =
      state.sections.find((s) => s.id === activeSectionId) ?? state.sections[0];
    if (!base) return;
    sectionLiveXformRef.current = null;
    setSectionXform({
      origin: base.origin.clone(),
      quaternion: base.quaternion.clone(),
    });
    setSectionProfileKey((k) => k + 1);
  };

  // --- Manual insertion path: tilt the withdrawal axis from the panel --------
  // Tilt is applied to the natural occlusal axis using the prep's own in-plane
  // axes, so the sliders read as mesiodistal / buccolingual lean. Each change
  // re-aims the on-model arrow and triggers a live undercut re-solve, so the
  // heatmap and undercut % update as the path moves.
  const insertionAxisFromTilt = (xDeg: number, yDeg: number) => {
    const base = new THREE.Vector3().fromArray(state.insertionAxis).normalize();
    const u = state.prepFrame.longDir.clone().normalize();
    const v = state.prepFrame.crossDir.clone().normalize();
    const qx = new THREE.Quaternion().setFromAxisAngle(
      u,
      THREE.MathUtils.degToRad(xDeg),
    );
    const qy = new THREE.Quaternion().setFromAxisAngle(
      v,
      THREE.MathUtils.degToRad(yDeg),
    );
    return base.applyQuaternion(qx).applyQuaternion(qy).normalize();
  };

  const applyInsertionTilt = (next: { x: number; y: number }) => {
    if (axisMode !== "manual") setAxisMode("manual");
    const axis = insertionAxisFromTilt(next.x, next.y);
    manualAxisRef.current = axis;
    // Re-aim the existing arrow group (if mounted) without rebuilding it.
    const group = arrowRef.current;
    if (group) {
      const cur = arrowDirection(group).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(cur, axis.clone());
      group.quaternion.premultiply(q);
    }
    setInsertionTilt(next);
    setUndercutRecomputeKey((k) => k + 1);
  };

  const resetInsertion = () => applyInsertionTilt({ x: 0, y: 0 });

  // Switch the live arrow gizmo between aim (rotate) and move (translate)
  // without rebuilding it.
  useEffect(() => {
    insertionGizmoRef.current = insertionGizmo;
    const tc = manualArrowTcRef.current;
    if (tc) tc.setMode(insertionGizmo === "move" ? "translate" : "rotate");
  }, [insertionGizmo]);

  // Switching to Manual starts from the natural axis (tilt 0); Optimized clears
  // the manual seed so the next solve is fresh.
  const handleAxisMode = (m: UndercutAxisMode) => {
    setAxisMode(m);
    if (m === "manual") {
      setInsertionTilt({ x: 0, y: 0 });
      manualAxisRef.current = insertionAxisFromTilt(0, 0);
    } else {
      manualAxisRef.current = null;
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#D6E7F1] font-['Roboto',sans-serif] text-[#3e3d40] antialiased">
        <div ref={hostRef} className="absolute inset-0" />

        {accepted && (
          <>
            <QCPanel
              checks={checks}
              activeCheck={activeCheck}
              onActiveCheck={setActiveCheck}
              passCount={passCount}
              measuredCount={measuredCount}
              suggestion={suggestion}
              reductionStats={reductionStats}
              showOnlyMarked={showOnlyMarked}
              onShowOnlyMarked={setShowOnlyMarked}
              axisMode={axisMode}
              onAxisMode={handleAxisMode}
              undercutResult={undercutResult}
              insertionTilt={insertionTilt}
              onInsertionTilt={applyInsertionTilt}
              onResetInsertion={resetInsertion}
              insertionGizmo={insertionGizmo}
              onInsertionGizmo={setInsertionGizmo}
              sections={state.sections}
              activeSectionId={activeSectionId}
              onActiveSectionId={setActiveSectionId}
              sectionViewMode={sectionViewMode}
              onSectionViewMode={setSectionViewMode}
              sectionGizmoMode={sectionGizmoMode}
              onSectionGizmoMode={setSectionGizmoMode}
              onResetSection={resetSectionToSaved}
              materialId={materialId}
              onMaterialId={setMaterialId}
              materialImpact={materialImpact}
              onReDrill={onReDrill}
              onClose={onClose}
            />

            <Legend
              kind={
                mode === "reduction"
                  ? "heatmap"
                  : mode === "undercut"
                    ? "undercut"
                    : null
              }
              step={heatStep}
              onStep={setHeatStep}
            />

            {activeCheck === "interproximal" && crossSectionData.length > 0 && (
              <div className="absolute left-4 top-[88px] bottom-4 flex max-h-[calc(100%-104px)] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
                <SectionPanel data={crossSectionData} />
              </div>
            )}
          </>
        )}

        {!accepted && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c1830]/40 backdrop-blur-sm">
            <div className="w-[420px] rounded-xl bg-white p-6 shadow-2xl ring-1 ring-[#d1d1d1]">
              <div className="mb-3 flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-[#00ADEF]" />
                <div className="text-[15px] font-semibold text-[#3e3d40]">
                  Preparation detected
                </div>
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-[#818181]">
                The system detected a preparation on this scan from the loaded
                preprocessing data. Continue to the Auto Prep Check to review
                undercuts, reduction clearance and cross-sections?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onReDrill}
                  className="flex items-center gap-1.5 rounded-md border border-[#d1d1d1] bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#3e3d40] transition hover:bg-[#f4f7fa]"
                >
                  <X className="h-4 w-4" />
                  Back to prep
                </button>
                <button
                  type="button"
                  onClick={() => setAccepted(true)}
                  className="flex items-center gap-1.5 rounded-md border border-[#1c7d4d] bg-[#1c7d4d] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#176a41]"
                >
                  Yes, continue
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status styling shared by the checklist chips and the suggestion card.
// ---------------------------------------------------------------------------
const STATUS_STYLE: Record<
  CheckStatus,
  { dot: string; text: string; chipBg: string; chipText: string; Icon: typeof CheckCircle2 }
> = {
  pass: { dot: "#1c7d4d", text: "#1c7d4d", chipBg: "#eaf7ee", chipText: "#1c7d4d", Icon: CheckCircle2 },
  warn: { dot: "#b5710e", text: "#b5710e", chipBg: "#fcf3df", chipText: "#8a5a12", Icon: AlertTriangle },
  fail: { dot: "#c0392b", text: "#c0392b", chipBg: "#fdecea", chipText: "#a3271b", Icon: XCircle },
  na: { dot: "#b3bcc7", text: "#818181", chipBg: "#eef2f6", chipText: "#7a8595", Icon: Circle },
};

// ---------------------------------------------------------------------------
// QCPanel — the single, focused control surface. A vertical checklist of the
// five clinical tasks (each with a live pass/warn/fail chip), the focused
// controls + reading for whichever task is selected, and one smart suggestion
// that points at the most important issue. Replaces the old three-mode
// switcher and the separate floating Undercut / Reduction / Section panels.
// ---------------------------------------------------------------------------
function QCPanel({
  checks,
  activeCheck,
  onActiveCheck,
  passCount,
  measuredCount,
  suggestion,
  reductionStats,
  showOnlyMarked,
  onShowOnlyMarked,
  axisMode,
  onAxisMode,
  undercutResult,
  insertionTilt,
  onInsertionTilt,
  onResetInsertion,
  insertionGizmo,
  onInsertionGizmo,
  sections,
  activeSectionId,
  onActiveSectionId,
  sectionViewMode,
  onSectionViewMode,
  sectionGizmoMode,
  onSectionGizmoMode,
  onResetSection,
  materialId,
  onMaterialId,
  materialImpact,
  onReDrill,
  onClose,
}: {
  checks: Record<CheckId, CheckInfo>;
  activeCheck: CheckId;
  onActiveCheck: (c: CheckId) => void;
  passCount: number;
  measuredCount: number;
  suggestion: { tone: "good" | "warn" | "bad"; target: CheckId; title: string; body: string };
  reductionStats: RegionReductionStat[];
  showOnlyMarked: boolean;
  onShowOnlyMarked: (v: boolean) => void;
  axisMode: UndercutAxisMode;
  onAxisMode: (m: UndercutAxisMode) => void;
  undercutResult: UndercutResult | null;
  insertionTilt: { x: number; y: number };
  onInsertionTilt: (t: { x: number; y: number }) => void;
  onResetInsertion: () => void;
  insertionGizmo: "aim" | "move";
  onInsertionGizmo: (m: "aim" | "move") => void;
  sections: PreState["sections"];
  activeSectionId: number;
  onActiveSectionId: (id: number) => void;
  sectionViewMode: SectionViewMode;
  onSectionViewMode: (m: SectionViewMode) => void;
  sectionGizmoMode: SectionGizmoMode;
  onSectionGizmoMode: (m: SectionGizmoMode) => void;
  onResetSection: () => void;
  materialId: string;
  onMaterialId: (id: string) => void;
  materialImpact: MaterialImpact[];
  onReDrill: () => void;
  onClose?: () => void;
}) {
  const isReductionFamily =
    activeCheck === "margin" ||
    activeCheck === "reduction" ||
    activeCheck === "occlusal";
  const sugTone =
    suggestion.tone === "good"
      ? STATUS_STYLE.pass
      : suggestion.tone === "warn"
        ? STATUS_STYLE.warn
        : STATUS_STYLE.fail;

  return (
    <div className="absolute right-4 top-[124px] flex max-h-[calc(100%-140px)] w-[296px] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-black/10 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-[#00ADEF] to-[#0095CE] px-3.5 py-2.5 text-white">
        <Sparkles className="h-4 w-4" />
        <div className="text-[13px] font-semibold tracking-tight">
          Prep Copilot
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
          {measuredCount > 0 ? `${passCount}/${measuredCount}` : "—"}
        </div>
        <button
          type="button"
          onClick={onReDrill}
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/80 transition hover:bg-white/20 hover:text-white"
          title="Re-mark the prep"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/80 transition hover:bg-white/20 hover:text-white"
            title="Close Prep Copilot"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Material impact */}
      <div className="border-b border-[#eef1f4] px-3 pb-2.5 pt-2.5">
        <div className="mb-1.5 px-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#9aa4b0]">
          Crown material
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {materialImpact.map((m) => {
            const selected = materialId === m.id;
            const st = STATUS_STYLE[m.status];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onMaterialId(m.id)}
                className={[
                  "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition",
                  selected
                    ? "border-[#00ADEF] bg-[#eaf6fd] shadow-sm"
                    : "border-[#e6eaef] bg-white hover:bg-[#f6f8fa]",
                ].join(" ")}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: st.dot }}
                />
                <span className="text-[11px] font-semibold text-[#3e3d40]">
                  {m.label}
                </span>
                <span className="font-mono text-[9.5px] text-[#9aa4b0]">
                  {m.targetMm.toFixed(1)}mm
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Checklist */}
      <div className="px-2 py-1.5">
        {CHECK_ORDER.map((id) => (
          <CheckRow
            key={id}
            info={checks[id]}
            active={activeCheck === id}
            onClick={() => onActiveCheck(id)}
          />
        ))}
      </div>

      {/* Focused detail */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#eef1f4] px-3.5 py-3">
        {/* Reduction family */}
        {isReductionFamily && (
          <div className="space-y-2">
            {reductionStats.length === 0 ? (
              <div className="rounded-lg bg-[#fcf3df] px-2.5 py-2 text-[11px] font-medium text-[#7a5a14]">
                No prep marked for this region.
              </div>
            ) : (
              reductionStats.map((s) => (
                <ClearanceStat
                  key={s.region}
                  label={`${s.label} clearance`}
                  minMm={s.minMm}
                  targetMm={s.targetMm}
                  pass={s.pass}
                />
              ))
            )}
            {activeCheck === "margin" && (
              <div className="flex items-center gap-2 text-[10px] text-[#9aa4b0]">
                <span
                  className="inline-block h-[3px] w-5 rounded-full"
                  style={{ backgroundColor: "#ffd400" }}
                />
                Finish line traced on the model
              </div>
            )}
            <SwitchRow
              label="Show only marked"
              checked={showOnlyMarked}
              onChange={onShowOnlyMarked}
            />
          </div>
        )}

        {/* Undercut — modern insertion-path controls */}
        {activeCheck === "undercut" && (
          <div className="space-y-3">
            {undercutResult ? (
              <UndercutGauge pct={undercutResult.undercutAreaPct} mm2={undercutResult.undercutAreaMm2} />
            ) : (
              <div className="text-[11px] text-[#9aa4b0]">Analyzing…</div>
            )}

            <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#9aa4b0]">
              Insertion path
            </div>
            <ToggleRow
              options={[
                { value: "optimized", label: "Auto", icon: Sparkles },
                { value: "manual", label: "Manual", icon: Move },
              ]}
              value={axisMode}
              onChange={(v) => onAxisMode(v as UndercutAxisMode)}
            />

            {axisMode === "manual" && (
              <div className="space-y-3 rounded-xl bg-[#f5f9fd] p-2.5 ring-1 ring-[#e1ecf5]">
                <div className="flex items-center justify-between">
                  <ToggleRow
                    options={[
                      { value: "aim", label: "Aim", icon: RotateCw },
                      { value: "move", label: "Move", icon: Move },
                    ]}
                    value={insertionGizmo}
                    onChange={(v) => onInsertionGizmo(v as "aim" | "move")}
                  />
                </div>
                <TiltSlider
                  label="Mesiodistal"
                  value={insertionTilt.x}
                  onChange={(x) => onInsertionTilt({ x, y: insertionTilt.y })}
                />
                <TiltSlider
                  label="Buccolingual"
                  value={insertionTilt.y}
                  onChange={(y) => onInsertionTilt({ x: insertionTilt.x, y })}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] text-[#9aa4b0]">
                    Heatmap updates live
                  </span>
                  <button
                    type="button"
                    onClick={onResetInsertion}
                    className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-[#00ADEF] transition hover:bg-[#eaf4fc]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Interproximal — cross-section slice */}
        {activeCheck === "interproximal" && (
          <div className="space-y-2.5">
            {sections.length === 0 ? (
              <div className="rounded-lg bg-[#fcf3df] px-2.5 py-2 text-[11px] font-medium text-[#7a5a14]">
                No cross-section was saved during prep.
              </div>
            ) : (
              <>
                {sections.length > 1 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {sections.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onActiveSectionId(s.id)}
                        className={[
                          "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition",
                          activeSectionId === s.id
                            ? "border-[#00ADEF] bg-[#eaf4fc] text-[#3e3d40]"
                            : "border-[#e6eaef] bg-white text-[#818181] hover:bg-[#f6f8fa]",
                        ].join(" ")}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{
                            backgroundColor: `#${s.color.toString(16).padStart(6, "0")}`,
                          }}
                        />
                        Cut {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                <ToggleRow
                  options={[
                    { value: "clip", label: "Slice", icon: Scissors },
                    { value: "overlay", label: "Overlay", icon: SquareDashedBottom },
                  ]}
                  value={sectionViewMode}
                  onChange={(v) => onSectionViewMode(v as SectionViewMode)}
                />
                <ToggleRow
                  options={[
                    { value: "translate", label: "Move", icon: Move },
                    { value: "rotate", label: "Rotate", icon: RotateCw },
                  ]}
                  value={sectionGizmoMode}
                  onChange={(v) => onSectionGizmoMode(v as SectionGizmoMode)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] text-[#9aa4b0]">
                    Drag through the contact
                  </span>
                  <button
                    type="button"
                    onClick={onResetSection}
                    className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-[#00ADEF] transition hover:bg-[#eaf4fc]"
                  >
                    Reset
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Smart suggestion */}
      <button
        type="button"
        onClick={() => onActiveCheck(suggestion.target)}
        className="group flex items-center gap-2.5 border-t border-[#eef1f4] px-3.5 py-2.5 text-left transition hover:brightness-[0.98]"
        style={{ backgroundColor: sugTone.chipBg }}
      >
        <sugTone.Icon className="h-4 w-4 shrink-0" style={{ color: sugTone.text }} />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold leading-tight" style={{ color: sugTone.text }}>
            {suggestion.title}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-[#5a6675]">
            {suggestion.body}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5" style={{ color: sugTone.text }} />
      </button>
    </div>
  );
}

// Per-region clearance: measured min vs target, with a slim progress bar.
function ClearanceStat({
  label,
  minMm,
  targetMm,
  pass,
}: {
  label: string;
  minMm: number;
  targetMm: number;
  pass: boolean;
}) {
  const pctOfTarget = Math.min(100, targetMm > 0 ? (minMm / targetMm) * 100 : 0);
  const color = pass ? "#1c7d4d" : "#c0392b";
  return (
    <div className="rounded-lg bg-[#f6f8fa] px-2.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-[#5a6675]">{label}</span>
        <span className="font-mono text-[13px] font-bold tabular-nums" style={{ color }}>
          {minMm.toFixed(2)}
          <span className="ml-0.5 text-[9px] font-medium text-[#9aa4b0]">mm</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e4e9ee]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pctOfTarget}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1 text-right font-mono text-[9px] text-[#9aa4b0]">
        target {targetMm.toFixed(1)}mm
      </div>
    </div>
  );
}

// Undercut readout: large % with a 0–100 bar coloured by severity.
function UndercutGauge({ pct, mm2 }: { pct: number; mm2: number }) {
  const color = pct > 2 ? "#c0392b" : pct > 0.5 ? "#b5710e" : "#1c7d4d";
  return (
    <div className="rounded-xl bg-[#f6f8fa] px-3 py-2.5">
      <div className="flex items-end justify-between">
        <span className="text-[11px] text-[#5a6675]">Undercut area</span>
        <span className="font-mono text-[22px] font-bold leading-none tabular-nums" style={{ color }}>
          {pct.toFixed(1)}
          <span className="ml-0.5 text-[12px]">%</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e9ee]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(2, pct))}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] text-[#9aa4b0]">
          {pct < 0.5 ? "Draws out cleanly" : pct < 2 ? "Minor undercut" : "Re-aim or relieve"}
        </span>
        <span className="font-mono text-[9px] text-[#9aa4b0]">{mm2.toFixed(1)} mm²</span>
      </div>
    </div>
  );
}

// Compact labelled switch.
function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg px-0.5 py-1 text-left"
    >
      <span className="text-[11px] text-[#5a6675]">{label}</span>
      <span
        className={[
          "relative h-4 w-7 rounded-full transition-colors",
          checked ? "bg-[#00ADEF]" : "bg-[#cdd5dd]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all",
            checked ? "left-3.5" : "left-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CheckRow — a single task in the checklist: icon, label, live status chip.
// ---------------------------------------------------------------------------
function CheckRow({
  info,
  active,
  onClick,
}: {
  info: CheckInfo;
  active: boolean;
  onClick: () => void;
}) {
  const meta = CHECK_META[info.id];
  const Icon = meta.icon;
  const style = STATUS_STYLE[info.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition",
        active ? "bg-[#eaf4fc] ring-1 ring-[#00ADEF]" : "hover:bg-[#f4f7fa]",
      ].join(" ")}
    >
      <Icon
        className="h-4 w-4 shrink-0"
        style={{ color: active ? "#0089c4" : "#7a8595" }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-[#3e3d40]">
          {meta.label}
        </div>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
        style={{ backgroundColor: style.chipBg, color: style.chipText }}
      >
        {info.value}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ToggleRow — compact two-option segmented control used inside QCPanel.
// ---------------------------------------------------------------------------
function ToggleRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon: typeof Move }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[#d1d1d1]">
      {options.map(({ value: v, label, icon: Icon }, i) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={[
              "flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium transition",
              i < options.length - 1 ? "border-r border-[#d1d1d1]" : "",
              active
                ? "bg-[#00ADEF] text-white"
                : "bg-white text-[#3e3d40] hover:bg-[#f4f7fa]",
            ].join(" ")}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TiltSlider — one axis of the manual insertion-path tilt (degrees).
// ---------------------------------------------------------------------------
function TiltSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10.5px]">
        <span className="font-medium text-[#3e3d40]">{label}</span>
        <span className="font-mono tabular-nums text-[#5a6675]">
          {value > 0 ? `+${value}` : value}°
        </span>
      </div>
      <input
        type="range"
        min={-30}
        max={30}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00ADEF]"
      />
    </div>
  );
}
