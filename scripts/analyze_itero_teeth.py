#!/usr/bin/env python3
"""
Extract per-tooth 3D centroids from iTero / Blender-exported PLY scans.

PIPELINE (v8 — robust):
1. White enamel mask (vertex color: pinkness + luminance + light-gum guard).
2. Crown mask = enamel ∩ top 55% Z.
3. Cusp peak detection on 2D height map of crown only (occlusal local maxima).
4. DBSCAN merge multi-cusp peaks (eps≈3.5 mm) → one cluster per tooth-cusp.
5. Find mouth opening via 1D ANGULAR DENSITY of crown enamel from palate
   centroid — the bin with lowest density is the open back of the U.
6. Rotate angles so the mouth gap sits on the ±π discontinuity → linear arch
   order with no wrap.
7. Dedup buccal-vs-lingual cusps: if two consecutive clusters have small
   tangential gap (<3.5 mm along arc) AND large radial gap (>4 mm), keep the
   OUTER (buccal) one.
8. Arc-resample the deduped chain to exactly N teeth.
9. Voronoi assign crown enamel → per-tooth occlusal-weighted centroid.

Outputs TypeScript-ready arrays for src/components/jaw-viewer/toothPositions.ts.

Usage:
  python3 scripts/analyze_itero_teeth.py path/to/Upper.ply --jaw upper
  python3 scripts/analyze_itero_teeth.py path/to/Lower.ply --jaw lower
  python3 scripts/analyze_itero_teeth.py --all   # project default models

Requires: numpy, scipy
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter, gaussian_filter1d
from scipy.spatial import cKDTree
from scipy.spatial.distance import cdist

# ── PLY I/O ───────────────────────────────────────────────────────────────────

def load_ply(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return xyz (N,3), rgb (N,3) in 0–1, pinkness (N,)."""
    with open(path, "rb") as f:
        while f.readline().strip() != b"end_header":
            pass
        hdr_pos = f.tell()
        f.seek(0)
        text = b""
        while True:
            line = f.readline()
            text += line
            if line.strip() == b"end_header":
                break
        nv = 0
        props: list[tuple[str, str]] = []
        el = None
        for raw_line in text.decode().split("\n"):
            parts = raw_line.split()
            if len(parts) >= 3 and parts[0] == "element":
                el = parts[1]
                if parts[1] == "vertex":
                    nv = int(parts[2])
            if len(parts) >= 3 and parts[0] == "property" and el == "vertex":
                props.append((parts[2], parts[1]))
        sizes = {"float": 4, "uchar": 1, "char": 1}
        stride = sum(sizes.get(t, 4) for _, t in props)
        f.seek(hdr_pos)
        raw = f.read(nv * stride)

    xyz = np.zeros((nv, 3))
    rgb = np.zeros((nv, 3))
    for i in range(nv):
        o = i * stride
        c = 0
        for name, typ in props:
            sz = sizes.get(typ, 4)
            chunk = raw[o + c : o + c + sz]
            if name == "x":
                xyz[i, 0] = struct.unpack("<f", chunk)[0]
            elif name == "y":
                xyz[i, 1] = struct.unpack("<f", chunk)[0]
            elif name == "z":
                xyz[i, 2] = struct.unpack("<f", chunk)[0]
            elif name in ("red", "green", "blue"):
                rgb[i, {"red": 0, "green": 1, "blue": 2}[name]] = chunk[0] / 255.0
            c += sz
    return xyz, rgb, rgb[:, 0] - rgb[:, 2]


# ── Enamel mask (matches toothPositions.ts) ───────────────────────────────────

def is_enamel(rgb: np.ndarray, pink: float) -> bool:
    r, g, b = rgb
    if pink >= 0.28:
        return False
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if lum < 0.40:
        return False
    if pink > 0.22 and r > 0.58 and g > b:
        return False
    return True


def dbscan_xy(pts: np.ndarray, eps: float) -> tuple[np.ndarray, int]:
    n = len(pts)
    labels = -np.ones(n, dtype=int)
    d = cdist(pts, pts)
    cid = 0
    for i in range(n):
        if labels[i] != -1:
            continue
        nn = np.where(d[i] < eps)[0]
        labels[i] = cid
        stack = list(nn)
        while stack:
            j = stack.pop()
            if labels[j] == -1:
                labels[j] = cid
                stack.extend(np.where(d[j] < eps)[0].tolist())
        cid += 1
    return labels, cid


def find_cusp_peaks(xyz: np.ndarray, crown_mask: np.ndarray,
                    res: float = 0.3, smooth_size: int = 7,
                    z_pct: float = 65.0) -> np.ndarray:
    """Local Z maxima on the 2D crown height map."""
    pts = xyz[crown_mask]
    x0, y0 = pts[:, 0].min() - 1, pts[:, 1].min() - 1
    nx = int((pts[:, 0].max() - x0) / res) + 3
    ny = int((pts[:, 1].max() - y0) / res) + 3
    zmap = np.full((ny, nx), -np.inf)
    xi = np.clip(((pts[:, 0] - x0) / res).astype(int), 0, nx - 1)
    yi = np.clip(((pts[:, 1] - y0) / res).astype(int), 0, ny - 1)
    np.maximum.at(zmap, (yi, xi), pts[:, 2])
    valid = zmap > -np.inf
    zf = zmap.copy()
    zf[~valid] = np.min(zmap[valid])
    lm = (zf == maximum_filter(zf, smooth_size)) & valid & (zf > np.percentile(zf[valid], z_pct))
    py, px = np.where(lm)
    return np.column_stack([px * res + x0, py * res + y0, zf[py, px]])


def buccal_half_mask(xyz: np.ndarray, base_mask: np.ndarray,
                      keep_pct: float = 65.0) -> np.ndarray:
    """
    Keep only buccal (outer) crown enamel: vertices with radial distance from
    the arch's bbox center above keep_pct percentile. Removes lingual surface
    that creates false interior peaks.
    """
    pts = xyz[base_mask, :2]
    bx_min, by_min = pts.min(axis=0)
    bx_max, by_max = pts.max(axis=0)
    palate = np.array([(bx_min + bx_max) / 2, (by_min + by_max) / 2])
    rad_all = np.hypot(xyz[:, 0] - palate[0], xyz[:, 1] - palate[1])
    rad_keep = np.percentile(rad_all[base_mask], keep_pct)
    result = base_mask & (rad_all >= rad_keep)
    return result


def find_mouth_opening_angle(crown_xy: np.ndarray, palate: np.ndarray,
                              n_bins: int = 72) -> float:
    """
    Angle (radians) of the open posterior between the two terminal molars.
    Detected as the angular bin with lowest crown-enamel density.
    """
    dx = crown_xy[:, 0] - palate[0]
    dy = crown_xy[:, 1] - palate[1]
    ang = np.arctan2(dy, dx)
    hist, edges = np.histogram(ang, bins=n_bins, range=(-np.pi, np.pi))
    hist_smooth = gaussian_filter1d(hist.astype(float), sigma=2.0, mode="wrap")
    min_bin = int(np.argmin(hist_smooth))
    return float((edges[min_bin] + edges[min_bin + 1]) / 2)


def order_arch_no_wrap(clusters: np.ndarray, palate: np.ndarray,
                        mouth_ang: float) -> np.ndarray:
    """
    Rotate angles so the mouth opening sits on the ±π discontinuity, then sort.
    Produces a linear arch traversal from one terminal molar to the other.
    """
    dx = clusters[:, 0] - palate[0]
    dy = clusters[:, 1] - palate[1]
    ang = np.arctan2(dy, dx)
    rad = np.hypot(dx, dy)
    arch_ang = ang - (mouth_ang + np.pi)
    arch_ang = ((arch_ang + np.pi) % (2 * np.pi)) - np.pi
    order = np.argsort(arch_ang)
    return order, arch_ang[order], rad[order]


def filter_buccal_cusps(clusters: np.ndarray, palate: np.ndarray,
                         tangential_window_mm: float = 6.0,
                         radial_dominance_mm: float = 2.5) -> np.ndarray:
    """
    Keep only buccal (outer) cusps. For each cluster, drop it if another cluster
    within tangential_window_mm along the arch has radial distance at least
    radial_dominance_mm greater (i.e., is more buccal — same tooth's outer cusp).
    """
    dx = clusters[:, 0] - palate[0]
    dy = clusters[:, 1] - palate[1]
    ang = np.arctan2(dy, dx)
    rad = np.hypot(dx, dy)
    keep = np.ones(len(clusters), bool)
    for i in range(len(clusters)):
        for j in range(len(clusters)):
            if i == j:
                continue
            mean_r = (rad[i] + rad[j]) / 2
            da = abs(ang[i] - ang[j])
            da = min(da, 2 * np.pi - da)
            tangential_mm = da * mean_r
            if tangential_mm < tangential_window_mm and rad[j] > rad[i] + radial_dominance_mm:
                keep[i] = False
                break
    return clusters[keep]


def arc_resample(pts: np.ndarray, n: int) -> np.ndarray:
    """Resample an ordered polyline to exactly n equally-spaced points."""
    s = np.zeros(len(pts))
    for i in range(1, len(pts)):
        s[i] = s[i - 1] + np.hypot(*(pts[i, :2] - pts[i - 1, :2]))
    if s[-1] < 1e-6:
        return np.tile(pts[0], (n, 1))
    s /= s[-1]
    out = []
    for t in np.linspace(0, 1, n):
        i = int(np.searchsorted(s, t))
        i = max(1, min(i, len(s) - 1))
        u = (t - s[i - 1]) / max(s[i] - s[i - 1], 1e-6)
        out.append(pts[i - 1] * (1 - u) + pts[i] * u)
    return np.array(out)


def analyze_jaw(
    path: Path,
    *,
    jaw: str,
    n_teeth: int,
    crown_z_pct: float = 45.0,
    peak_dbscan_eps: float = 3.5,
    voronoi_gap_mm: float = 0.55,
) -> np.ndarray:
    """
    See module docstring for the full 9-step pipeline.
    """
    xyz, rgb, pink = load_ply(path)
    enamel = np.array([is_enamel(rgb[i], pink[i]) for i in range(len(xyz))])
    if enamel.sum() < 1000:
        raise RuntimeError(f"{path}: too few enamel vertices — check vertex colors")

    z_cut = np.percentile(xyz[enamel, 2], crown_z_pct)
    crown = enamel & (xyz[:, 2] > z_cut)

    bx_min, by_min = xyz[crown, :2].min(axis=0)
    bx_max, by_max = xyz[crown, :2].max(axis=0)
    palate = np.array([(bx_min + bx_max) / 2, (by_min + by_max) / 2])

    buccal_crown = buccal_half_mask(xyz, crown, keep_pct=50.0)

    peaks = find_cusp_peaks(xyz, buccal_crown, res=0.3, smooth_size=7, z_pct=55)
    peaks = peaks[np.abs(peaks[:, 1] - palate[1]) < 26]

    labels, nc = dbscan_xy(peaks[:, :2], peak_dbscan_eps)
    clusters = np.array([peaks[labels == i].mean(axis=0) for i in range(nc)])

    clusters = filter_buccal_cusps(clusters, palate,
                                    tangential_window_mm=5.0,
                                    radial_dominance_mm=2.0)

    mouth_ang = find_mouth_opening_angle(xyz[buccal_crown, :2], palate)
    order, arch_ang, rad = order_arch_no_wrap(clusters, palate, mouth_ang)
    seeds_path = clusters[order]

    x_desc = (jaw == "upper")
    if x_desc and seeds_path[0, 0] < seeds_path[-1, 0]:
        seeds_path = seeds_path[::-1]
    elif (not x_desc) and seeds_path[0, 0] > seeds_path[-1, 0]:
        seeds_path = seeds_path[::-1]

    # Trim terminal seeds that are lingual cusps of terminal molars: their
    # gap to neighbor is large AND the neighbor's gap to next is normal.
    for _ in range(3):
        if len(seeds_path) < 4:
            break
        d_start = float(np.hypot(*(seeds_path[1, :2] - seeds_path[0, :2])))
        d_start_next = float(np.hypot(*(seeds_path[2, :2] - seeds_path[1, :2])))
        d_end = float(np.hypot(*(seeds_path[-1, :2] - seeds_path[-2, :2])))
        d_end_prev = float(np.hypot(*(seeds_path[-2, :2] - seeds_path[-3, :2])))
        trimmed = False
        if d_start > 12.0 and d_start_next < 10.0:
            seeds_path = seeds_path[1:]
            trimmed = True
        if d_end > 12.0 and d_end_prev < 10.0:
            seeds_path = seeds_path[:-1]
            trimmed = True
        if not trimmed:
            break

    seeds = arc_resample(seeds_path, n_teeth)

    p = xyz[crown]
    tree = cKDTree(seeds[:, :2])
    d, nn = tree.query(p[:, :2], k=2)
    lab = np.full(len(p), -1)
    ok = (d[:, 1] - d[:, 0]) >= voronoi_gap_mm
    lab[ok] = nn[ok, 0]

    centroids = []
    for t in range(n_teeth):
        sub = p[lab == t]
        if len(sub) < 40:
            centroids.append(seeds[t])
            continue
        zthr = np.percentile(sub[:, 2], 88)
        top = sub[sub[:, 2] >= zthr]
        w = np.exp((top[:, 2] - top[:, 2].max()) * 0.5)
        centroids.append(np.average(top, axis=0, weights=w))
    centroids = np.array(centroids)

    return centroids


def ada_list(jaw: str) -> list[int]:
    if jaw == "upper":
        return list(range(1, 16))
    return [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32]


def emit_ts(name: str, jaw: str, centers: np.ndarray) -> None:
    adas = ada_list(jaw)
    print(f"\n/** {name} — {jaw} arch, enamel-first analysis */")
    print(f"export const {name}: ToothCentroid[] = [")
    for ada, c in zip(adas, centers):
        print(
            f"  {{ ada: {ada:2d}, label: '#{ada:2d}', "
            f"x: {c[0]:7.3f}, y: {c[1]:7.3f}, z: {c[2]:5.3f} }},"
        )
    print("];")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ply", nargs="?", type=Path, help="PLY file path")
    parser.add_argument("--jaw", choices=("upper", "lower"), help="Arch type")
    parser.add_argument("--all", action="store_true", help="Analyze project default models")
    parser.add_argument("--crown-z-pct", type=float, default=45.0,
                        help="Z percentile cutoff for crown mask (default 45)")
    parser.add_argument("--voronoi-gap", type=float, default=0.55,
                        help="Voronoi inter-tooth margin in mm (default 0.55)")
    parser.add_argument("--dbscan-eps", type=float, default=3.5,
                        help="Cusp clustering radius in mm (default 3.5)")
    parser.add_argument("--validate", action="store_true",
                        help="Print anatomical width sanity check")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    models = root / "src/assets/3d-models/new 3d models "

    jobs: list[tuple[Path, str, str]] = []
    if args.all:
        jobs = [
            (models / "Upper.ply", "upper", "UPPER_TEETH"),
            (models / "Lower.ply", "lower", "LOWER_TEETH"),
        ]
    elif args.ply and args.jaw:
        name = "UPPER_TEETH" if args.jaw == "upper" else "LOWER_TEETH"
        jobs = [(args.ply, args.jaw, name)]
    else:
        parser.print_help()
        sys.exit(1)

    for path, jaw, ts_name in jobs:
        if not path.exists():
            print(f"Missing: {path}", file=sys.stderr)
            sys.exit(1)
        n = 15 if jaw == "upper" else 16
        centers = analyze_jaw(
            path,
            jaw=jaw,
            n_teeth=n,
            crown_z_pct=args.crown_z_pct,
            peak_dbscan_eps=args.dbscan_eps,
            voronoi_gap_mm=args.voronoi_gap,
        )
        print(f"# {path.name}: {n} teeth, {len(centers)} centroids")
        emit_ts(ts_name, jaw, centers)
        if args.validate:
            widths = [float(np.hypot(*(centers[i, :2] - centers[i - 1, :2])))
                      for i in range(1, len(centers))]
            print(f"# widths(mm): min={min(widths):.2f} max={max(widths):.2f} "
                  f"mean={np.mean(widths):.2f}")
            if min(widths) < 4.0:
                print(f"# WARN: tooth gap < 4 mm — likely mis-segmented")
            if max(widths) > 14.0:
                print(f"# WARN: tooth gap > 14 mm — likely missed a tooth")


if __name__ == "__main__":
    main()
