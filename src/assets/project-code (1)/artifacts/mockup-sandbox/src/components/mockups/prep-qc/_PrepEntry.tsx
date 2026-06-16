import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  Upload,
  FileBox,
  X,
  Loader2,
  Move3D,
  RotateCw,
  Flame,
  Hand,
  RotateCcw,
  MousePointer2,
  ExternalLink,
  AlertTriangle,
  Wand2,
  ClipboardPaste,
  Brush,
  Eraser,
  Square,
  Trash2,
  Eye,
  EyeOff,
  Scissors,
  ZoomIn,
  ArrowDownToDot,
  ArrowRight,
  Magnet,
  Save,
  Check,
} from "lucide-react";
import {
  createScene,
  frameObjects,
  frameAlongAxis,
  computeOcclusalFrame,
  parsePly,
  applyDistanceHeatmap,
  icpAlign,
  type SceneHandle,
  type UndercutResult,
} from "./three-utils";
import {
  labelsToColors,
  paintVerticesInRadius,
  countLabel,
  regionMask,
  regionLabelValue,
  type PrepRegion,
  LABEL_UNLABELED,
  LABEL_PREP,
  LABEL_MARGINAL,
  LABEL_OCCLUSAL,
} from "./prep-label";
import {
  type Section,
  type SectionSize,
  type SectionPlane,
  type SectionViewMode,
  type PrepFrame,
  type CrossSectionData,
  type UndercutAxisMode,
  type ReductionStats,
  hasPrepLabels,
  planeFrameFor,
  computeCrossSectionProfiles,
  computePrepFrame,
  computeMeshFrame,
  computeReductionStats,
  makeInsertionArrow,
  makeDraggableInsertionArrow,
  arrowDirection,
  disposeArrowGroup,
  runUndercutAnalysis,
} from "./prep-geometry";
import { ToggleGroup, Legend, Metric, SizeRow, SectionPanel } from "./_prep-ui";
import {
  type PreState,
  type PrepMaterial,
  MATERIALS,
  getMaterial,
  REGION_TARGET_MM,
  regionTargetMm,
  regionMinMm,
  captureCamera,
} from "./pre-state";

type UploadedGeom = {
  name: string;
  geometry: THREE.BufferGeometry;
};

type ViewMode = "align" | "heatmap" | "label" | "section" | "undercut";
type GizmoMode = "translate" | "rotate";
type LabelTool = "prep" | "marginal" | "occlusal" | "erase";

// Per-region clearance read-out shown in the heatmap card.
type RegionReductionStat = {
  region: PrepRegion;
  label: string;
  pass: boolean;
  minMm: number;
  targetMm: number;
};

// Draft tolerance is fixed at 0° (any wall past parallel is a true undercut);
// the manual hand-tunable slider was removed in favor of the drag gizmo.
const DRAFT_TOL_DEG = 0;

// Map a marking brush to the per-vertex label value it paints.
function labelValueForTool(tool: LabelTool): number {
  return tool === "prep"
    ? LABEL_PREP
    : tool === "marginal"
      ? LABEL_MARGINAL
      : tool === "occlusal"
        ? LABEL_OCCLUSAL
        : LABEL_UNLABELED;
}


export function PrepEntry({
  onComplete,
}: {
  onComplete?: (state: PreState) => void;
}) {
  const [pre, setPre] = useState<UploadedGeom | null>(null);
  const [tx, setTx] = useState<UploadedGeom | null>(null);
  const [mode, setMode] = useState<ViewMode>("align");
  const [gizmo, setGizmo] = useState<GizmoMode>("translate");
  const [, force] = useState(0);
  const [autoStatus, setAutoStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | {
        state: "done";
        rmse: number;
        fullRmse: number;
        iterations: number;
        inliers: number;
        samples: number;
      }
  >({ state: "idle" });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState(
    "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1",
  );
  const [pasteError, setPasteError] = useState<string | null>(null);
  // Labeling state
  const [labelTool, setLabelTool] = useState<LabelTool>("prep");
  const [brushPct, setBrushPct] = useState(6); // % of mesh radius
  const [, forceLabel] = useState(0);
  // Visibility / opacity controls
  const [preOpacity, setPreOpacity] = useState(0.7);
  const [txOpacity, setTxOpacity] = useState(1);
  const [preVisible, setPreVisible] = useState(true);
  const [txVisible, setTxVisible] = useState(true);
  const [heatStep, setHeatStep] = useState<0.1 | 0.2>(0.1);
  // Cross-section state. Auto-generated as N parallel cuts through the
  // painted prep region. Each section is draggable along its `normal`.
  // `sectionRecomputeKey` is bumped to force a fresh fit (e.g. after orbit).
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionRecomputeKey, setSectionRecomputeKey] = useState(0);
  const [sectionStatus, setSectionStatus] = useState<
    "ok" | "no-prep" | "idle"
  >("idle");
  // Plane visual size and gizmo mode live OUTSIDE `sections` so the user can
  // drag size sliders / toggle rotate without rebuilding the gizmo every tick.
  const [sectionSize, setSectionSize] = useState<SectionSize>({
    width: 30,
    height: 30,
  });
  const [sectionGizmoMode, setSectionGizmoMode] =
    useState<GizmoMode>("translate");
  // Anatomical cut orientation + viewing mode (overlay vs slice-the-model).
  const [sectionPlaneType, setSectionPlaneType] =
    useState<SectionPlane>("axial");
  // Default to "clip" so entering Section mode immediately reveals the cut on
  // the model (overlay only shows a flat plane, which reads as "no section").
  const [sectionViewMode, setSectionViewMode] =
    useState<SectionViewMode>("clip");
  // Prep frame (PCA axes) stored so plane switches don't recompute the fit.
  const [prepFrame, setPrepFrame] = useState<PrepFrame | null>(null);
  // Undercut / insertion-path analysis state.
  const [undercutResult, setUndercutResult] = useState<UndercutResult | null>(
    null,
  );
  const [undercutStatus, setUndercutStatus] = useState<
    "idle" | "ok" | "no-prep"
  >("idle");
  const [undercutAxisMode, setUndercutAxisMode] =
    useState<UndercutAxisMode>("optimized");
  const [undercutRecomputeKey, setUndercutRecomputeKey] = useState(0);
  // Heatmap review controls: the crown material driving the "All" threshold,
  // which prep region the heatmap is scoped to, and whether to mask to it.
  const [heatMaterialId, setHeatMaterialId] = useState(MATERIALS[0].id);
  const [heatRegion, setHeatRegion] = useState<PrepRegion>("all");
  const [showOnlyMarked, setShowOnlyMarked] = useState(true);
  // Cross-sections explicitly saved during preprocessing, plus the chosen
  // default the Main App opens with.
  const [savedSections, setSavedSections] = useState<Section[]>([]);
  const [defaultSectionId, setDefaultSectionId] = useState<number | null>(null);
  const inIframe =
    typeof window !== "undefined" && window.self !== window.top;

  const hostRef = useRef<HTMLDivElement | null>(null);
  // Screen-space scale bar (bar width + label text are updated per frame).
  const scaleBarRef = useRef<HTMLDivElement | null>(null);
  const scaleLabelRef = useRef<HTMLSpanElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const preMeshRef = useRef<THREE.Mesh | null>(null);
  const txMeshRef = useRef<THREE.Mesh | null>(null);
  const tcRef = useRef<TransformControls | null>(null);
  // Materials kept around so we can swap between solid / heatmap / label on tx.
  const txSolidMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const txHeatMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const txLabelMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  // Prep mask — keyed off the current tx geometry identity.
  const labelsRef = useRef<Uint8Array | null>(null);
  const labelGeomUuidRef = useRef<string | null>(null);
  const paintingRef = useRef(false);
  const labelToolRef = useRef<LabelTool>("prep");
  const brushPctRef = useRef(6);
  // Insertion-axis arrow shown in undercut mode.
  const undercutArrowRef = useRef<THREE.Group | null>(null);
  // Manual mode: the user-aimed withdrawal axis (source of truth while
  // dragging) plus the rotate gizmo attached to the draggable arrow handle.
  const manualAxisRef = useRef<THREE.Vector3 | null>(null);
  const manualArrowTcRef = useRef<TransformControls | null>(null);
  // Cross-section visuals (lines, drag handles, sprite labels) added/removed per change.
  const sectionGroupRef = useRef<THREE.Group | null>(null);
  // One TransformControls instance per section (currently always 1).
  const sectionTcsRef = useRef<TransformControls[]>([]);
  // Per-section subgroups so we can address one section's visuals without
  // walking the whole group.
  const sectionSubGroupsRef = useRef<Map<number, THREE.Group>>(new Map());
  // Direct refs to the plane meshes + their edge outlines so size sliders
  // can apply a scale update without rebuilding the whole section group.
  const sectionPlanesRef = useRef<
    { plane: THREE.Mesh; edges: THREE.LineSegments }[]
  >([]);
  // Live clipping plane for "clip" view mode — referenced by the tx/pre
  // materials' clippingPlanes arrays and mutated during gizmo drag.
  const clipPlaneRef = useRef<THREE.Plane | null>(null);
  // Separate group holding the on-model 3D contour outline in clip mode.
  const sectionContourRef = useRef<THREE.Group | null>(null);
  // Latest values for pointer handlers (which read refs, not state, to avoid
  // re-attaching listeners on every slider tick).
  useEffect(() => { labelToolRef.current = labelTool; }, [labelTool]);
  useEffect(() => { brushPctRef.current = brushPct; }, [brushPct]);

  const hasBoth = !!pre && !!tx;

  // --- Build the scene when both geoms are present -----------------------
  useEffect(() => {
    if (!hostRef.current || !pre || !tx) return;
    const handle = createScene(hostRef.current, { background: "#dde6ef" });
    sceneRef.current = handle;

    const preMat = new THREE.MeshStandardMaterial({
      color: 0xeab895,
      roughness: 0.38,
      metalness: 0.0,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      flatShading: false,
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
    const txLabel = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
      transparent: true,
      opacity: 1,
    });
    txSolidMatRef.current = txSolid;
    txHeatMatRef.current = txHeat;
    txLabelMatRef.current = txLabel;

    const preMesh = new THREE.Mesh(pre.geometry, preMat);
    const txMesh = new THREE.Mesh(tx.geometry, txSolid);

    // Normalize scales so the user can actually see both meshes together.
    pre.geometry.computeBoundingBox();
    tx.geometry.computeBoundingBox();
    const preSize = pre.geometry.boundingBox!.getSize(new THREE.Vector3())
      .length();
    const txSize = tx.geometry.boundingBox!.getSize(new THREE.Vector3())
      .length();
    if (txSize > 0) txMesh.scale.setScalar(preSize / txSize);

    handle.scene.add(preMesh);
    handle.scene.add(txMesh);
    preMeshRef.current = preMesh;
    txMeshRef.current = txMesh;

    // Gizmo on the pre (reference) mesh — user drags it onto the tx scan.
    const tc = new TransformControls(handle.camera, handle.renderer.domElement);
    tc.attach(preMesh);
    tc.setMode("translate");
    tc.setSize(0.9);
    tc.addEventListener("dragging-changed", (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      handle.controls.enabled = !dragging;
      // On drag end, invalidate any cached cross-section profiles.
      if (!dragging) setSectionRecomputeKey((k) => k + 1);
    });
    tc.addEventListener("change", () => force((n) => n + 1));
    handle.scene.add(tc.getHelper());
    tcRef.current = tc;

    frameObjects(handle, [preMesh, txMesh]);

    // Screen-space scale bar: pick a "nice" mm length for ~96px and size the
    // bar to it. The pre (reference) mesh defines world units (assumed mm), so
    // the bar reads true regardless of the tx auto-scale.
    const stopFrame = handle.onFrame(() => {
      const bar = scaleBarRef.current;
      const label = scaleLabelRef.current;
      if (!bar || !label) return;
      const cam = handle.camera;
      const dist = cam.position.distanceTo(handle.controls.target);
      const cssH = handle.renderer.domElement.clientHeight || 1;
      const visibleH = 2 * Math.tan((cam.fov * Math.PI) / 360) * dist;
      const worldPerPx = visibleH / cssH;
      if (!isFinite(worldPerPx) || worldPerPx <= 0) return;
      const targetWorld = 96 * worldPerPx;
      const exp = Math.floor(Math.log10(targetWorld));
      const base = Math.pow(10, exp);
      const frac = targetWorld / base;
      const niceFrac = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
      const nice = niceFrac * base;
      const px = nice / worldPerPx;
      bar.style.width = `${px.toFixed(1)}px`;
      const text =
        nice >= 1 ? `${nice} mm` : `${(nice * 1000).toFixed(0)} µm`;
      if (label.textContent !== text) label.textContent = text;
    });

    return () => {
      stopFrame();
      tc.detach();
      tc.dispose();
      handle.dispose();
      sceneRef.current = null;
      preMeshRef.current = null;
      txMeshRef.current = null;
      tcRef.current = null;
      txSolidMatRef.current = null;
      txHeatMatRef.current = null;
    };
  }, [pre, tx]);

  // --- Switch translate/rotate -------------------------------------------
  useEffect(() => {
    if (tcRef.current) tcRef.current.setMode(gizmo);
  }, [gizmo]);

  // --- Switch align / heatmap modes --------------------------------------
  useEffect(() => {
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    const tc = tcRef.current;
    if (!preMesh || !txMesh || !tc || !pre || !tx) return;

    if (mode === "align") {
      tc.attach(preMesh);
      (tc as unknown as { visible: boolean }).visible = true;
      if (txSolidMatRef.current) txMesh.material = txSolidMatRef.current;
      setPreOpacity(0.7);
      setTxOpacity(1);
      setPreVisible(true);
      setTxVisible(true);
    } else if (mode === "heatmap") {
      tc.detach();
      (tc as unknown as { visible: boolean }).visible = false;
      preMesh.updateMatrixWorld(true);
      txMesh.updateMatrixWorld(true);
      const haveLabels =
        labelsRef.current &&
        labelGeomUuidRef.current === tx.geometry.uuid &&
        hasPrepLabels(labelsRef.current);
      // Scope the heatmap to the selected region. "All" without
      // show-only-marked falls back to the whole surface (no mask).
      const mask =
        haveLabels && (heatRegion !== "all" || showOnlyMarked)
          ? regionMask(labelsRef.current!, heatRegion)
          : null;
      // Color ramp tops out at the region's reduction target so "full color"
      // means adequate clearance for that region/material.
      const maxDistance = Math.max(
        regionTargetMm(heatRegion, getMaterial(heatMaterialId)),
        0.2,
      );
      applyDistanceHeatmap(
        tx.geometry,
        txMesh.matrixWorld,
        pre.geometry,
        preMesh.matrixWorld,
        maxDistance,
        mask,
        heatStep,
      );
      if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
      setPreOpacity(0.15);
      setTxOpacity(1);
      setPreVisible(true);
      setTxVisible(true);
    } else if (mode === "section") {
      // Cross-section mode: show both meshes; clipping plane is applied
      // by the section effect once two points have been picked.
      tc.detach();
      (tc as unknown as { visible: boolean }).visible = false;
      if (txSolidMatRef.current) txMesh.material = txSolidMatRef.current;
      setPreOpacity(0.35);
      setTxOpacity(1);
      setPreVisible(true);
      setTxVisible(true);
    } else if (mode === "undercut") {
      // Undercut mode: hide pre, show tx with vertex colors. The actual
      // analysis + coloring runs in a dedicated effect below.
      tc.detach();
      (tc as unknown as { visible: boolean }).visible = false;
      if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
      setPreVisible(false);
      setTxOpacity(1);
      setTxVisible(true);
    } else {
      // Label mode: hide pre, show tx with vertex colors driven by labels.
      tc.detach();
      (tc as unknown as { visible: boolean }).visible = false;
      // Lazily allocate the prep mask once per tx geometry. Keyed off
      // geometry UUID so a new mesh always starts with a clean mask.
      const txVerts = tx.geometry.attributes.position.count;
      if (labelGeomUuidRef.current !== tx.geometry.uuid) {
        labelsRef.current = new Uint8Array(txVerts);
        labelGeomUuidRef.current = tx.geometry.uuid;
      }
      if (txLabelMatRef.current) txMesh.material = txLabelMatRef.current;
      labelsToColors(labelsRef.current!, tx.geometry);
      setPreVisible(false);
      setTxOpacity(1);
      setTxVisible(true);
    }
  }, [mode, pre, tx, heatStep, heatRegion, showOnlyMarked, heatMaterialId]);

  // --- Sync opacity & visibility from state to the meshes ----------------
  useEffect(() => {
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (preMesh) {
      preMesh.visible = preVisible;
      const m = preMesh.material as THREE.MeshStandardMaterial;
      m.opacity = preOpacity;
      m.transparent = preOpacity < 1;
      m.depthWrite = preOpacity >= 0.99;
    }
    if (txMesh) {
      txMesh.visible = txVisible;
      const m = txMesh.material as THREE.MeshStandardMaterial;
      m.opacity = txOpacity;
      m.transparent = txOpacity < 1;
      m.depthWrite = txOpacity >= 0.99;
    }
  }, [preOpacity, txOpacity, preVisible, txVisible, mode]);

  // --- Label-mode pointer events: brush painting on the tx mesh ----------
  useEffect(() => {
    if (mode !== "label") return;
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    if (!handle || !txMesh) return;
    const canvas = handle.renderer.domElement;
    const controls = handle.controls;
    // Reassign mouse buttons: left = paint, right = orbit, middle = dolly.
    const original = { ...controls.mouseButtons };
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    canvas.style.cursor = "crosshair";

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    txMesh.geometry.computeBoundingSphere();
    const meshRadius = txMesh.geometry.boundingSphere?.radius || 1;

    const doPaint = (clientX: number, clientY: number) => {
      const labels = labelsRef.current;
      if (!labels) return;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, handle.camera);
      const hits = raycaster.intersectObject(txMesh, false);
      if (hits.length === 0) return;
      const local = hits[0].point.clone();
      txMesh.worldToLocal(local);
      const radius = meshRadius * (brushPctRef.current / 100);
      const tool = labelToolRef.current;
      const value = labelValueForTool(tool);
      const changed = paintVerticesInRadius(
        txMesh.geometry,
        local,
        radius,
        value,
        labels,
      );
      if (changed > 0) {
        labelsToColors(labels, txMesh.geometry);
        forceLabel((n) => n + 1);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      paintingRef.current = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      doPaint(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (!paintingRef.current) return;
      doPaint(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      paintingRef.current = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      controls.mouseButtons = original;
      canvas.style.cursor = "";
      paintingRef.current = false;
    };
  }, [mode]);

  // --- Cross-section: rebuild visuals (lines, handles, mm labels) ---------
  useEffect(() => {
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    const handle = sceneRef.current;
    if (!preMesh || !txMesh || !handle || !pre || !tx) return;

    // Clear any clipping leftover from older single-plane behavior.
    const allMats = [
      txSolidMatRef.current,
      txHeatMatRef.current,
      txLabelMatRef.current,
      preMesh.material as THREE.MeshStandardMaterial,
    ].filter(Boolean) as THREE.MeshStandardMaterial[];
    for (const m of allMats) {
      if (m.clippingPlanes && m.clippingPlanes.length) {
        m.clippingPlanes = [];
        m.needsUpdate = true;
      }
    }
    sectionSubGroupsRef.current.clear();
    sectionPlanesRef.current = [];
    for (const tc of sectionTcsRef.current) {
      tc.detach();
      const helper = tc.getHelper();
      if (helper.parent) helper.parent.remove(helper);
      tc.dispose();
    }
    sectionTcsRef.current = [];
    if (sectionGroupRef.current) {
      handle.scene.remove(sectionGroupRef.current);
      sectionGroupRef.current.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
        const s = o as THREE.Sprite;
        if (s.material && (s.material as THREE.SpriteMaterial).map) {
          (s.material as THREE.SpriteMaterial).map?.dispose();
        }
      });
      sectionGroupRef.current = null;
    }

    if (mode !== "section" || sections.length === 0) {
      clipPlaneRef.current = null;
      return;
    }

    const isClip = sectionViewMode === "clip";
    clipPlaneRef.current = null;

    const group = new THREE.Group();
    group.renderOrder = 999;

    preMesh.updateMatrixWorld(true);
    txMesh.updateMatrixWorld(true);

    for (const sec of sections) {
      const sub = new THREE.Group();
      sub.userData.sectionId = sec.id;
      sectionSubGroupsRef.current.set(sec.id, sub);

      // Plane built at unit size; scale.set(w, h, 1) gives the visual size,
      // so width/height sliders can adjust scale without rebuilding geometry.
      const planeGeom = new THREE.PlaneGeometry(1, 1);
      const planeMat = new THREE.MeshBasicMaterial({
        color: sec.color,
        transparent: true,
        // Faint fill in clip mode so the cut model behind stays visible while
        // the plane remains grabbable; bolder fill in overlay mode.
        opacity: isClip ? 0.06 : 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.copy(sec.origin);
      planeMesh.quaternion.copy(sec.quaternion);
      planeMesh.scale.set(sectionSize.width, sectionSize.height, 1);
      planeMesh.renderOrder = 999;
      planeMesh.userData.sectionId = sec.id;
      sub.add(planeMesh);

      // Border outline mirrors plane transform and scale.
      const edgeGeom = new THREE.EdgesGeometry(planeGeom);
      const edgeMat = new THREE.LineBasicMaterial({
        color: sec.color,
        depthTest: false,
        transparent: true,
      });
      const edges = new THREE.LineSegments(edgeGeom, edgeMat);
      edges.position.copy(planeMesh.position);
      edges.quaternion.copy(planeMesh.quaternion);
      edges.scale.copy(planeMesh.scale);
      edges.renderOrder = 1001;
      sub.add(edges);

      // Translate / rotate gizmo. Mode is synced by a separate effect when
      // the user toggles Move vs Rotate, so no rebuild is needed on toggle.
      const sectionTc = new TransformControls(
        handle.camera,
        handle.renderer.domElement,
      );
      sectionTc.attach(planeMesh);
      sectionTc.setMode(sectionGizmoMode);
      sectionTc.setSize(0.85);
      sectionTc.addEventListener("change", () => {
        // Keep the outline locked to the plane during translate/rotate drag.
        edges.position.copy(planeMesh.position);
        edges.quaternion.copy(planeMesh.quaternion);
        // In clip mode, drive the live clipping plane straight off the plane
        // mesh so the model slices in real time as it is dragged/rotated.
        const cp = clipPlaneRef.current;
        if (cp) {
          const n = new THREE.Vector3(0, 0, 1).applyQuaternion(
            planeMesh.quaternion,
          );
          cp.setFromNormalAndCoplanarPoint(n, planeMesh.position);
        }
      });
      sectionTc.addEventListener("dragging-changed", (e) => {
        const dragging = (e as unknown as { value: boolean }).value;
        handle.controls.enabled = !dragging;
        if (!dragging) {
          const newOrigin = planeMesh.position.clone();
          const newQuat = planeMesh.quaternion.clone();
          setSections((prev) =>
            prev.map((s) =>
              s.id === sec.id
                ? { ...s, origin: newOrigin, quaternion: newQuat }
                : s,
            ),
          );
        }
      });
      handle.scene.add(sectionTc.getHelper());
      sectionTcsRef.current.push(sectionTc);
      sectionPlanesRef.current.push({ plane: planeMesh, edges });

      group.add(sub);
    }

    // In clip mode, slice both meshes with a single shared clipping plane so
    // the cross-section is revealed on the model itself. THREE keeps the
    // half-space on the +normal side; the change handler mutates this same
    // plane object during drag, so the cut tracks the gizmo live.
    if (isClip) {
      const sec = sections[0];
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
        sec.quaternion,
      );
      const clipPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        normal,
        sec.origin,
      );
      clipPlaneRef.current = clipPlane;
      const clipMats = [
        txMesh.material as THREE.MeshStandardMaterial,
        preMesh.material as THREE.MeshStandardMaterial,
      ];
      for (const m of clipMats) {
        // Materials are already DoubleSide, so interior faces show at the cut.
        m.clippingPlanes = [clipPlane];
        m.needsUpdate = true;
      }
    }

    handle.scene.add(group);
    sectionGroupRef.current = group;
  }, [sections, mode, pre, tx, sectionViewMode]);

  // --- Compute the prep's principal-axis frame -----------------------------
  // Runs on entering section mode or hitting Reset cut. PCA in the plane
  // perpendicular to camera-up yields the mesiodistal (long) and buccolingual
  // (cross) axes; camera-up is the occlusal axis. The chosen anatomical plane
  // is then derived from this frame in a separate effect.
  useEffect(() => {
    if (mode !== "section") return;
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    if (!handle || !txMesh || !tx) return;
    const labels = labelsRef.current;
    const hasPrep =
      !!labels &&
      labelGeomUuidRef.current === tx.geometry.uuid &&
      hasPrepLabels(labels);
    const camUp = new THREE.Vector3();
    handle.camera.matrixWorld.extractBasis(
      new THREE.Vector3(),
      camUp,
      new THREE.Vector3(),
    );
    // Center the default cut on the prep when one is painted; otherwise fall
    // back to a whole-mesh frame so the user can still place + save a cut.
    const frame = hasPrep
      ? computePrepFrame(txMesh, tx.geometry, labels, camUp)
      : computeMeshFrame(txMesh, tx.geometry, camUp);
    if (!frame) {
      setSections([]);
      setPrepFrame(null);
      setSectionStatus("no-prep");
      return;
    }
    // A separate effect derives the section plane from this frame + the chosen
    // anatomical orientation, so switching planes doesn't recompute the PCA.
    setPrepFrame(frame);
    // Every auto-section (mode entry / Reset cut) defaults to the axial view.
    setSectionPlaneType("axial");
    setSectionStatus("ok");
  }, [mode, sectionRecomputeKey, tx, pre]);

  // --- Derive the single section plane from the prep frame + chosen plane ---
  // Runs when the frame is (re)computed or the user switches anatomical plane.
  // Resets the cut to the prep center in the selected orientation; subsequent
  // gizmo drags update `sections` without re-triggering this.
  useEffect(() => {
    if (mode !== "section" || !prepFrame) return;
    const { quaternion, width, height } = planeFrameFor(
      prepFrame,
      sectionPlaneType,
    );
    setSections([
      {
        id: 0,
        origin: prepFrame.center.clone(),
        quaternion,
        color: 0x2a8fd8,
      },
    ]);
    setSectionSize({ width, height });
  }, [prepFrame, sectionPlaneType, mode]);

  // --- Undercut analysis: detect undercuts + solve the insertion path -----
  // Runs in undercut mode whenever the axis source, draft tolerance, or a
  // recompute is requested. Colors the prep mesh and stores the metrics.
  useEffect(() => {
    if (mode !== "undercut") {
      setUndercutResult(null);
      setUndercutStatus("idle");
      return;
    }
    const txMesh = txMeshRef.current;
    if (!txMesh || !tx) return;
    const labels = labelsRef.current;
    if (
      !labels ||
      labelGeomUuidRef.current !== tx.geometry.uuid ||
      !hasPrepLabels(labels)
    ) {
      setUndercutResult(null);
      setUndercutStatus("no-prep");
      return;
    }
    txMesh.updateMatrixWorld(true);

    // Manual mode: the withdrawal axis is whatever the user has aimed the
    // draggable arrow at (managed by the gizmo effect below). Seed it from the
    // last solved axis the first time the user enters Manual.
    if (undercutAxisMode !== "manual") {
      manualAxisRef.current = null;
    } else if (!manualAxisRef.current) {
      manualAxisRef.current =
        undercutResult?.insertionAxis.clone() ?? new THREE.Vector3(0, 1, 0);
    }
    const manualAxis =
      undercutAxisMode === "manual"
        ? (manualAxisRef.current ?? undefined)
        : undefined;

    const out = runUndercutAnalysis(txMesh, tx.geometry, labels, {
      axisMode: undercutAxisMode,
      draftTolDeg: DRAFT_TOL_DEG,
      manualAxis,
    });
    if (!out) {
      setUndercutResult(null);
      setUndercutStatus("no-prep");
      return;
    }
    tx.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(out.colors, 3),
    );
    if (txHeatMatRef.current) txMesh.material = txHeatMatRef.current;
    setUndercutResult(out.result);
    setUndercutStatus("ok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tx, undercutAxisMode, undercutRecomputeKey]);

  // --- Static insertion-axis arrow (Optimized mode read-out) -------------
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle) return;
    const disposeArrow = () => {
      if (!undercutArrowRef.current) return;
      handle.scene.remove(undercutArrowRef.current);
      disposeArrowGroup(undercutArrowRef.current);
      undercutArrowRef.current = null;
    };
    disposeArrow();
    if (
      mode !== "undercut" ||
      undercutAxisMode === "manual" ||
      !undercutResult ||
      !tx
    )
      return;
    const txMesh = txMeshRef.current;
    tx.geometry.computeBoundingSphere();
    const radius =
      (tx.geometry.boundingSphere?.radius ?? 10) * (txMesh?.scale.x ?? 1);
    const group = makeInsertionArrow(
      undercutResult.insertionAxis,
      undercutResult.center,
      radius,
    );
    handle.scene.add(group);
    undercutArrowRef.current = group;
    return disposeArrow;
  }, [mode, undercutAxisMode, undercutResult, tx]);

  // --- Draggable insertion arrow (Manual mode) ---------------------------
  // The arrow handle becomes the source of truth for the withdrawal vector:
  // a rotate gizmo re-aims it and, on drag end, commits the new axis and
  // triggers a live undercut recompute. Kept independent of `undercutResult`
  // so recomputes never rebuild (and snap back) the handle under the user.
  useEffect(() => {
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    if (!handle || !txMesh || !tx) return;
    if (mode !== "undercut" || undercutAxisMode !== "manual") return;

    if (!manualAxisRef.current) {
      manualAxisRef.current =
        undercutResult?.insertionAxis.clone() ?? new THREE.Vector3(0, 1, 0);
    }
    txMesh.updateMatrixWorld(true);
    tx.geometry.computeBoundingSphere();
    const bs = tx.geometry.boundingSphere;
    const radius = (bs?.radius ?? 10) * (txMesh.scale.x ?? 1);
    const center =
      undercutResult?.center.clone() ??
      (bs ? bs.center.clone().applyMatrix4(txMesh.matrixWorld) : new THREE.Vector3());

    const group = makeDraggableInsertionArrow(
      manualAxisRef.current,
      center,
      radius,
    );
    handle.scene.add(group);
    undercutArrowRef.current = group;

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
        // Drag ended: commit the aimed axis with a final, un-throttled solve.
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
      if (undercutArrowRef.current) {
        handle.scene.remove(undercutArrowRef.current);
        disposeArrowGroup(undercutArrowRef.current);
        undercutArrowRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, undercutAxisMode, tx]);

  // --- Compute 2D cross-section profiles (pre + tx) per section -----------
  // Triangle-vs-plane intersection on both meshes, projected into the
  // plane's 2D basis (dir = x, in-plane up = y). Re-runs when sections
  // change (drag-release, mode entry, recompute). Re-run after re-aligning
  // by hitting "Reset cuts".
  const crossSectionData = useMemo<CrossSectionData[]>(() => {
    if (mode !== "section" || sections.length === 0 || !pre || !tx) return [];
    const txMesh = txMeshRef.current;
    const preMesh = preMeshRef.current;
    if (!txMesh || !preMesh) return [];
    return computeCrossSectionProfiles(
      sections,
      preMesh,
      pre.geometry,
      txMesh,
      tx.geometry,
      sectionSize.width,
    );
    // sectionSize is intentionally NOT a dep: it only affects the fallback
    // bounds (used when no intersection segments exist), which is a
    // visualization edge case — not worth recomputing on every slider tick.
  }, [sections, mode, pre, tx, sectionRecomputeKey]);

  // Apply width/height to the existing plane meshes without rebuilding the
  // section group (so the gizmo doesn't flicker while a slider is dragged).
  useEffect(() => {
    for (const { plane, edges } of sectionPlanesRef.current) {
      plane.scale.set(sectionSize.width, sectionSize.height, 1);
      edges.scale.set(sectionSize.width, sectionSize.height, 1);
    }
  }, [sectionSize]);

  // Toggle each section's gizmo between translate and rotate in place.
  useEffect(() => {
    for (const tc of sectionTcsRef.current) tc.setMode(sectionGizmoMode);
  }, [sectionGizmoMode]);

  // --- On-model contour overlay (clip mode only) --------------------------
  // Lifts the computed 2D cross-section segments back into 3D and draws them
  // as crisp outlines right at the cut, so the slice reads as a true section
  // (tx solid, pre dashed). Rebuilds on cut change; the live clip itself
  // tracks the gizmo during drag, the contour refreshes on release.
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
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pts, 3),
      );
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

  // --- Zoom camera onto the painted prep region ----------------------------
  const zoomToPrep = () => {
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    const preMesh = preMeshRef.current;
    if (!handle || !txMesh || !tx) return;
    const labels = labelsRef.current;
    const box = new THREE.Box3();
    if (
      labels &&
      labelGeomUuidRef.current === tx.geometry.uuid &&
      hasPrepLabels(labels)
    ) {
      txMesh.updateMatrixWorld(true);
      const pos = tx.geometry.attributes.position;
      const v = new THREE.Vector3();
      const prepWorld: THREE.Vector3[] = [];
      if (pos) {
        for (let i = 0; i < labels.length; i++) {
          if (labels[i] !== LABEL_PREP) continue;
          v.fromBufferAttribute(pos, i).applyMatrix4(txMesh.matrixWorld);
          box.expandByPoint(v);
          prepWorld.push(v.clone());
        }
      }
      // Include the corresponding region of the pre scan (the gum/anatomy
      // around the prep) so it stays in frame after Zoom even if the scans
      // are slightly offset. Use nearest-neighbor: for each pre vertex
      // close to the prep centroid, expand the box.
      if (preMesh && pre && prepWorld.length > 0) {
        preMesh.updateMatrixWorld(true);
        const prePos = pre.geometry.attributes.position;
        if (prePos) {
          const center = box.getCenter(new THREE.Vector3());
          const radius = box.getSize(new THREE.Vector3()).length();
          const r2 = radius * radius;
          const stride = Math.max(1, Math.floor(prePos.count / 8000));
          const pv = new THREE.Vector3();
          for (let i = 0; i < prePos.count; i += stride) {
            pv.fromBufferAttribute(prePos, i).applyMatrix4(
              preMesh.matrixWorld,
            );
            if (pv.distanceToSquared(center) <= r2) box.expandByPoint(pv);
          }
        }
      }
    }
    if (box.isEmpty()) {
      const objs = [txMesh, preMesh].filter(Boolean) as THREE.Object3D[];
      if (objs.length) frameObjects(handle, objs);
      return;
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitDist =
      maxDim / (2 * Math.tan((Math.PI * handle.camera.fov) / 360));
    const dir = new THREE.Vector3()
      .subVectors(handle.camera.position, handle.controls.target)
      .normalize();
    if (!isFinite(dir.x) || dir.lengthSq() < 1e-6) {
      dir.set(0.4, 0.4, 1).normalize();
    }
    handle.camera.position
      .copy(center)
      .add(dir.multiplyScalar(fitDist * 1.8));
    handle.controls.target.copy(center);
    handle.camera.near = Math.max(0.01, fitDist / 100);
    handle.camera.far = fitDist * 100;
    handle.camera.updateProjectionMatrix();
  };

  // --- Occlusal view: auto-detect the biting plane and look straight at it ---
  const occlusalView = () => {
    const handle = sceneRef.current;
    const txMesh = txMeshRef.current;
    const preMesh = preMeshRef.current;
    if (!handle || !txMesh || !tx) return;

    // If a prep is painted, use its centroid to disambiguate which side of the
    // occlusal axis is the biting surface (crowns sit above the gingiva).
    let towardBiting: THREE.Vector3 | undefined;
    const labels = labelsRef.current;
    if (
      labels &&
      labelGeomUuidRef.current === tx.geometry.uuid &&
      hasPrepLabels(labels)
    ) {
      txMesh.updateMatrixWorld(true);
      const pos = tx.geometry.attributes.position;
      if (pos) {
        const v = new THREE.Vector3();
        const c = new THREE.Vector3();
        let n = 0;
        for (let i = 0; i < labels.length; i++) {
          if (labels[i] !== LABEL_PREP) continue;
          v.fromBufferAttribute(pos, i).applyMatrix4(txMesh.matrixWorld);
          c.add(v);
          n++;
        }
        if (n > 0) towardBiting = c.multiplyScalar(1 / n);
      }
    }

    const frame = computeOcclusalFrame(txMesh, { towardBiting });
    if (!frame) return;
    const objs = [txMesh, preMesh].filter(Boolean) as THREE.Object3D[];
    // Look down the occlusal axis (from the biting side). camera.up = crossDir
    // (buccolingual) so the long (mesiodistal) arch axis lies horizontally.
    frameAlongAxis(handle, objs, frame.occlusal, frame.crossDir);
  };

  // --- Reset alignment to identity ---------------------------------------
  const resetAlignment = () => {
    const preMesh = preMeshRef.current;
    if (!preMesh) return;
    preMesh.position.set(0, 0, 0);
    preMesh.rotation.set(0, 0, 0);
    force((n) => n + 1);
    setSectionRecomputeKey((k) => k + 1);
    setAutoStatus({ state: "idle" });
    if (mode === "heatmap") {
      // Force a heatmap recompute
      setMode("align");
      setTimeout(() => setMode("heatmap"), 0);
    }
  };

  // --- Prep mask actions -------------------------------------------------
  // Per-region marked counts. `prepCount` (used for step-readiness) spans every
  // prep-like label so marking margin/occlusal alone still counts as a prep.
  const { prepCount, prepOnlyCount, marginalCount, occlusalCount } = (() => {
    const labels = labelsRef.current;
    if (!labels)
      return {
        prepCount: 0,
        prepOnlyCount: 0,
        marginalCount: 0,
        occlusalCount: 0,
      };
    const prepOnly = countLabel(labels, LABEL_PREP);
    const marginal = countLabel(labels, LABEL_MARGINAL);
    const occlusal = countLabel(labels, LABEL_OCCLUSAL);
    return {
      prepCount: prepOnly + marginal + occlusal,
      prepOnlyCount: prepOnly,
      marginalCount: marginal,
      occlusalCount: occlusal,
    };
  })();

  // --- Per-region reduction readout (heatmap card) -----------------------
  // Each selected region is scored against its own clearance target; "all"
  // expands to a per-region breakdown so the under-reduced area is obvious.
  const heatmapStats = useMemo<RegionReductionStat[]>(() => {
    if (mode !== "heatmap") return [];
    const txMesh = txMeshRef.current;
    const preMesh = preMeshRef.current;
    const labels = labelsRef.current;
    if (
      !txMesh ||
      !preMesh ||
      !tx ||
      !pre ||
      !labels ||
      labelGeomUuidRef.current !== tx.geometry.uuid ||
      !hasPrepLabels(labels)
    )
      return [];
    txMesh.updateMatrixWorld(true);
    preMesh.updateMatrixWorld(true);
    const material = getMaterial(heatMaterialId);
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
        tx.geometry,
        txMesh.matrixWorld,
        pre.geometry,
        preMesh.matrixWorld,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    tx,
    pre,
    heatMaterialId,
    heatRegion,
    heatStep,
    prepCount,
    marginalCount,
    occlusalCount,
  ]);

  // --- Per-step "Save" --------------------------------------------------------
  // Each guided step gets an explicit Save button. Saving records the step in
  // `savedSteps`; a step counts as "done" only while its underlying data is
  // still valid (so re-painting/clearing reverts the badge without extra
  // bookkeeping).
  const [savedSteps, setSavedSteps] = useState<Set<ViewMode>>(new Set());
  const stepReady: Record<ViewMode, boolean> = {
    align: hasBoth,
    heatmap: hasBoth,
    label: prepCount > 0,
    section: savedSections.length > 0,
    undercut: undercutResult !== null,
  };
  const stepHint: Record<ViewMode, string> = {
    align: "Load both scans first",
    heatmap: "Load both scans first",
    label: "Paint a prep region first",
    section: 'Save at least one cut first ("Save cut")',
    undercut: "Solve an insertion path first",
  };
  const stepLabel: Record<ViewMode, string> = {
    align: "alignment",
    heatmap: "heatmap review",
    label: "prep label",
    section: "cross-sections",
    undercut: "insertion path",
  };
  const doneSteps = new Set<ViewMode>(
    [...savedSteps].filter((m) => stepReady[m]),
  );
  const saveStep = (m: ViewMode) => {
    if (!stepReady[m]) return;
    setSavedSteps((prev) => new Set(prev).add(m));
  };

  // Save the current working cut into the saved list (re-id'd + palette color)
  // so the Main App can offer it as a pre-configured cross-section view.
  const SECTION_PALETTE = [
    0x2a8fd8, 0xe0731a, 0x7d3ac1, 0x1c7d4d, 0xc41f1f,
  ];
  const saveCurrentCut = () => {
    const current = sections[0];
    if (!current) return;
    setSavedSections((prev) => {
      // Monotonic id: max existing + 1 so deleting then re-adding never reuses
      // an id (which would make default-section targeting ambiguous and break
      // React keys).
      const id = prev.reduce((m, s) => Math.max(m, s.id), -1) + 1;
      const saved: Section = {
        id,
        origin: current.origin.clone(),
        quaternion: current.quaternion.clone(),
        color: SECTION_PALETTE[prev.length % SECTION_PALETTE.length],
      };
      if (prev.length === 0) setDefaultSectionId(id);
      return [...prev, saved];
    });
  };

  // Build the in-memory PreState hand-off and advance to the analysis app.
  // Geometry is shared by reference; transforms/labels/camera are snapshotted.
  // The hand-off is gated on a COMPLETE PreState: both scans aligned, a prep
  // painted, at least one saved cross-section (with a chosen default) and a
  // finalized insertion path.
  const hasSavedSection = savedSections.length > 0 && defaultSectionId !== null;
  const hasInsertionPath = undercutResult !== null;
  const handoffChecklist: { label: string; done: boolean }[] = [
    { label: "Load both scans", done: hasBoth },
    { label: "Paint the prep region", done: prepCount > 0 },
    { label: "Save a cross-section (sets the default)", done: hasSavedSection },
    { label: "Solve the insertion path (Undercuts)", done: hasInsertionPath },
  ];
  const canGoToApp = handoffChecklist.every((c) => c.done);
  const handoffMissing = handoffChecklist.filter((c) => !c.done);
  const handleGoToApp = () => {
    const handle = sceneRef.current;
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    const labels = labelsRef.current;
    if (!handle || !preMesh || !txMesh || !pre || !tx || !labels) return;
    if (!hasPrepLabels(labels)) return;
    preMesh.updateMatrixWorld(true);
    txMesh.updateMatrixWorld(true);
    // Reuse the stored prep frame, or compute it fresh if the user never
    // entered Section mode.
    let frame = prepFrame;
    if (!frame) {
      const camUp = new THREE.Vector3();
      handle.camera.matrixWorld.extractBasis(
        new THREE.Vector3(),
        camUp,
        new THREE.Vector3(),
      );
      frame = computePrepFrame(txMesh, tx.geometry, labels, camUp);
    }
    if (!frame) return;
    // Insertion axis: the solved/used one if available, else the occlusal up.
    const insertion =
      undercutResult?.insertionAxis.clone().normalize() ?? frame.up.clone();
    const saved = savedSections.length > 0 ? savedSections : sections;
    const defId = defaultSectionId ?? (saved.length > 0 ? saved[0].id : 0);
    const state: PreState = {
      preGeom: pre.geometry,
      txGeom: tx.geometry,
      preName: pre.name,
      txName: tx.name,
      preMatrix: preMesh.matrixWorld.clone(),
      txMatrix: txMesh.matrixWorld.clone(),
      labels: labels.slice(),
      prepFrame: frame,
      insertionAxis: [insertion.x, insertion.y, insertion.z],
      undercutAxisMode,
      sections: saved.map((s) => ({
        id: s.id,
        origin: s.origin.clone(),
        quaternion: s.quaternion.clone(),
        color: s.color,
      })),
      defaultSectionId: defId,
      camera: captureCamera(handle),
    };
    onComplete?.(state);
  };

  const clearLabels = () => {
    const labels = labelsRef.current;
    const txMesh = txMeshRef.current;
    if (!labels || !txMesh) return;
    labels.fill(LABEL_UNLABELED);
    labelsToColors(labels, txMesh.geometry);
    forceLabel((n) => n + 1);
  };

  // --- Apply pasted 4x4 rigid transform ----------------------------------
  const applyPastedTransform = () => {
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (!preMesh || !txMesh) return;
    // Strip XML-ish wrappers, commas, brackets — accept just about anything.
    const cleaned = pasteText
      .replace(/<[^>]+>/g, " ")
      .replace(/[,;[\]()]/g, " ");
    const nums = cleaned
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number);
    if (nums.length !== 16 || nums.some((n) => !Number.isFinite(n))) {
      setPasteError(
        `Need 16 numbers (row-major 4×4). Got ${nums.length}.`,
      );
      return;
    }
    // Row-major input → THREE.Matrix4.set is row-major too.
    const m = new THREE.Matrix4().set(
      nums[0], nums[1], nums[2], nums[3],
      nums[4], nums[5], nums[6], nums[7],
      nums[8], nums[9], nums[10], nums[11],
      nums[12], nums[13], nums[14], nums[15],
    );
    // Decompose; ignore scale (treat as rigid).
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    m.decompose(pos, quat, scl);
    preMesh.position.copy(pos);
    preMesh.quaternion.copy(quat);
    // Keep pre's existing scale (we never user-scaled it).
    preMesh.updateMatrixWorld(true);
    setPasteError(null);
    setPasteOpen(false);
    setAutoStatus({ state: "idle" });
    force((n) => n + 1);
    setSectionRecomputeKey((k) => k + 1);
    if (mode === "heatmap") {
      setMode("align");
      setTimeout(() => setMode("heatmap"), 0);
    }
  };

  // --- Auto-register pre onto tx (ICP) -----------------------------------
  const autoAlign = () => {
    const preMesh = preMeshRef.current;
    const txMesh = txMeshRef.current;
    if (!preMesh || !txMesh) return;
    setAutoStatus({ state: "running" });
    // Defer so the spinner can paint before the synchronous ICP runs.
    setTimeout(() => {
      try {
        const result = icpAlign(preMesh, txMesh, {
          iterations: 60,
          samples: 6000,
          // Trimmed ICP: reject the prepped/changed surface and noise so the
          // fit locks onto the unchanged anatomy and RMSE reflects true overlap.
          trimRatio: 0.75,
        });
        force((n) => n + 1);
        setSectionRecomputeKey((k) => k + 1);
        setAutoStatus({
          state: "done",
          rmse: result.rmse,
          fullRmse: result.fullRmse,
          iterations: result.iterations,
          inliers: result.inliers,
          samples: result.samples,
        });
        if (mode === "heatmap") {
          setMode("align");
          setTimeout(() => setMode("heatmap"), 0);
        }
      } catch (e) {
        console.error(e);
        setAutoStatus({ state: "idle" });
      }
    }, 30);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#dde6ef] font-['Inter'] text-[#1c1f24] antialiased">
      {inIframe && !hasBoth && (
        <a
          href={typeof window !== "undefined" ? window.location.href : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-b border-[#f0d99a] bg-[#fff7e6] px-4 py-2 text-[12.5px] font-medium text-[#7a5810] no-underline transition hover:bg-[#fff0cf]"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Drag-and-drop is blocked inside the canvas board. Click here to open
          this uploader in a new tab where drag-and-drop works.
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-[#cbd6e2] bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2a8fd8] text-white">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold leading-tight">
              Prep Reduction QC
            </div>
            <div className="text-[11.5px] text-[#5a6270]">
              Upload, align, and view heatmap — all on one screen.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pre && (
            <LoadedChip
              label="Pre"
              color="#2a8fd8"
              value={pre}
              onClear={() => setPre(null)}
            />
          )}
          {tx && (
            <LoadedChip
              label="Tx"
              color="#1c1f24"
              value={tx}
              onClear={() => setTx(null)}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            value={mode}
            onChange={setMode}
            options={[
              { value: "align", label: "Align", icon: Hand },
              { value: "heatmap", label: "Heatmap", icon: Flame },
              { value: "label", label: "Label", icon: Brush },
              { value: "section", label: "Section", icon: Scissors },
              { value: "undercut", label: "Undercuts", icon: Magnet },
            ]}
            disabled={!hasBoth}
            done={doneSteps}
          />
          {mode === "align" && hasBoth && (
            <ToggleGroup
              value={gizmo}
              onChange={setGizmo}
              options={[
                { value: "translate", label: "Move", icon: Move3D },
                { value: "rotate", label: "Rotate", icon: RotateCw },
              ]}
              disabled={false}
            />
          )}
          {mode === "section" && hasBoth && (
            <>
              <button
                type="button"
                onClick={() => setSectionRecomputeKey((k) => k + 1)}
                disabled={sectionStatus !== "ok"}
                className={[
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                  sectionStatus === "ok"
                    ? "border-[#cbd6e2] bg-white text-[#1c1f24] hover:bg-[#f4f7fa]"
                    : "cursor-not-allowed border-[#e2e7ee] bg-[#f4f7fa] text-[#a0a8b4]",
                ].join(" ")}
                title="Re-fit the cuts to the auto-detected occlusal axis"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Reset cut
              </button>
              <button
                type="button"
                onClick={saveCurrentCut}
                disabled={sectionStatus !== "ok" || sections.length === 0}
                className={[
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                  sectionStatus === "ok" && sections.length > 0
                    ? "border-[#cbd6e2] bg-white text-[#1c1f24] hover:bg-[#f4f7fa]"
                    : "cursor-not-allowed border-[#e2e7ee] bg-[#f4f7fa] text-[#a0a8b4]",
                ].join(" ")}
                title="Save this cross-section for the analysis app"
              >
                <Scissors className="h-3.5 w-3.5" />
                Save cut
                {savedSections.length > 0 ? ` (${savedSections.length})` : ""}
              </button>
              {sectionStatus === "no-prep" && (
                <span className="rounded-md border border-[#f0d7a4] bg-[#fcf3df] px-2 py-1 text-[11px] font-medium text-[#7a5a14]">
                  Couldn't fit a cut to this scan
                </span>
              )}
            </>
          )}
          {mode === "undercut" && hasBoth && (
            <>
              <button
                type="button"
                onClick={() => setUndercutRecomputeKey((k) => k + 1)}
                disabled={undercutStatus !== "ok"}
                className={[
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                  undercutStatus === "ok"
                    ? "border-[#cbd6e2] bg-white text-[#1c1f24] hover:bg-[#f4f7fa]"
                    : "cursor-not-allowed border-[#e2e7ee] bg-[#f4f7fa] text-[#a0a8b4]",
                ].join(" ")}
                title="Re-run the undercut analysis"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Recompute
              </button>
              {undercutStatus === "no-prep" && (
                <span className="rounded-md border border-[#f0d7a4] bg-[#fcf3df] px-2 py-1 text-[11px] font-medium text-[#7a5a14]">
                  Paint a prep region in Label mode first
                </span>
              )}
            </>
          )}
          {hasBoth && (
            <button
              type="button"
              onClick={() => saveStep(mode)}
              disabled={!stepReady[mode]}
              className={[
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition",
                doneSteps.has(mode)
                  ? "border-[#1c7d4d] bg-[#eaf7ee] text-[#1c7d4d] hover:bg-[#dcf0e2]"
                  : stepReady[mode]
                    ? "border-[#1c7d4d] bg-white text-[#1c7d4d] hover:bg-[#eaf7ee]"
                    : "cursor-not-allowed border-[#e2e7ee] bg-[#f4f7fa] text-[#a0a8b4]",
              ].join(" ")}
              title={
                stepReady[mode]
                  ? `Save the ${stepLabel[mode]} step`
                  : stepHint[mode]
              }
            >
              {doneSteps.has(mode) ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {doneSteps.has(mode) ? "Saved" : "Save step"}
            </button>
          )}
          {tx && (
            <button
              type="button"
              onClick={occlusalView}
              className="flex items-center gap-1.5 rounded-md border border-[#cbd6e2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1c1f24] transition hover:bg-[#f4f7fa]"
              title="Auto-detect the jaw's occlusal axis and look straight at the biting surface"
            >
              <ArrowDownToDot className="h-3.5 w-3.5" />
              Occlusal view
            </button>
          )}
          {hasBoth && (
            <button
              type="button"
              onClick={zoomToPrep}
              className="flex items-center gap-1.5 rounded-md border border-[#cbd6e2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1c1f24] transition hover:bg-[#f4f7fa]"
              title="Zoom the camera onto the painted prep region"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              Zoom to prep
            </button>
          )}
          {mode !== "label" && <>
          <button
            type="button"
            onClick={autoAlign}
            disabled={!hasBoth || autoStatus.state === "running"}
            className={[
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition",
              hasBoth && autoStatus.state !== "running"
                ? "border-[#2a8fd8] bg-[#2a8fd8] text-white hover:bg-[#1f7ec0]"
                : "cursor-not-allowed border-[#cbd6e2] bg-[#e6eef7] text-[#7a8597]",
            ].join(" ")}
            title="Auto-register pre onto tx (ICP)"
          >
            {autoStatus.state === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {autoStatus.state === "running" ? "Aligning…" : "Auto-align"}
          </button>
          {autoStatus.state === "done" && (
            <span
              className="rounded-md border border-[#cfe5d4] bg-[#eaf7ee] px-2 py-1 text-[11px] font-medium text-[#266b3a]"
              title={`${autoStatus.iterations} ICP iterations · fit on best ${autoStatus.inliers}/${autoStatus.samples} matched points (prep/outliers rejected) · all-points RMSE ${autoStatus.fullRmse.toFixed(3)} mm`}
            >
              RMSE {autoStatus.rmse.toFixed(3)} mm
              <span className="ml-1 font-normal text-[#5a8568]">
                (all {autoStatus.fullRmse.toFixed(3)})
              </span>
            </span>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPasteError(null);
                setPasteOpen((v) => !v);
              }}
              disabled={!hasBoth}
              className={[
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                hasBoth
                  ? "border-[#cbd6e2] bg-white text-[#1c1f24] hover:bg-[#f4f7fa]"
                  : "cursor-not-allowed border-[#e2e7ee] bg-[#f4f7fa] text-[#a0a8b4]",
              ].join(" ")}
              title="Paste a 4×4 rigid transform matrix"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste matrix
            </button>
            {pasteOpen && hasBoth && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[340px] rounded-lg border border-[#cbd6e2] bg-white p-3 shadow-xl">
                <div className="mb-1.5 text-[11.5px] font-semibold text-[#1c1f24]">
                  Apply 4×4 rigid transform
                </div>
                <div className="mb-2 text-[11px] leading-snug text-[#5a6270]">
                  Paste 16 numbers (row-major). Tags, commas, brackets, and
                  whitespace are all ignored.
                </div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full resize-none rounded-md border border-[#cbd6e2] bg-[#f8fafc] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-[#1c1f24] focus:border-[#2a8fd8] focus:outline-none"
                />
                {pasteError && (
                  <div className="mt-1.5 text-[11px] font-medium text-[#b13b3b]">
                    {pasteError}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPasteOpen(false)}
                    className="rounded-md border border-[#cbd6e2] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#1c1f24] hover:bg-[#f4f7fa]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyPastedTransform}
                    className="rounded-md border border-[#2a8fd8] bg-[#2a8fd8] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-[#1f7ec0]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={resetAlignment}
            disabled={!hasBoth}
            className={[
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
              hasBoth
                ? "border-[#cbd6e2] bg-white text-[#1c1f24] hover:bg-[#f4f7fa]"
                : "cursor-not-allowed border-[#e2e7ee] bg-[#f4f7fa] text-[#a0a8b4]",
            ].join(" ")}
            title="Reset alignment"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleGoToApp}
              disabled={!canGoToApp}
              className={[
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition",
                canGoToApp
                  ? "border-[#1c7d4d] bg-[#1c7d4d] text-white hover:bg-[#176a41]"
                  : "cursor-not-allowed border-[#cbd6e2] bg-[#e6eef7] text-[#7a8597]",
              ].join(" ")}
              title={
                canGoToApp
                  ? "Save this prep and continue to the analysis app"
                  : `Finish first: ${handoffMissing
                      .map((c) => c.label)
                      .join(", ")}`
              }
            >
              Go to App
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          </>}
        </div>
      </header>

      {/* Viewer */}
      <div className="relative flex flex-1 overflow-hidden">
        {hasBoth ? (
          <>
            <div className="relative flex-1">
              <div ref={hostRef} className="absolute inset-0" />
              {/* Hand-off checklist — shows what's still needed before the
                  analysis app can be opened with a complete PreState. */}
              {!canGoToApp && (
                <div className="absolute right-4 top-4 w-[238px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
                  <div className="mb-2 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-[#1c7d4d]" />
                    <div className="text-[12.5px] font-semibold text-[#1c1f24]">
                      Before "Go to App"
                    </div>
                  </div>
                  <div className="space-y-1">
                    {handoffChecklist.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-center gap-2 text-[11.5px]"
                      >
                        <span
                          className={[
                            "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                            c.done
                              ? "bg-[#1c7d4d] text-white"
                              : "border border-[#cbd6e2] text-[#a0a8b4]",
                          ].join(" ")}
                        >
                          {c.done ? "✓" : ""}
                        </span>
                        <span
                          className={
                            c.done ? "text-[#5a6270]" : "text-[#1c1f24]"
                          }
                        >
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Screen-space scale bar — width + label set per frame. */}
              <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col items-start gap-1">
                <span
                  ref={scaleLabelRef}
                  className="rounded bg-white/85 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-[#1c1f24] shadow-sm ring-1 ring-[#cbd6e2]"
                >
                  1 mm
                </span>
                <div
                  ref={scaleBarRef}
                  className="h-[6px] border-x-2 border-b-2 border-[#1c1f24]"
                  style={{ width: "96px" }}
                />
              </div>
              <Legend
                kind={
                  mode === "heatmap"
                    ? "heatmap"
                    : mode === "undercut"
                      ? "undercut"
                      : null
                }
                step={heatStep}
                onStep={setHeatStep}
              />
              <HelpCard mode={mode} />
              <OpacityPanel
                preOpacity={preOpacity}
                onPreOpacity={setPreOpacity}
                preVisible={preVisible}
                onPreVisible={setPreVisible}
                txOpacity={txOpacity}
                onTxOpacity={setTxOpacity}
                txVisible={txVisible}
                onTxVisible={setTxVisible}
              />
              {mode === "label" && (
                <LabelPanel
                  tool={labelTool}
                  onTool={setLabelTool}
                  brushPct={brushPct}
                  onBrushPct={setBrushPct}
                  prepOnlyCount={prepOnlyCount}
                  marginalCount={marginalCount}
                  occlusalCount={occlusalCount}
                  onClear={clearLabels}
                  onDone={() => setMode("heatmap")}
                />
              )}
              {mode === "heatmap" && (
                <HeatmapControlPanel
                  materialId={heatMaterialId}
                  onMaterialId={setHeatMaterialId}
                  region={heatRegion}
                  onRegion={setHeatRegion}
                  showOnlyMarked={showOnlyMarked}
                  onShowOnlyMarked={setShowOnlyMarked}
                  stats={heatmapStats}
                />
              )}
              {mode === "section" && sections.length > 0 && (
                <SectionControlPanel
                  planeType={sectionPlaneType}
                  onPlaneType={setSectionPlaneType}
                  viewMode={sectionViewMode}
                  onViewMode={setSectionViewMode}
                  gizmoMode={sectionGizmoMode}
                  onGizmoMode={setSectionGizmoMode}
                  size={sectionSize}
                  onSize={setSectionSize}
                />
              )}
              {mode === "undercut" && (
                <UndercutControlPanel
                  axisMode={undercutAxisMode}
                  onAxisMode={setUndercutAxisMode}
                  result={undercutResult}
                  status={undercutStatus}
                />
              )}
              {mode === "section" && savedSections.length > 0 && (
                <SavedCutsPanel
                  saved={savedSections}
                  defaultId={defaultSectionId}
                  onDefault={setDefaultSectionId}
                  onRemove={(id) =>
                    setSavedSections((prev) => {
                      const next = prev.filter((s) => s.id !== id);
                      if (defaultSectionId === id) {
                        setDefaultSectionId(
                          next.length > 0 ? next[0].id : null,
                        );
                      }
                      return next;
                    })
                  }
                />
              )}
            </div>
            {mode === "section" && crossSectionData.length > 0 && (
              <SectionPanel data={crossSectionData} />
            )}
          </>
        ) : (
          <DropArea pre={pre} tx={tx} onPre={setPre} onTx={setTx} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loaded chip — compact header summary for a file that's already loaded.
// ---------------------------------------------------------------------------
function LoadedChip({
  label,
  color,
  value,
  onClear,
}: {
  label: string;
  color: string;
  value: UploadedGeom;
  onClear: () => void;
}) {
  const verts = value.geometry.attributes.position?.count ?? 0;
  return (
    <div
      className="flex items-center gap-2 rounded-md border bg-white px-2.5 py-1.5"
      style={{ borderColor: color + "55" }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{ backgroundColor: color + "22", color }}
      >
        <FileBox className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
          {label}
        </div>
        <div className="max-w-[180px] truncate text-[12px] font-medium text-[#1c1f24]">
          {value.name}
        </div>
        <div className="text-[10.5px] tabular-nums text-[#8a93a3]">
          {verts.toLocaleString()} verts
        </div>
      </div>
      <button
        onClick={onClear}
        className="ml-1 flex h-6 w-6 items-center justify-center rounded text-[#8a93a3] hover:bg-[#f0f3f7] hover:text-[#1c1f24]"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop area — two big drag-and-drop zones for Pre and Tx scans.
// ---------------------------------------------------------------------------
function DropArea({
  pre,
  tx,
  onPre,
  onTx,
}: {
  pre: UploadedGeom | null;
  tx: UploadedGeom | null;
  onPre: (g: UploadedGeom | null) => void;
  onTx: (g: UploadedGeom | null) => void;
}) {
  return (
    <div className="grid h-full w-full grid-cols-1 gap-6 p-8 md:grid-cols-2">
      <DropZone
        label="Pre-treatment scan"
        sublabel="The reference anatomy before preparation"
        color="#2a8fd8"
        loaded={!!pre}
        onChange={onPre}
      />
      <DropZone
        label="Treatment scan"
        sublabel="The prepared tooth to analyze"
        color="#1c1f24"
        loaded={!!tx}
        onChange={onTx}
      />
    </div>
  );
}

function DropZone({
  label,
  sublabel,
  color,
  loaded,
  onChange,
}: {
  label: string;
  sublabel: string;
  color: string;
  loaded: boolean;
  onChange: (g: UploadedGeom | null) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".ply")) {
      setError("Only .ply files are supported.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const geometry = await parsePly(buf);
      onChange({ name: file.name, geometry });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("Couldn't parse this .ply file. " + msg);
    } finally {
      setBusy(false);
    }
  };

  if (loaded) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed bg-white/60"
        style={{ borderColor: color + "55" }}
      >
        <div className="text-center">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: color + "22", color }}
          >
            <FileBox className="h-5 w-5" />
          </div>
          <div className="mt-3 text-[14px] font-semibold text-[#1c1f24]">
            {label} loaded
          </div>
          <div className="mt-1 text-[12px] text-[#5a6270]">
            Waiting for the other scan…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={[
        "flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-8 text-center transition",
        drag
          ? "scale-[1.01] shadow-lg"
          : "hover:bg-[#f7fafd]",
      ].join(" ")}
      style={{
        borderColor: drag ? color : "#cbd6e2",
        backgroundColor: drag ? color + "0d" : undefined,
      }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: color + "1a", color }}
      >
        {busy ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Upload className="h-7 w-7" />
        )}
      </div>
      <div className="mt-4 text-[18px] font-semibold text-[#1c1f24]">
        Drop {label.toLowerCase()} here
      </div>
      <div className="mt-1 text-[13px] text-[#5a6270]">{sublabel}</div>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#f4f7fa] px-3 py-1 text-[11.5px] text-[#5a6270]">
        <MousePointer2 className="h-3 w-3" />
        Drag a <code className="mx-0.5 rounded bg-white px-1">.ply</code> file
        onto this panel
      </div>
      {error && (
        <div className="mt-3 text-[12px] text-[#a3331c]">{error}</div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Help card — shown over the viewer.
// ---------------------------------------------------------------------------
function HelpCard({ mode }: { mode: ViewMode }) {
  if (mode === "label") return null;
  return (
    <div className="absolute right-4 top-4 max-w-[280px] rounded-md bg-white/90 px-3 py-2 text-[11.5px] leading-snug text-[#5a6270] shadow-md ring-1 ring-[#cbd6e2] backdrop-blur">
      {mode === "align" ? (
        <>
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
            Align mode
          </div>
          Drag the colored arrows on the reference (peach) mesh to slide it
          onto the gray treatment scan. Switch to <b>Rotate</b> for the rings.
          Use the mouse to orbit (right-click to pan, scroll to zoom).
        </>
      ) : mode === "section" ? (
        <>
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
            Section mode
          </div>
          Pick an <b>Anatomical plane</b> — <b>Sagittal</b>, <b>Coronal</b>,
          or <b>Axial</b> — and the cut auto-aligns to the prep's own axes.
          Choose a <b>View</b>: <b>Overlay</b> shows a translucent plane over
          the full model, while <b>Clip</b> slices the model so the
          cross-section appears on it in 3D and updates live as you drag. Use
          the gizmo toggle to switch between <b>Move</b> (X / Y / Z arrows)
          and <b>Rotate</b> (rings), and resize the plane with the{" "}
          <b>Width</b> / <b>Height</b> sliders. The right-side panel shows the
          pre vs treatment profile at the current cut with five reduction
          distances in millimeters. Hit <b>Reset cut</b> to re-fit the prep
          axes to the auto-detected occlusal axis. Paint a prep region in Label
          mode first if there isn't one yet.
        </>
      ) : mode === "undercut" ? (
        <>
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
            Undercut mode
          </div>
          The prep is colored by its draft relative to an insertion
          (withdrawal) path — the blue arrow. <b>Green</b> surfaces draw out
          cleanly; <b>yellow → red</b> are undercuts that trap the crown.
          Choose <b>Optimized</b> to let the tool solve the path that minimizes
          undercut area, or <b>Occlusal</b> to score the auto-detected occlusal
          axis. The <b>Draft tolerance</b> slider lets you require extra taper.
          The whole painted prep is treated as one restoration, so it reports a
          single common path; results can shift on partial scans. Paint a prep
          in Label mode first if there isn't one.
        </>
      ) : (
        <>
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
            Heatmap mode
          </div>
          Each treatment-scan vertex is colored by its distance to the closest
          reference-scan point. Switch back to <b>Align</b> to fine-tune the
          fit.
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label panel — paint the prep region; heatmap is then restricted to it.
// ---------------------------------------------------------------------------
function LabelPanel({
  tool,
  onTool,
  brushPct,
  onBrushPct,
  prepOnlyCount,
  marginalCount,
  occlusalCount,
  onClear,
  onDone,
}: {
  tool: LabelTool;
  onTool: (t: LabelTool) => void;
  brushPct: number;
  onBrushPct: (n: number) => void;
  prepOnlyCount: number;
  marginalCount: number;
  occlusalCount: number;
  onClear: () => void;
  onDone: () => void;
}) {
  const total = prepOnlyCount + marginalCount + occlusalCount;
  const ready = total > 0;
  return (
    <div className="absolute left-4 top-[200px] w-[280px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Brush className="h-4 w-4 text-[#2a8fd8]" />
        <div className="text-[12.5px] font-semibold text-[#1c1f24]">
          Mark the prep
        </div>
      </div>
      <div className="mb-2 text-[11px] leading-snug text-[#5a6270]">
        Paint over the prepared tooth surface. When you switch to{" "}
        <b>Heatmap</b>, the reduction colors will only be shown inside this
        region. <b>Left-click</b> to paint, <b>right-click</b> to orbit,
        scroll to zoom.
      </div>

      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
        Brush
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1">
        <ToolBtn
          active={tool === "prep"}
          onClick={() => onTool("prep")}
          color="#f24747"
          icon={<Square className="h-3 w-3" />}
          label="Prep"
        />
        <ToolBtn
          active={tool === "marginal"}
          onClick={() => onTool("marginal")}
          color="#14b8a6"
          icon={<Square className="h-3 w-3" />}
          label="Marginal"
        />
        <ToolBtn
          active={tool === "occlusal"}
          onClick={() => onTool("occlusal")}
          color="#8b5cf6"
          icon={<Square className="h-3 w-3" />}
          label="Occlusal"
        />
        <ToolBtn
          active={tool === "erase"}
          onClick={() => onTool("erase")}
          color="#8a93a3"
          icon={<Eraser className="h-3 w-3" />}
          label="Erase"
        />
      </div>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[10.5px] text-[#5a6270]">
          <span>Brush size</span>
          <span className="tabular-nums">{brushPct}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={brushPct}
          onChange={(e) => onBrushPct(Number(e.target.value))}
          className="w-full accent-[#2a8fd8]"
        />
      </div>

      <div className="mb-2 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-[#5a6270]">
            Marked vertices
          </div>
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#8a93a3] hover:bg-[#f0f3f7] hover:text-[#1c1f24]"
            title="Clear the prep mask"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center text-[10.5px]">
          <RegionCount color="#f24747" label="Prep" count={prepOnlyCount} />
          <RegionCount color="#14b8a6" label="Marginal" count={marginalCount} />
          <RegionCount color="#8b5cf6" label="Occlusal" count={occlusalCount} />
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        disabled={!ready}
        className={[
          "mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[12px] font-semibold transition",
          ready
            ? "border-[#2a8fd8] bg-[#2a8fd8] text-white hover:bg-[#1f7ec0]"
            : "cursor-not-allowed border-[#cbd6e2] bg-[#e6eef7] text-[#7a8597]",
        ].join(" ")}
        title={
          ready
            ? "Show the reduction heatmap inside the marked region"
            : "Paint at least one prep stroke first"
        }
      >
        <Flame className="h-3.5 w-3.5" />
        Show reduction heatmap
      </button>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition",
        active
          ? "text-white"
          : "border-[#cbd6e2] bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
      ].join(" ")}
      style={
        active
          ? { backgroundColor: color, borderColor: color }
          : undefined
      }
    >
      <span style={{ color: active ? "white" : color }}>{icon}</span>
      {label}
    </button>
  );
}

function RegionCount({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-md border border-[#e2e7ee] bg-[#f7f9fc] px-1 py-1">
      <div className="flex items-center justify-center gap-1">
        <span
          className="inline-block h-2 w-2 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-medium text-[#5a6270]">{label}</span>
      </div>
      <div className="tabular-nums text-[11px] font-semibold text-[#1c1f24]">
        {count.toLocaleString()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opacity panel — left-side controls for treatment / pre-treatment scans.
// ---------------------------------------------------------------------------
function SectionControlPanel({
  planeType,
  onPlaneType,
  viewMode,
  onViewMode,
  gizmoMode,
  onGizmoMode,
  size,
  onSize,
}: {
  planeType: SectionPlane;
  onPlaneType: (p: SectionPlane) => void;
  viewMode: SectionViewMode;
  onViewMode: (v: SectionViewMode) => void;
  gizmoMode: GizmoMode;
  onGizmoMode: (m: GizmoMode) => void;
  size: SectionSize;
  onSize: (s: SectionSize) => void;
}) {
  const MIN = 4;
  const MAX = 120;
  return (
    <div className="absolute left-4 top-[182px] w-[230px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
        Anatomical plane
      </div>
      <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-md border border-[#cbd6e2]">
        {([
          { value: "sagittal", label: "Sagittal" },
          { value: "coronal", label: "Coronal" },
          { value: "axial", label: "Axial" },
        ] as const).map(({ value, label }, i) => {
          const active = planeType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPlaneType(value)}
              className={[
                "px-1 py-1.5 text-[11px] font-medium transition",
                i < 2 ? "border-r border-[#cbd6e2]" : "",
                active
                  ? "bg-[#2a8fd8] text-white"
                  : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
              ].join(" ")}
              title={`${label} cut, auto-aligned to the prep`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
        View
      </div>
      <div className="mb-3 flex overflow-hidden rounded-md border border-[#cbd6e2]">
        {([
          { value: "overlay", label: "Overlay" },
          { value: "clip", label: "Clip" },
        ] as const).map(({ value, label }, i) => {
          const active = viewMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onViewMode(value)}
              className={[
                "flex-1 px-2 py-1.5 text-[12px] font-medium transition",
                i === 0 ? "border-r border-[#cbd6e2]" : "",
                active
                  ? "bg-[#2a8fd8] text-white"
                  : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
              ].join(" ")}
              title={
                value === "clip"
                  ? "Slice the model so the cut shows on it in 3D"
                  : "Translucent plane over the full model"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1c1f24]">
        Section plane
      </div>
      <div className="mb-3 flex overflow-hidden rounded-md border border-[#cbd6e2]">
        {([
          { value: "translate", label: "Move", Icon: Move3D },
          { value: "rotate", label: "Rotate", Icon: RotateCw },
        ] as const).map(({ value, label, Icon }, i) => {
          const active = gizmoMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onGizmoMode(value)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[12px] font-medium transition",
                i === 0 ? "border-r border-[#cbd6e2]" : "",
                active
                  ? "bg-[#2a8fd8] text-white"
                  : "bg-white text-[#1c1f24] hover:bg-[#f4f7fa]",
              ].join(" ")}
              title={`${label} the plane`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
      <SizeRow
        label="Width"
        value={size.width}
        min={MIN}
        max={MAX}
        onChange={(v) => onSize({ ...size, width: v })}
      />
      <div className="mt-2">
        <SizeRow
          label="Height"
          value={size.height}
          min={MIN}
          max={MAX}
          onChange={(v) => onSize({ ...size, height: v })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Undercut panel — pick the insertion-path source, set the draft tolerance,
// and read back the undercut metrics for the painted prep.
// ---------------------------------------------------------------------------
function UndercutControlPanel({
  axisMode,
  onAxisMode,
  result,
  status,
}: {
  axisMode: UndercutAxisMode;
  onAxisMode: (m: UndercutAxisMode) => void;
  result: UndercutResult | null;
  status: "idle" | "ok" | "no-prep";
}) {
  return (
    <div className="absolute left-4 top-[182px] w-[238px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Magnet className="h-4 w-4 text-[#2a8fd8]" />
        <div className="text-[12.5px] font-semibold text-[#1c1f24]">
          Insertion path
        </div>
      </div>
      <div className="mb-3 flex overflow-hidden rounded-md border border-[#cbd6e2]">
        {([
          { value: "optimized", label: "Optimized" },
          { value: "manual", label: "Manual" },
        ] as const).map(({ value, label }, i) => {
          const active = axisMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onAxisMode(value)}
              className={[
                "flex-1 px-2 py-1.5 text-[12px] font-medium transition",
                i < 1 ? "border-r border-[#cbd6e2]" : "",
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
        {status === "no-prep" ? (
          <div className="rounded-md border border-[#f0d7a4] bg-[#fcf3df] px-2 py-1.5 text-[11px] font-medium text-[#7a5a14]">
            Paint a prep region in Label mode first.
          </div>
        ) : status === "ok" && result ? (
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
                : "Reduce the red zones or re-prep for a clean draw."}{" "}
              The whole prep is treated as one restoration (single common
              path).
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
// Heatmap panel — pick the restorative material + region, then read per-region
// pass / under-reduced status against that region's clearance target.
// ---------------------------------------------------------------------------
function HeatmapControlPanel({
  materialId,
  onMaterialId,
  region,
  onRegion,
  showOnlyMarked,
  onShowOnlyMarked,
  stats,
}: {
  materialId: string;
  onMaterialId: (id: string) => void;
  region: PrepRegion;
  onRegion: (r: PrepRegion) => void;
  showOnlyMarked: boolean;
  onShowOnlyMarked: (v: boolean) => void;
  stats: RegionReductionStat[];
}) {
  const material = getMaterial(materialId);
  return (
    <div className="absolute left-4 top-[182px] w-[248px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Flame className="h-4 w-4 text-[#2a8fd8]" />
        <div className="text-[12.5px] font-semibold text-[#1c1f24]">
          Reduction clearance
        </div>
      </div>

      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
        Material
      </div>
      <select
        value={materialId}
        onChange={(e) => onMaterialId(e.target.value)}
        className="mb-3 w-full rounded-md border border-[#cbd6e2] bg-white px-2 py-1.5 text-[12px] text-[#1c1f24]"
      >
        {MATERIALS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.targetReductionMm.toFixed(1)} mm)
          </option>
        ))}
      </select>

      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5a6270]">
        Region
      </div>
      <div className="mb-2 flex overflow-hidden rounded-md border border-[#cbd6e2]">
        {([
          { value: "all", label: "All" },
          { value: "marginal", label: "Marginal" },
          { value: "occlusal", label: "Occlusal" },
        ] as const).map(({ value, label }, i) => {
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
            Paint a prep region in Label mode first.
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
            <div className="pt-1 text-[10.5px] leading-snug text-[#8a929e]">
              Targets: marginal {REGION_TARGET_MM.marginal.toFixed(1)} mm,
              occlusal {REGION_TARGET_MM.occlusal.toFixed(1)} mm, all{" "}
              {material.targetReductionMm.toFixed(1)} mm (
              {material.name}).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Saved cross-sections list — pick which saved cut the Main App opens with.
// ---------------------------------------------------------------------------
function SavedCutsPanel({
  saved,
  defaultId,
  onDefault,
  onRemove,
}: {
  saved: Section[];
  defaultId: number | null;
  onDefault: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 w-[238px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Scissors className="h-4 w-4 text-[#2a8fd8]" />
        <div className="text-[12.5px] font-semibold text-[#1c1f24]">
          Saved cuts
        </div>
      </div>
      <div className="space-y-1">
        {saved.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-md border border-[#e2e7ee] px-2 py-1.5"
          >
            <input
              type="radio"
              name="default-cut"
              checked={defaultId === s.id}
              onChange={() => onDefault(s.id)}
              className="accent-[#2a8fd8]"
              title="Open the app with this cut"
            />
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor: `#${s.color.toString(16).padStart(6, "0")}`,
              }}
            />
            <span className="flex-1 text-[12px] font-medium text-[#1c1f24]">
              Cut {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              className="text-[#a0a8b4] transition hover:text-[#c41f1f]"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10.5px] leading-snug text-[#8a929e]">
        The selected cut is restored as the default cross-section in the app.
      </div>
    </div>
  );
}

function OpacityPanel({
  preOpacity,
  onPreOpacity,
  preVisible,
  onPreVisible,
  txOpacity,
  onTxOpacity,
  txVisible,
  onTxVisible,
}: {
  preOpacity: number;
  onPreOpacity: (n: number) => void;
  preVisible: boolean;
  onPreVisible: (v: boolean) => void;
  txOpacity: number;
  onTxOpacity: (n: number) => void;
  txVisible: boolean;
  onTxVisible: (v: boolean) => void;
}) {
  return (
    <div className="absolute left-4 top-4 w-[210px] rounded-lg bg-white/95 p-3 shadow-xl ring-1 ring-[#cbd6e2] backdrop-blur">
      <OpacityRow
        label="Treatment scan"
        opacity={txOpacity}
        onOpacity={onTxOpacity}
        visible={txVisible}
        onVisible={onTxVisible}
      />
      <div className="mt-3">
        <OpacityRow
          label="Pre treatment"
          opacity={preOpacity}
          onOpacity={onPreOpacity}
          visible={preVisible}
          onVisible={onPreVisible}
        />
      </div>
    </div>
  );
}

function OpacityRow({
  label,
  opacity,
  onOpacity,
  visible,
  onVisible,
}: {
  label: string;
  opacity: number;
  onOpacity: (n: number) => void;
  visible: boolean;
  onVisible: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-[#1c1f24]">{label}</div>
      <div className="flex items-center gap-2">
        <ToothGlyph muted={!visible} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          disabled={!visible}
          onChange={(e) => onOpacity(Number(e.target.value))}
          className={[
            "flex-1 accent-[#2a8fd8]",
            visible ? "" : "opacity-40",
          ].join(" ")}
        />
        <button
          type="button"
          onClick={() => onVisible(!visible)}
          className="rounded p-1 text-[#2a8fd8] hover:bg-[#eef4fb]"
          title={visible ? "Hide" : "Show"}
        >
          {visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function ToothGlyph({ muted }: { muted?: boolean }) {
  const stroke = muted ? "#b3bdcb" : "#1c1f24";
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 11 Q2 3 7 3 Q9 3 10 5 Q11 3 13 3 Q18 3 18 11"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}


// ---------------------------------------------------------------------------
// Cross-section visual helpers — small 3D markers and CanvasTexture sprites
// for floating mm measurements at the cut.
// ---------------------------------------------------------------------------
function makeMarker(pos: THREE.Vector3, color: number): THREE.Mesh {
  const geom = new THREE.SphereGeometry(0.5, 14, 14);
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(pos);
  m.renderOrder = 1000;
  return m;
}

function makeMeasurementLabel(
  labelPos: THREE.Vector3,
  anchor: THREE.Vector3,
  mm: number,
): THREE.Group {
  const g = new THREE.Group();
  // Leader line from the surface anchor to the label position.
  const lineGeom = new THREE.BufferGeometry().setFromPoints([anchor, labelPos]);
  const line = new THREE.Line(
    lineGeom,
    new THREE.LineBasicMaterial({ color: 0x1c1f24, depthTest: false }),
  );
  line.renderOrder = 1001;
  g.add(line);

  // Sprite text "X.X mm" on a small canvas.
  const text = `${mm.toFixed(2)} mm`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const padX = 10;
  const padY = 6;
  const fontSize = 22;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const w = Math.ceil(textW + padX * 2);
  const h = Math.ceil(fontSize + padY * 2);
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  ctx.scale(dpr, dpr);
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 6);
  ctx.fill();
  ctx.strokeStyle = "#cbd6e2";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 6);
  ctx.stroke();
  ctx.fillStyle = "#1c1f24";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  // Scale so the label is roughly readable regardless of mesh size — base on
  // anchor↔label distance.
  const scale = Math.max(1.5, anchor.distanceTo(labelPos) * 1.2);
  sprite.scale.set(scale * (w / h), scale, 1);
  sprite.position.copy(labelPos);
  sprite.renderOrder = 1002;
  g.add(sprite);
  return g;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
