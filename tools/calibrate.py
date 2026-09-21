"""Fit the pixel -> meter transform of data/map.jpg against the surveyor's dimensions.

data/stakes_px.json : stake number -> [x, y] pixel centre, found by template matching
                      the circled-X markers on the scan, then matched to stake labels by hand.
DIMENSIONS          : distances written on the plan between two stakes (meters).
                      Stakes sit 0.10 m outside the path edge (note on the plan), so each
                      dimension is only good to ~±0.2 m; path widths are 2.50 + 2 x 0.10 = 2.70.
                      The house-block dimensions (43.50, 51.03, 15.00 at 31) are projected
                      along an axis rather than stake-to-stake, so they're left out.

Fits an axis-aligned scale (sx, sy) so d_m^2 = (dx/sx)^2 + (dy/sy)^2, reports residuals,
and writes data/calibration.json.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.optimize import least_squares

DATA = Path(__file__).resolve().parent.parent / "data"
DIMENSIONS = [  # (stake a, stake b, meters)
    (15, 16, 52.39), (14, 13, 51.84), (17, 21, 52.05), (12, 11, 51.84),
    (2, 3, 41.81), (1, 6, 43.82), (4, 10, 47.98), (5, 9, 50.28),
    (19, 16, 27.00), (13, 3, 45.00),
    (35, 34, 15.00),
    # path widths between stakes
    (3, 4, 2.70), (6, 5, 2.70), (3, 6, 2.70), (4, 5, 2.70), (16, 17, 2.70), (13, 12, 2.70),
    (18, 19, 2.70), (7, 8, 2.70), (22, 14, 2.70), (15, 14, 2.70), (27, 28, 2.70), (24, 23, 2.70),
]

stakes = {int(k): np.array(v) for k, v in json.loads((DATA / "stakes_px.json").read_text()).items()}
deltas = np.array([stakes[b] - stakes[a] for a, b, _ in DIMENSIONS])
meters = np.array([m for *_, m in DIMENSIONS])


def residuals(p):
    sx, sy = p
    return np.hypot(deltas[:, 0] / sx, deltas[:, 1] / sy) - meters


fit = least_squares(residuals, x0=[23.0, 23.0])
sx, sy = fit.x
res = residuals(fit.x)
iso = np.linalg.norm(deltas, axis=1).sum() / meters.sum()
print(f"scale x = {sx:.3f} px/m, y = {sy:.3f} px/m  (isotropic would be {iso:.3f})")
for (a, b, m), r in zip(DIMENSIONS, res):
    print(f"  {a:>2}-{b:<2} {m:6.2f} m   residual {r * 100:+6.1f} cm")
print(f"RMS {np.sqrt((res ** 2).mean()) * 100:.1f} cm, max {np.abs(res).max() * 100:.1f} cm")

(DATA / "calibration.json").write_text(json.dumps({
    "image": "map.jpg",
    "image_size": list(Image.open(DATA / "map.jpg").size),
    "px_per_m": [round(sx, 4), round(sy, 4)],
    "note": "local meters: x = px_x / px_per_m[0], y = -px_y / px_per_m[1] (y up, north up)",
    "rms_cm": round(float(np.sqrt((res ** 2).mean()) * 100), 1),
}, indent=1))
