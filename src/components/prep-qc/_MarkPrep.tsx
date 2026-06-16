import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Brush, Eraser, Trash2, ArrowRight, Sparkles, Move3D } from "lucide-react";
import { createScene, type SceneHandle } from "./three-utils";
import {
  paintVerticesInRadius,
  labelsToColors,
  countLabel,
  LABEL_PREP,
  LABEL_UNLABELED,
} from "./prep-label";

// ---------------------------------------------------------------------------
// MarkPrep — the first step of the copilot: paint the prepared tooth directly
// on the treatment scan. The painted mask is what every QC check keys off, so
// this is deliberately the only thing on screen. Left-drag paints, right-drag
// orbits, scroll zooms. Emits the prep mask on "Analyze prep".
// ---------------------------------------------------------------------------
type Tool = "paint" | "erase" | "orbit";

export function _MarkPrep({
  txGeom,
  onComplete,
}: {
  txGeom: THREE.BufferGeometry;
  onComplete: (labels: Uint8Array) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const labelsRef = useRef<Uint8Array | null>(null);
  const paintingRef = useRef(false);
  // Default to "orbit" so the model moves first — the user rotates to find the
  // prep, then picks the brush to mark it (selecting the brush stops movement).
  const toolRef = useRef<Tool>("orbit");
  const brushPctRef = useRef(6);

  const [tool, setTool] = useState<Tool>("orbit");
  const [brushPct, setBrushPct] = useState(6);
  const [prepCount, setPrepCount] = useState(0);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    brushPctRef.current = brushPct;
  }, [brushPct]);

  // Build the scene + the paintable treatment-scan mesh.
  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createScene(hostRef.current, { background: "#D6E7F1" });
    sceneRef.current = handle;

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
    });
    const labels = new Uint8Array(txGeom.attributes.position.count);
    labelsRef.current = labels;
    labelsToColors(labels, txGeom); // base (unlabeled) colors

    const mesh = new THREE.Mesh(txGeom, mat);
    // Normalize the displayed model into the exact coordinate regime the scan /
    // view-page jaw viewers use, so orbit/zoom/pan feel identical: radius ≈ 1
    // unit at the origin, tilted to the familiar chair-side occlusal angle.
    // Labels are stored per geometry vertex (painted via worldToLocal), so this
    // display-only transform doesn't affect what gets marked.
    txGeom.computeBoundingSphere();
    const r = txGeom.boundingSphere?.radius || 1;
    mesh.scale.setScalar(1 / r);
    mesh.rotation.set(Math.PI * 0.6, 0, Math.PI);
    handle.scene.add(mesh);
    meshRef.current = mesh;

    // Canonical jaw-viewer camera + zoom range (matches JawControls).
    const cam = handle.camera;
    cam.fov = 40;
    cam.near = 0.01;
    cam.far = 1000;
    cam.up.set(0, 1, 0);
    cam.position.set(0, -2, 4.5);
    cam.updateProjectionMatrix();
    handle.controls.target.set(0, 0, 0);
    handle.controls.minDistance = 0.5;
    handle.controls.maxDistance = 10;
    handle.controls.update();

    return () => {
      handle.dispose();
      sceneRef.current = null;
      meshRef.current = null;
      labelsRef.current = null;
    };
  }, [txGeom]);

  // Painting interaction. The mouse-button mapping (left = paint vs. left =
  // rotate) is owned by the [tool] effect below; here we just wire pointer
  // events. Brush selected → paint; Move selected → the model orbits.
  useEffect(() => {
    const handle = sceneRef.current;
    const mesh = meshRef.current;
    if (!handle || !mesh) return;
    const canvas = handle.renderer.domElement;
    const controls = handle.controls;
    const original = { ...controls.mouseButtons };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    mesh.geometry.computeBoundingSphere();
    const meshRadius = mesh.geometry.boundingSphere?.radius || 1;

    const doPaint = (clientX: number, clientY: number) => {
      const labels = labelsRef.current;
      if (!labels) return;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, handle.camera);
      const hits = raycaster.intersectObject(mesh, false);
      if (hits.length === 0) return;
      const local = hits[0].point.clone();
      mesh.worldToLocal(local);
      const radius = meshRadius * (brushPctRef.current / 100);
      const value = toolRef.current === "paint" ? LABEL_PREP : LABEL_UNLABELED;
      const changed = paintVerticesInRadius(
        mesh.geometry,
        local,
        radius,
        value,
        labels,
      );
      if (changed > 0) {
        labelsToColors(labels, mesh.geometry);
        setPrepCount(countLabel(labels, LABEL_PREP));
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // In Move mode, left-drag orbits the model (OrbitControls handles it) —
      // don't paint or capture the pointer.
      if (toolRef.current === "orbit") return;
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
  }, []);

  // Tool ↔ mouse-button mapping. Move (no brush): left = rotate, right = pan —
  // the model moves like the canonical jaw viewer. Brush/Erase: left paints and
  // the model holds still; right-drag can still rotate to reposition.
  useEffect(() => {
    const handle = sceneRef.current;
    if (!handle) return;
    const canvas = handle.renderer.domElement;
    const controls = handle.controls;
    if (tool === "orbit") {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      canvas.style.cursor = "grab";
    } else {
      controls.mouseButtons = {
        LEFT: null as unknown as THREE.MOUSE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      canvas.style.cursor = "crosshair";
    }
  }, [tool]);

  const clear = () => {
    const labels = labelsRef.current;
    const mesh = meshRef.current;
    if (!labels || !mesh) return;
    labels.fill(LABEL_UNLABELED);
    labelsToColors(labels, mesh.geometry);
    setPrepCount(0);
  };

  const ready = prepCount >= 30;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#D6E7F1] font-['Roboto',sans-serif] text-[#3e3d40] antialiased">
      <div ref={hostRef} className="absolute inset-0" />

      {/* Title + instruction card (top-left; top-right stays clear for the
          scan toolbar so the Prep Copilot button keeps toggling). */}
      <div className="pointer-events-none absolute left-4 top-4 w-[244px] rounded-xl bg-white/95 p-3.5 shadow-xl ring-1 ring-[#d1d1d1] backdrop-blur">
        <div className="mb-1 flex items-center gap-2">
          <Brush className="h-4 w-4 text-[#00ADEF]" />
          <div className="text-[13px] font-semibold text-[#3e3d40]">
            Mark the prep
          </div>
        </div>
        <div className="text-[10.5px] leading-snug text-[#818181]">
          Rotate the model to find the prep (<span className="font-semibold">Move</span>{" "}
          is on by default). Then pick <span className="font-semibold">Brush</span>{" "}
          to paint over the prepared tooth — the model holds still while you mark,
          and the QC checks are based on what you mark.
        </div>
        <div className="mt-2.5 border-t border-[#e7ecf1] pt-2 text-[10.5px] text-[#818181]">
          Marked:{" "}
          <span
            className="font-mono font-semibold"
            style={{ color: ready ? "#1c7d4d" : "#818181" }}
          >
            {prepCount.toLocaleString()}
          </span>{" "}
          vertices
        </div>
      </div>

      {/* Control bar (bottom-center) */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-white/95 px-3 py-2.5 shadow-xl ring-1 ring-[#d1d1d1] backdrop-blur">
        {/* Tool toggle */}
        <div className="flex overflow-hidden rounded-md border border-[#d1d1d1]">
          {(
            [
              { value: "orbit", label: "Move", icon: Move3D },
              { value: "paint", label: "Brush", icon: Brush },
              { value: "erase", label: "Erase", icon: Eraser },
            ] as const
          ).map(({ value, label, icon: Icon }, i, arr) => {
            const active = tool === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTool(value)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition",
                  i < arr.length - 1 ? "border-r border-[#d1d1d1]" : "",
                  active
                    ? "bg-[#00ADEF] text-white"
                    : "bg-white text-[#3e3d40] hover:bg-[#f4f7fa]",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2 rounded-md border border-[#d1d1d1] bg-white px-3 py-1.5">
          <span className="text-[11px] font-medium text-[#818181]">Size</span>
          <input
            type="range"
            min={2}
            max={14}
            value={brushPct}
            onChange={(e) => setBrushPct(Number(e.target.value))}
            className="w-24 accent-[#00ADEF]"
          />
        </div>

        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 rounded-md border border-[#d1d1d1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3e3d40] transition hover:bg-[#f4f7fa]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>

        <div className="mx-0.5 h-6 w-px bg-[#e0e5ea]" />

        <button
          type="button"
          onClick={() => {
            const labels = labelsRef.current;
            if (labels && ready) onComplete(labels.slice());
          }}
          disabled={!ready}
          className={[
            "flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-[12px] font-semibold transition",
            ready
              ? "border-[#00ADEF] bg-[#00ADEF] text-white hover:bg-[#0095CE]"
              : "cursor-not-allowed border-[#d1d1d1] bg-[#e6eef7] text-[#9aa6b4]",
          ].join(" ")}
          title={ready ? "Run the QC checks on this prep" : "Paint the prep first"}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Analyze prep
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
