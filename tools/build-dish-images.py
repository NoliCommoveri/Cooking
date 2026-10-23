# Writes web-sized copies of the dish pictures for the app: every
# content/images/dishes/*.png becomes public/img/dishes/<same name>.webp, 480px
# wide. The app's library shows these; the PNGs stay the source.
# Usage: python3 tools/build-dish-images.py [content/images/dishes/<name>.png ...]
#   With no names, every picture; with names, only those (the content-publish
#   workflow passes the ones a save added). A test fails if a lesson's picture
#   has no web copy.
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'content/images/dishes'
OUT = ROOT / 'public/img/dishes'
OUT.mkdir(parents=True, exist_ok=True)

for png in [ROOT / p for p in sys.argv[1:]] or sorted(SRC.glob('*.png')):
    img = Image.open(png).convert('RGBA')
    w = 480
    img = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
    img.save(OUT / (png.stem + '.webp'), 'WEBP', quality=80, method=6)
print(f'{len(list(OUT.glob("*.webp")))} pictures in {OUT.relative_to(ROOT)}')
