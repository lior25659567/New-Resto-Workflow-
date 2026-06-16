import { useState } from "react";
import { PrepEntry } from "./_PrepEntry";
import { PrepApp } from "./_PrepApp";
import type { PreState } from "./pre-state";

// ---------------------------------------------------------------------------
// Prep Reduction QC — orchestrator.
//
// Two cleanly separated stages share a single in-memory PreState:
//   1. Pre-Entry (guided preprocessing): load + align scans, label the prep,
//      define/save cross-sections, solve the insertion vector, zoom to prep.
//      On "Go to App" it emits a PreState.
//   2. Main App (analysis-only): consumes the PreState and never re-runs any
//      preprocessing — it only visualizes undercuts, reduction clearance and
//      cross-sections. "Re-drill" returns to Pre-Entry.
//
// The preview resolver loads this file by the exported `PrepQC` name; the
// per-stage components live in `_`-prefixed files the preview plugin ignores.
// ---------------------------------------------------------------------------
export function PrepQC() {
  const [stage, setStage] = useState<"entry" | "app">("entry");
  const [preState, setPreState] = useState<PreState | null>(null);

  if (stage === "app" && preState) {
    return (
      <PrepApp
        state={preState}
        onReDrill={() => setStage("entry")}
      />
    );
  }

  return (
    <PrepEntry
      onComplete={(state) => {
        setPreState(state);
        setStage("app");
      }}
    />
  );
}
