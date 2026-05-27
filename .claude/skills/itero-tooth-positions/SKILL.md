---
name: itero-tooth-positions
description: "Per-tooth 3D centroids from iTero PLY scans using a 9-step enamel-first segmentation: white-vertex mask, crown filter, buccal half-arch, height-map cusp peaks, mouth-opening detection from angular density, arch un-wrap, buccal/lingual dedup, arc-resample, Voronoi centroid. Covers the project script (scripts/analyze_itero_teeth.py), tuning knobs, anatomical validation, integration with toothPositions.ts / ToothMarkers / ToothHeatmapOverlay, and known limitations. Use when adding markers for a new case, fixing per-tooth heatmap or label positions, or mapping any ADA tooth ID to 3D."
---

# iTero Tooth Position Analysis Skill

Goal: place each marker and heatmap on **one white enamel tooth only** — never on gingiva, palate, or a neighbor — and have ADA numbers walk the arch in clinical order.

---

## TL;DR

```bash
pip install numpy scipy
python3 scripts/analyze_itero_teeth.py --all --validate
```

Pastes ready-made `UPPER_TEETH` / `LOWER_TEETH` arrays into stdout. Drop into `src/components/jaw-viewer/toothPositions.ts`. Press **T** in the viewer; enable tool 2 (occlusogram) or tool 4 (prep reduction) — each tooth gets its own colored crown.

---

## Algorithm — v10 (9-step enamel-first pipeline)

| Step | What it does |
|------|--------------|
| 1 | Enamel mask (color: pinkness + luminance + light-gum guard) |
| 2 | Crown mask (top 55% Z of enamel) |
| 3 | **Buccal-half mask** — drop inner half by radial distance from palate (removes lingual surface that creates phantom teeth) |
| 4 | Height-map cusp peaks on buccal crown only |
| 5 | DBSCAN merge + radial dedup (keep outer cusp when same arch position) |
| 6 | **Mouth opening** detected from 1D angular density of crown enamel (lowest-density bin) |
| 7 | **Arch un-wrap** — rotate angles so mouth gap sits on ±π discontinuity → linear traversal |
| 7b | Terminal lingual-cusp trim (drop ends with anatomically impossible gap > 12 mm) |
| 8 | Arc-resample to N teeth |
| 9 | Voronoi assign + occlusal-weighted centroid per tooth |

### Result on the repo's case

| Arch | Mean width | Min | Max | Anatomical? |
|------|------------|-----|-----|------|
| **Lower** | 7.45 mm | 6.08 | 10.40 | yes — perfect |
| **Upper** | 9.90 mm | 6.19 | 17.28 | mostly — #13 / #14 manually nudged onto buccal molars |

### Failure modes the v10 pipeline solves vs the legacy one

1. **False peaks on pink gingiva** → fixed by enamel color mask (Step 1)
2. **Lingual cusps creating fake teeth** → fixed by buccal half mask + radial dedup (Steps 3, 5)
3. **Wrong arch order from X-sort on U-shaped arches** → fixed by angular sort with mouth-opening cut (Steps 6–7)

---

## Two Algorithms

| Algorithm | When to use | Validation |
|-----------|-------------|------------|
| **v10 enamel-first** (default) | Vertex-color PLYs (current models) | Mean tooth width 7–8 mm, min ≥ 4 mm |
| **Legacy height-map peaks** | PLYs without vertex colors | Used `figmaAssetResolver`-era models |

---

## What an iTero / Blender PLY Contains

| File | Contents |
|------|----------|
| `Upper.ply`, `Lower.ply`, `Both Arches.ply` | New Blender exports, vertex RGB baked in |
| `iTero_Export_<ID>/itero_export_*.xml` | Rx summary, ADA list, global transform |
| `iTero_Export_<ID>/*_with_ditch_*.ply` + `_texture.jpg` | Legacy iTero, texture UV |

### Project PLY vertex layout (Blender export)

```
property float x, y, z
property uchar red, green, blue, alpha   ← embedded vertex color
property float s, t                       ← unused
```

No normals. Color is the primary signal.

### XML still doesn't help

`<TeethBuccalTransforms />` is empty in current exports. Only the global 4×4 transform is useful. **3D tooth positions come from PLY geometry + vertex color.**

---

## v10 Pipeline (9 Steps)

```
1. enamel_mask   = is_enamel(R, G, B)          # color: pinkness + luminance + light-gum guard
2. crown_mask    = enamel_mask & (z > p45(z))  # top 55% Z by occlusal height
3. buccal_crown  = crown_mask & (radius_from_palate > p50)   # OUTER half only
4. cusp_peaks    = local_max(height_map(buccal_crown))
5. clusters      = DBSCAN(cusp_peaks, eps=3.5mm) + radial dedup (keep outer)
6. mouth_ang     = argmin(angular_density(buccal_crown))   # 1D KDE of enamel angles
7. arch_chain    = sort(clusters by angle − mouth_ang − π)   # mouth gap on ±π
                   + terminal-molar lingual cusp trim
8. seeds         = arc_resample(arch_chain, N_teeth)
9. centroids     = voronoi(crown → seeds) + occlusal-weighted mean
```

### Step 1 — Enamel color rules

```python
def is_enamel(r, g, b, pink=R-B):
    if pink >= 0.28:                                  return False  # pink gingiva
    if 0.299*r + 0.587*g + 0.114*b < 0.40:            return False  # dark prep
    if pink > 0.22 and r > 0.58 and g > b:            return False  # light gum
    return True
```

Typical fractions: **upper ~80%, lower ~64%** of vertices pass.

### Step 3 — Buccal half mask (critical for upper)

```python
palate = (bbox_min + bbox_max) / 2   # interior of arch
radius = hypot(x - palate_x, y - palate_y)
buccal_crown = crown_mask & (radius >= percentile(radius_in_crown, 50))
```

Drops the lingual surface that was creating false-positive interior cusp peaks.

### Step 6 — Mouth opening from angular density

```python
ang = atan2(y - palate_y, x - palate_x)
hist = histogram(ang, 72 bins, smoothed sigma=2)
mouth_ang = bin_center(argmin(hist))    # bin with FEWEST enamel verts
```

The mouth opens between the two terminal molars; there are no enamel verts there. The angular bin with lowest density is the gap.

### Step 7 — Un-wrap the arch

```python
arch_ang = (ang - mouth_ang - π + π) mod 2π − π   # gap on ±π discontinuity
order    = argsort(arch_ang)                       # → linear traversal
```

After this, the chain walks from one terminal molar through the anterior to the other — no wraparound.

### Step 7b — Trim terminal lingual cusps

Wide upper molars (UR3M / UL3M) often produce TWO cusp clusters at similar arch position. After dedup, one survives at the very end of the chain; the gap to its neighbor (>12 mm) is anatomically impossible. Trim it.

```python
if d_start > 12 mm and d_start_next < 10 mm:  drop chain[0]
if d_end   > 12 mm and d_end_prev   < 10 mm:  drop chain[-1]
```

### Step 8 — Arc-resample

The trimmed chain may have fewer than N points; arc-resample uniformly to exactly N by total arc length.

### Step 9 — Voronoi centroid per tooth

Each crown enamel vertex is assigned to its nearest seed (with min margin **0.55 mm** to skip interproximal gaps). The tooth centroid uses the top 12% Z vertices, weighted by `exp((z - z_peak) * 0.5)`.

---

## Running the Script

```bash
pip install numpy scipy
python3 scripts/analyze_itero_teeth.py --all --validate
```

Outputs TypeScript-ready arrays + width-check warnings. Common flags:

| Flag | Default | Use |
|------|---------|-----|
| `--crown-z-pct` | 45 | Lower (35) to include gingival enamel; raise (55) to keep only cusps |
| `--dbscan-eps` | 3.5 | Raise to 4.5 if too many micro-clusters; lower if cusps merge |
| `--voronoi-gap` | 0.55 | Raise to 0.85 if heatmap bleeds; lower if patchy |
| `--validate` | — | Emit anatomical width sanity check |

### Single jaw

```bash
python3 scripts/analyze_itero_teeth.py "src/assets/3d-models/new 3d models /Upper.ply" --jaw upper
```

---

## Anatomical Validation

```
# widths(mm): min=X max=Y mean=Z
```

| Metric | Anatomical range | Action if outside |
|--------|------------------|-------------------|
| Mean width | 6–9 mm | Lower: 7.4 ✓ Upper: 9.9 (slightly wide, OK) |
| Min width | 4–6 mm | < 4 mm: two seeds merged onto one tooth |
| Max width | 9–12 mm | > 13 mm: missed a tooth or terminal lingual cusp |
| Total arc | 75–95 mm | Too short = palate excluded too aggressively |

Current state for case in repo:
- Lower: 6.08–10.40 mm, mean 7.45 — **anatomically perfect**
- Upper: 6.19–17.28 mm, mean 9.90 — good middle teeth, terminal molars need manual tweak

---

## Manual Tweaks for Stubborn Teeth

If a single tooth is mis-placed after running the script:

1. Locate the offending ADA in `src/components/jaw-viewer/toothPositions.ts`
2. Open the PLY in MeshLab or Blender; pick a vertex on the target crown
3. Replace `x, y, z` in mm (PLY local coordinates, **before** `geo.center()`)
4. Hot reload — `JawMesh` re-fits and the marker / heatmap follows

The repo's current `UPPER_TEETH` already has #13 and #14 manually nudged onto the buccal molars (the script placed lingual cusps there).

---

## Code Integration

| File | Role |
|------|------|
| `scripts/analyze_itero_teeth.py` | Pipeline implementation (this skill) |
| `src/components/jaw-viewer/toothPositions.ts` | `UPPER_TEETH`, `LOWER_TEETH`, `isEnamelVertex`, `isGumVertex`, `refineToothCentroidsFromGeometry` |
| `src/components/jaw-viewer/ToothMarkers.tsx` | HTML labels using refined centroids |
| `src/components/jaw-viewer/ToothHeatmapOverlay.tsx` | Voronoi heatmap with enamel-only mask |
| `src/components/jaw-viewer/jawModelPaths.ts` | **swap: `Upper.ply` → lower viewer slot; `Lower.ply` → upper** |

### Runtime refinement

`refineToothCentroidsFromGeometry()` re-projects each seed onto live mesh enamel within 5.5 mm, then takes the occlusal-weighted mean. Max drift clamped to **2 mm** — prevents seeds from being dragged onto adjacent teeth.

### JawType → Teeth array

| `jawType` prop | PLY file | Teeth array |
|----------------|----------|-------------|
| `"upper"` | `Upper.ply` (rendered in lower slot) | `UPPER_TEETH` #1–15 |
| `"lower"` | `Lower.ply` (rendered in upper slot) | `LOWER_TEETH` #17–32 |

---

## Coordinate Space

- **Z** = occlusal axis (cusps at high Z) for both files
- **Normals** (when present): occlusal-facing `nz > 0.15` on BOTH `Upper.ply` and `Lower.ply` — don't assume upper is inverted
- After `geo.center()`, original offset stored in `geo.userData.originalCenter`
- Mesh transform: `scale={0.035}`, `rotation={[Math.PI * 0.6, 0, Math.PI]}`

### Tooth seed → scene-space marker

```ts
const markerPos = new THREE.Vector3(tooth.x, tooth.y, tooth.z)
  .sub(originalCenter)
  .multiplyScalar(0.035)
  .applyQuaternion(new THREE.Quaternion().setFromEuler(
    new THREE.Euler(Math.PI * 0.6, 0, Math.PI, 'XYZ')
  ));
```

---

## Adding a New Case

1. Drop `Upper.ply` / `Lower.ply` into `src/assets/3d-models/new 3d models /`
2. Update `jawModelPaths.ts` if filenames differ
3. Run `python3 scripts/analyze_itero_teeth.py --all --validate`
4. Inspect the validation table; tweak `--crown-z-pct` or `--dbscan-eps` if outside ranges
5. Paste `UPPER_TEETH` / `LOWER_TEETH` into `toothPositions.ts`
6. Press **T** in the viewer — every label should land on a visible white cusp
7. Enable occlusogram (tool 2) — heatmap should color the full crown per tooth, no gingiva bleed

---

## Validation Workflow

After updating positions, walk these checks in order:

| # | Check | Pass criteria |
|---|-------|---------------|
| 1 | Python validation | `--validate` widths within anatomical bounds |
| 2 | Marker placement (T key) | Each label on visible enamel, not gum |
| 3 | Heatmap coverage (tool 2 / 4) | Each tooth has its own gradient, no shared blob |
| 4 | Adjacent teeth | No gap > 12 mm in marker chain |
| 5 | ADA ordering | Walk #1 → #15 (upper) or #17 → #32 (lower) follows the arch left-to-right or right-to-left consistently |

---

## Known Limitations

| Situation | Effect | Mitigation |
|-----------|--------|------------|
| Wide upper molars (UR3M/UL3M) | Buccal + lingual cusps both pass filters → false extra tooth | Terminal-trim heuristic; otherwise manual edit |
| Tooth with full-coverage crown (no color variation) | Looks like surrounding enamel | Use geometry fallback (height-map peaks only) |
| Stained enamel (lum < 0.40) | Drops below brightness threshold | Lower `ENAMEL_LUMINANCE_MIN` to 0.35 in toothPositions.ts |
| Pontic / missing tooth | No geometry exists | Interpolate between abutments; check XML `RestorationType=21` |
| Both-arches PLY | Two stacked U's confuse density / angles | Run per-arch only; never on `Both Arches.ply` |

---

## Case #259918722 — Lower-Right Bridge (legacy reference)

Measured abutments, interpolated pontics:

| ADA | X | Y | Z |
|-----|---|---|---|
| #28 | 10.49 | −18.44 | 13.89 |
| #29 (pontic) | 19.91 | −7.02 | 12.63 |
| #30 (pontic) | 25.41 | 7.42 | 12.93 |
| #31 | 28.16 | 19.15 | 16.10 |

PLY `geo.center()` for that case: `(-0.395, 2.955, 3.79)`.

---

## Common Mistakes

1. **Skipping the buccal half mask** — lingual surface produces false interior cusps
2. **Sorting by raw X** — wrong on any U-shaped arch (sorts buccal+lingual together)
3. **Using `Both Arches.ply` for analysis** — overlapping arches break density detection
4. **Forgetting the model swap** — `lower_treatment` URL points to `Upper.ply`
5. **Trusting the angular gap at default ±π** — must shift by `mouth_ang + π` first
6. **Tightening `voronoi_gap_mm` too far** — heatmap becomes patchy (gap < 0.3 mm)
