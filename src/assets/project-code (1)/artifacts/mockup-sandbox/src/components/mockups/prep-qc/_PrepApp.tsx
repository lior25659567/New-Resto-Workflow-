import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  Magnet,
  Flame,
  Scissors,
  RotateCcw,
  Stethoscope,
  Move,
  RotateCw,
  X,
  Layers,
  SquareDashedBottom,
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
  REGION_TARGET_MM,
  regionTargetMm,
  regionMinMm,
  applyCamera,
} from "./pre-state";
import { Legend, Metric, SectionPanel } from "./_prep-ui";

// ---------------------------------------------------------------------------
// Main App — analysis-only stage. Consumes a PreState produced by the guided
// Pre-Entry stage and never re-runs any preprocessing. All heavy lifting
// (undercut solve, heatmap, cross-section profiles) is delegated to the shared
// prep-geometry module, so there is a single source of truth for the math.
// ---------------------------------------------------------------------------

type AppMode = "undercut" | "reduction" | "section";
type SectionGizmoMode = "translate" | "rotate";

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
}: {
  state: PreState;
  onReDrill: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const preMeshRef = useRef<THREE.Mesh | null>(null);
  const txMeshRef = useRef<THREE.Mesh | null>(null);
  const txSolidMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const txHeatMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const arrowRef = useRef<THREE.Group | null>(null);
  // Manual insertion axis (driven by the draggable arrow) + its rotate gizmo.
  const manualAxisRef = useRef<THREE.Vector3 | null>(null);
  const manualArrowTcRef = useRef<TransformControls | null>(null);
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

  // Auto Prep Check confirmation gate — shown until the user accepts.
  const [accepted, setAccepted] = useState(false);
  const [mode, setMode] = useState<AppMode>("undercut");
  const [materialId, setMaterialId] = useState(MATERIALS[0].id);

  // Insertion-path controls: only an Optimized solve and a hand-aimed Manual
  // arrow remain. Start Optimized so the prep is judged against its best path.
  const [axisMode, setAxisMode] = useState<UndercutAxisMode>("optimized");
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
    const handle = createScene(hostRef.current, { background: "#dde6ef" });
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

    return () => {
      handle.dispose();
      sceneRef.current = null;
      preMeshRef.current = null;
      txMeshRef.current = null;
      txSolidMatRef.current = null;
      txHeatMatRef.current = null;
      arrowRef.current = null;
    };
  }, [state]);

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
    disposeArrow();
    if (mode !== "undercut" || axisMode === "manual" || !undercutResult) return;
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
    tc.setMode("rotate");
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

  return (
    <div className="flex h-full w-full flex-col bg-[#eef3f8] text-[#1c1f24]">
      <header className="flex items-center gap-3 border-b border-[#cbd6e2] bg-white px-4 py-2.5">
        <Stethoscope className="h-5 w-5 text-[#2a8fd8]" />
        <div className="text-[13.5px] font-semibold">Auto Prep Check</div>
        <div className="text-[11.5px] text-[#8a929e]">
          {state.txName} · prep loaded from preprocessing
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11.5px] font-medium text-[#5a6270]">
            Material
          </label>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="rounded-md border border-[#cbd6e2] bg-white px-2 py-1.5 text-[12px] font-medium text-[#1c1f24]"
            title="Crown material — sets the reduction thresholds"
          >
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onReDrill}
            className="flex items-center gap-1.5 rounded-md border border-[#cbd6e2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1c1f24] transition hover:bg-[#f4f7fa]"
            title="Go back to preprocessing to re-prep this tooth"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Re-drill
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div ref={hostRef} className="absolute inset-0" />

        {accepted && (
          <>
            {/* Mode switch */}
            <div className="absolute left-4 top-4 flex overflow-hidden rounded-md border border-[#cbd6e2] bg-white shadow-sm">
              {(
                [
                  { value: "undercut", label: "Undercuts", icon: Magnet },
                  { value: "reduction", label: "Reduction", icon: Flame },
                  { value: "section", label: "Cross-section", icon: Scissors },
                ] as const
              ).map(({ value, label, icon: Icon }, i) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={[
                      "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition",
                      i > 0 ? "border-l border-[#cbd6e2]" : "",
                      active
                        ? "bg-[#2a8fd8] text-white"
                        : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {mode === "undercut" && (
              <UndercutPanel
                axisMode={axisMode}
                onAxisMode={setAxisMode}
                result={undercutResult}
              />
            )}

            {mode === "reduction" && (
              <ReductionPanel
                material={material}
                region={heatRegion}
                onRegion={setHeatRegion}
                showOnlyMarked={showOnlyMarked}
                onShowOnlyMarked={setShowOnlyMarked}
                stats={reductionStats}
              />
            )}

            {mode === "section" && state.sections.length > 0 && (
              <div className="absolute left-4 top-[60px] w-[226px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
                <div className="mb-2 flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-[#2a8fd8]" />
                  <div className="text-[12.5px] font-semibold text-[#1c1f24]">
                    Cross-section
                  </div>
                </div>
                {state.sections.length > 1 && (
                  <div className="mb-3 space-y-1">
                    {state.sections.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSectionId(s.id)}
                        className={[
                          "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] font-medium transition",
                          activeSectionId === s.id
                            ? "border-[#2a8fd8] bg-[#eaf4fc] text-[#1c1f24]"
                            : "border-[#e2e7ee] bg-white text-[#5a6270] hover:bg-[#f4f7fa]",
                        ].join(" ")}
                      >
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{
                            backgroundColor: `#${s.color
                              .toString(16)
                              .padStart(6, "0")}`,
                          }}
                        />
                        Cut {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
                  View
                </div>
                <div className="mb-2 flex overflow-hidden rounded-md border border-[#cbd6e2]">
                  {(
                    [
                      { value: "clip", label: "Slice", icon: Scissors },
                      {
                        value: "overlay",
                        label: "Overlay",
                        icon: SquareDashedBottom,
                      },
                    ] as const
                  ).map(({ value, label, icon: Icon }, i) => {
                    const active = sectionViewMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSectionViewMode(value)}
                        className={[
                          "flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium transition",
                          i < 1 ? "border-r border-[#cbd6e2]" : "",
                          active
                            ? "bg-[#2a8fd8] text-white"
                            : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
                        ].join(" ")}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
                  Gizmo
                </div>
                <div className="mb-2 flex overflow-hidden rounded-md border border-[#cbd6e2]">
                  {(
                    [
                      { value: "translate", label: "Move", icon: Move },
                      { value: "rotate", label: "Rotate", icon: RotateCw },
                    ] as const
                  ).map(({ value, label, icon: Icon }, i) => {
                    const active = sectionGizmoMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSectionGizmoMode(value)}
                        className={[
                          "flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium transition",
                          i < 1 ? "border-r border-[#cbd6e2]" : "",
                          active
                            ? "bg-[#2a8fd8] text-white"
                            : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
                        ].join(" ")}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const base =
                        state.sections.find((s) => s.id === activeSectionId) ??
                        state.sections[0];
                      sectionLiveXformRef.current = null;
                      setSectionXform({
                        origin: base.origin.clone(),
                        quaternion: base.quaternion.clone(),
                      });
                      setSectionProfileKey((k) => k + 1);
                    }}
                    className="rounded px-2 py-0.5 text-[11px] font-medium text-[#2a8fd8] transition hover:bg-[#eaf4fc]"
                  >
                    Reset to saved
                  </button>
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-[#8a929e]">
                  Drag the gizmo to move or rotate the saved plane and inspect
                  nearby slices without re-prepping.
                </div>
              </div>
            )}

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

            {mode === "section" && crossSectionData.length > 0 && (
              <SectionPanel data={crossSectionData} />
            )}
          </>
        )}

        {!accepted && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c1830]/40 backdrop-blur-sm">
            <div className="w-[420px] rounded-xl bg-white p-6 shadow-2xl ring-1 ring-[#cbd6e2]">
              <div className="mb-3 flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-[#2a8fd8]" />
                <div className="text-[15px] font-semibold text-[#1c1f24]">
                  Preparation detected
                </div>
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-[#5a6270]">
                The system detected a preparation on this scan from the loaded
                preprocessing data. Continue to the Auto Prep Check to review
                undercuts, reduction clearance and cross-sections?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onReDrill}
                  className="flex items-center gap-1.5 rounded-md border border-[#cbd6e2] bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#1c1f24] transition hover:bg-[#f4f7fa]"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Undercut control panel — insertion-path source (Optimized or hand-aimed
// Manual arrow) and the single undercut-area read-out.
// ---------------------------------------------------------------------------
function UndercutPanel({
  axisMode,
  onAxisMode,
  result,
}: {
  axisMode: UndercutAxisMode;
  onAxisMode: (m: UndercutAxisMode) => void;
  result: UndercutResult | null;
}) {
  return (
    <div className="absolute left-4 top-[60px] w-[238px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Magnet className="h-4 w-4 text-[#2a8fd8]" />
        <div className="text-[12.5px] font-semibold text-[#1c1f24]">
          Insertion path
        </div>
      </div>
      <div className="mb-3 flex overflow-hidden rounded-md border border-[#cbd6e2]">
        {(
          [
            { value: "optimized", label: "Optimized" },
            { value: "manual", label: "Manual" },
          ] as const
        ).map(({ value, label }, i, arr) => {
          const active = axisMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onAxisMode(value)}
              className={[
                "flex-1 px-2 py-1.5 text-[12px] font-medium transition",
                i < arr.length - 1 ? "border-r border-[#cbd6e2]" : "",
                active
                  ? "bg-[#2a8fd8] text-white"
                  : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
              ].join(" ")}
              title={
                value === "optimized"
                  ? "Solve for the path that minimizes undercut area"
                  : "Aim the insertion axis by dragging the 3D arrow"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      {axisMode === "manual" && (
        <div className="mb-3 rounded-md border border-[#cfe3f4] bg-[#eef6fc] px-2 py-1.5 text-[10.5px] leading-snug text-[#1f6aa0]">
          Drag the ring on the 3D arrow to aim the withdrawal direction. The
          undercut map updates when you release.
        </div>
      )}
      <div className="border-t border-[#e2e7ee] pt-2">
        {result ? (
          <div className="space-y-1.5">
            <Metric
              label="Undercut area"
              value={`${result.undercutAreaPct.toFixed(1)}%`}
              detail={`${result.undercutAreaMm2.toFixed(1)} mm²`}
              bad={result.undercutAreaPct > 1}
            />
            <div className="pt-1 text-[10.5px] leading-snug text-[#8a929e]">
              {result.undercutAreaPct < 0.2
                ? "Path is clear — the prep draws out cleanly."
                : "Reduce the red zones or re-drill for a clean draw."}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-[#8a929e]">Analyzing…</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reduction panel — material clearance thresholds + per-region pass / under-
// reduced status against each region's own target.
// ---------------------------------------------------------------------------
function ReductionPanel({
  material,
  region,
  onRegion,
  showOnlyMarked,
  onShowOnlyMarked,
  stats,
}: {
  material: ReturnType<typeof getMaterial>;
  region: PrepRegion;
  onRegion: (r: PrepRegion) => void;
  showOnlyMarked: boolean;
  onShowOnlyMarked: (v: boolean) => void;
  stats: RegionReductionStat[];
}) {
  return (
    <div className="absolute left-4 top-[60px] w-[248px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Flame className="h-4 w-4 text-[#2a8fd8]" />
        <div className="text-[12.5px] font-semibold text-[#1c1f24]">
          Reduction clearance
        </div>
      </div>

      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
        Region
      </div>
      <div className="mb-2 flex overflow-hidden rounded-md border border-[#cbd6e2]">
        {(
          [
            { value: "all", label: "All" },
            { value: "marginal", label: "Marginal" },
            { value: "occlusal", label: "Occlusal" },
          ] as const
        ).map(({ value, label }, i) => {
          const active = region === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onRegion(value)}
              className={[
                "flex-1 px-1.5 py-1.5 text-[11px] font-medium transition",
                i < 2 ? "border-r border-[#cbd6e2]" : "",
                active
                  ? "bg-[#2a8fd8] text-white"
                  : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-[11px] text-[#5a6270]">
        <input
          type="checkbox"
          checked={showOnlyMarked}
          onChange={(e) => onShowOnlyMarked(e.target.checked)}
          className="accent-[#2a8fd8]"
        />
        Show only marked areas
      </label>

      <div className="border-t border-[#e2e7ee] pt-2">
        {stats.length === 0 ? (
          <div className="rounded-md border border-[#f0d7a4] bg-[#fcf3df] px-2 py-1.5 text-[11px] font-medium text-[#7a5a14]">
            No prep region marked for this selection.
          </div>
        ) : (
          <div className="space-y-1.5">
            {stats.map((s) => (
              <Metric
                key={s.region}
                label={`${s.label} clearance`}
                value={s.pass ? "Pass" : "Under-reduced"}
                detail={`min ${s.minMm.toFixed(2)} / target ${s.targetMm.toFixed(2)} mm`}
                bad={!s.pass}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 text-[10.5px] leading-snug text-[#8a929e]">
        Targets: marginal {REGION_TARGET_MM.marginal.toFixed(1)} mm, occlusal{" "}
        {REGION_TARGET_MM.occlusal.toFixed(1)} mm, all{" "}
        {material.targetReductionMm.toFixed(1)} mm ({material.name}). Red zones
        are under the minimum clearance.
      </div>
    </div>
  );
}
