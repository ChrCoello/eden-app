"""Draw the app icon (white water drop on garden green) → app/public/*.png.

The drop stays inside the central 60% so it survives maskable-icon cropping.
Run: python3 tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "public"
GREEN, WHITE = (47, 107, 58), (255, 255, 255)


def icon(size):
    s = 4  # supersample for smooth edges
    n = size * s
    im = Image.new("RGB", (n, n), GREEN)
    d = ImageDraw.Draw(im)
    cx, r = n / 2, n * 0.19                    # round bottom of the drop
    cy = n * 0.58
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE)
    d.polygon([(cx, n * 0.20), (cx - r * 0.93, cy - r * 0.37), (cx + r * 0.93, cy - r * 0.37)], fill=WHITE)
    return im.resize((size, size), Image.Resampling.LANCZOS)


for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    icon(size).save(OUT / name)
    print(OUT / name)
