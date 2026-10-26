# Writes web-sized copies of the dish and step pictures for the app: every
# content/images/dishes/*.png becomes public/img/dishes/<same name>.webp, and
# every content/images/steps/<lesson>/*.png (14e) becomes
# public/img/steps/<lesson>/<same name>.webp, 480px wide. The app shows these;
# the PNGs stay the source.
# Usage: python3 tools/build-dish-images.py [content/images/<dishes|steps>/....png ...]
#   With no names, every picture; with names, only those (the content-publish
#   workflow passes the ones a save added). A test fails if a lesson's picture
#   or a step's has no web copy.
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'content/images'
OUT = ROOT / 'public/img'

every = sorted(SRC.glob('dishes/*.png')) + sorted(SRC.glob('steps/*/*.png'))
for png in [ROOT / p for p in sys.argv[1:]] or every:
    dest = (OUT / png.resolve().relative_to(SRC)).with_suffix('.webp')
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(png).convert('RGBA')
    w = 480
    img = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
    img.save(dest, 'WEBP', quality=80, method=6)
for d in ('dishes', 'steps'):
    print(f'{len(list((OUT / d).rglob("*.webp")))} pictures in public/img/{d}')
