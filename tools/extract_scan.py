"""Extract the scanned plan from the PDF and rotate it so the text reads upright.

Outputs:
  data/map.jpg      full resolution (8827x6900), source for calibration/tracing
  data/map_web.webp ~3000 px wide, for display
"""
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
DATA = Path(__file__).resolve().parent.parent / "data"
PDF = DATA / "20260303_154351.PDF"

raw = PDF.read_bytes()
start, end = raw.find(b"\xff\xd8"), raw.rfind(b"\xff\xd9")
tmp = DATA / "_scan.jpg"
tmp.write_bytes(raw[start:end + 2])

im = Image.open(tmp).transpose(Image.Transpose.ROTATE_90)  # 90 deg counter-clockwise: text upright, north up
tmp.unlink()
im.save(DATA / "map.jpg", quality=92)
web = im.resize((3000, round(im.height * 3000 / im.width)), Image.Resampling.LANCZOS)
web.save(DATA / "map_web.webp", quality=82)
print(im.size, web.size)
