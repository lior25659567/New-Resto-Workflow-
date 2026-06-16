import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Loader2, X } from "lucide-react";
import { PrepApp } from "./_PrepApp";
import { _MarkPrep } from "./_MarkPrep";
import { parsePly } from "./three-utils";
import { buildPreStateFromLabels } from "./autoPrep";
import type { PreState } from "./pre-state";
import defaultPreUrl from "@/assets/Prep copilot 3d models/upper_jaw_pretreatment_261974141.ply?url";
import defaultTxUrl from "@/assets/Prep copilot 3d models/upper_jaw_with_ditch_261974141.ply?url";

// ---------------------------------------------------------------------------
// Prep Reduction QC — orchestrator.
//
// Flow: load the bundled scans → the user PAINTS the prep on the model → the
// QC panel runs every check (margin, reduction, occlusal, interproximal,
// undercuts) off that painted prep. "Re-drill" returns to the marking step.
// No upload screen; the bundled models are used directly.
// ---------------------------------------------------------------------------
type Stage = "loading" | "mark" | "app";

const PRE_NAME = "Pre-treatment (bundled)";
const TX_NAME = "Treatment scan (bundled)";

export function PrepQC({ onClose }: { onClose?: () => void }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [geoms, setGeoms] = useState<{
    pre: THREE.BufferGeometry;
    tx: THREE.BufferGeometry;
  } | null>(null);
  const [preState, setPreState] = useState<PreState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Load the bundled scans once on open.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      try {
        const load = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch ${url}`);
          return parsePly(await res.arrayBuffer());
        };
        const [pre, tx] = await Promise.all([
          load(defaultPreUrl),
          load(defaultTxUrl),
        ]);
        if (cancelled) return;
        setGeoms({ pre, tx });
        setStage("mark");
      } catch (err) {
        console.error("Failed to load bundled prep models", err);
        if (!cancelled) setError("Couldn't load the bundled scans.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Painted prep → full PreState → QC panel.
  const analyze = (labels: Uint8Array) => {
    if (!geoms) return;
    const ps = buildPreStateFromLabels(
      geoms.pre,
      geoms.tx,
      labels,
      PRE_NAME,
      TX_NAME,
    );
    if (ps) {
      setPreState(ps);
      setStage("app");
    } else {
      setError("Couldn't read that prep — try marking a larger area.");
    }
  };

  if (stage === "app" && preState) {
    return (
      <PrepApp
        state={preState}
        autoAccept
        onReDrill={() => {
          setPreState(null);
          setError(null);
          setStage("mark");
        }}
        onClose={onClose}
      />
    );
  }

  if (stage === "mark" && geoms) {
    return (
      <_MarkPrep txGeom={geoms.tx} onComplete={analyze} />
    );
  }

  // Loading / error splash.
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 bg-[#D6E7F1] font-['Roboto',sans-serif] text-[#3e3d40]">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md border border-[#d1d1d1] bg-white text-[#3e3d40] transition hover:bg-[#f4f7fa]"
          title="Close Prep Copilot"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {!error && <Loader2 className="h-8 w-8 animate-spin text-[#00ADEF]" />}
      <div className="text-[13px] font-medium text-[#5a6675]">
        {error ?? "Loading scans…"}
      </div>
    </div>
  );
}
