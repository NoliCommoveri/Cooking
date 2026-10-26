# Cuts a sheet of four step pictures (14e) into one square PNG per step, in
# reading order (top row first). The ChatGPT prompts ask for a 2x2 grid of
# square panels on a white background with thin white gutters; each panel is
# trimmed of its white edge and saved as content/images/steps/<lesson>/<step>.png.
# Usage: python3 tools/split-step-sheet.py SHEET LESSON step1,step2,step3,step4
#   A step name of '-' skips that panel. Then run tools/build-dish-images.py
#   and put "picture": "steps/<lesson>/<step>.png" on each step.
import sys
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
src, lesson, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
im = Image.open(src).convert('RGB')
W, H = im.size
out = ROOT / 'content/images/steps' / lesson
out.mkdir(parents=True, exist_ok=True)
for i, name in enumerate(names[:4]):
    if name == '-':
        continue
    x, y = (i % 2) * W // 2, (i // 2) * H // 2
    panel = im.crop((x, y, x + W // 2, y + H // 2))
    # Trim the white gutter: everything near-white around the panel's edge.
    diff = ImageChops.difference(panel, Image.new('RGB', panel.size, (255, 255, 255))).convert('L').point(lambda v: 255 if v > 24 else 0)
    box = diff.getbbox() or (0, 0, *panel.size)
    panel = panel.crop(box)
    side = min(panel.size)
    left, top = (panel.width - side) // 2, (panel.height - side) // 2
    panel.crop((left, top, left + side, top + side)).save(out / f'{name}.png')
    print(f'content/images/steps/{lesson}/{name}.png')
