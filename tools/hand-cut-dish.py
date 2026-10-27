# Cuts one dish by hand from a sheet, for white bowls and dishes whose sides the crop tool
# (tools/crop-dish-sheet.py) takes for background, leaving a floating rim.
# Usage: python3 tools/hand-cut-dish.py SHEET OUT.png BOXES [all]
#   BOXES: left,top,right,bottom per piece of the dish (plate, side bowl), ';' between them.
#   The largest non-white piece in each box is masked by its convex hull, so white crockery
#   inside its own outline stays; a later box skips what an earlier one covered. With 'all',
#   shadows count as part of a piece and the shadow under it is kept too; a box ending in 's'
#   ignores shadows and keeps every piece in it (bread whose crust touches the haze).
#   Pieces are joined, padded 10px, and squared. tools/dish-sheets.txt lists every hand cut.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from collections import deque
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int); H, W = a.shape[:2]
close = lambda m: np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))) > 0
strict = close((a.min(2) < 200) | (a.max(2) - a.min(2) > 45))  # no shadows; a box ending 's' uses it
loose = close(~((a.min(2) > 140) & (a.max(2) - a.min(2) < 28)))  # 'all': the crop tool's test, shadows included
mask = Image.new('L', (W, H), 0); d = ImageDraw.Draw(mask)
def hull(p):
    p = sorted(set(p)); cr = lambda o,a,b: (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for q in p:
        while len(lo) > 1 and cr(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(up) > 1 and cr(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]
for b in sys.argv[3].split(';'):
    fg = strict if b.endswith('s') or len(sys.argv) < 5 else loose
    x0, y0, x1, y1 = map(int, b.rstrip('s').split(',')); s = 2
    sm = (fg & (np.asarray(mask) == 0))[y0:y1:s, x0:x1:s];  # a later box skips what an earlier piece covers
    h, w = sm.shape; lab = np.zeros((h, w), int); best = []; comps = []
    for y in range(h):
        for x in range(w):
            if sm[y, x] and not lab[y, x]:
                lab[y, x] = 1; q = deque([(y, x)]); pts = []
                while q:
                    cy, cx = q.popleft(); pts.append((x0+cx*s, y0+cy*s))
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = cy+dy, cx+dx
                        if 0 <= ny < h and 0 <= nx < w and sm[ny, nx] and not lab[ny, nx]: lab[ny, nx] = 1; q.append((ny, nx))
                comps.append(pts)
                if len(pts) > len(best): best = pts
    keep = list(best) if not b.endswith('s') else [p for c in comps if len(c) > 100 for p in c]  # strict: every real piece
    if len(sys.argv) > 4 and not b.endswith('s'):  # 'all': also the shadow under the piece (a bowl's white side sits between)
        bx = [p[0] for p in best]; by = sum(p[1] for p in best) / len(best)
        for c in comps:
            if c is not best and len(c) > 100:
                cx = sum(p[0] for p in c) / len(c); cy = sum(p[1] for p in c) / len(c)
                if cy > by and min(bx) <= cx <= max(bx): keep += c
    d.polygon(hull(keep), fill=255)
one = im.copy(); one.putalpha(mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8)))
bb = mask.getbbox(); pad = 10
piece = one.crop((bb[0]-pad, bb[1]-pad, bb[2]+pad, bb[3]+pad)); side = max(piece.size)
sq = Image.new('RGBA', (side, side), (0,0,0,0)); sq.paste(piece, ((side-piece.size[0])//2, (side-piece.size[1])//2), piece)
sq.save(out); print(out, sq.size)
