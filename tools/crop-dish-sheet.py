import sys, numpy as np
# Crops a sheet of dish illustrations on a white background into one
# transparent square PNG per dish, in reading order (top row first).
# Usage: python3 tools/crop-dish-sheet.py SHEET OUTDIR name1,name2,... [erode]
from PIL import Image, ImageDraw, ImageFilter
from collections import deque
src, outdir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int)
H, W = a.shape[:2]
white = (a.min(axis=2) > 232)
# exterior background = near-white connected to the border (flood fill)
m = Image.fromarray((white*255).astype('uint8')).copy()
for x in range(0, W, 8):
    for y in (0, H-1):
        if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
for y in range(0, H, 8):
    for x in (0, W-1):
        if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
fg = np.asarray(m) != 128
# components on a 4x downsample
s = 4; er = np.asarray(Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.MinFilter(int(sys.argv[4]) if len(sys.argv)>4 else 9)))>0; small = er[::s, ::s]; h, w = small.shape
lab = np.zeros((h, w), int); comps = []
for y in range(h):
    for x in range(w):
        if small[y, x] and not lab[y, x]:
            n = len(comps)+1; q = deque([(y, x)]); lab[y, x] = n; ys=[];xs=[]
            while q:
                cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    ny, nx = cy+dy, cx+dx
                    if 0<=ny<h and 0<=nx<w and small[ny,nx] and not lab[ny,nx]:
                        lab[ny,nx]=n; q.append((ny,nx))
            if len(ys) > 2000: comps.append((min(ys)*s, min(xs)*s, max(ys)*s+s, max(xs)*s+s, n))
# reading order: a dish starts a new row once it begins below the current row's top dish
comps.sort(key=lambda c: c[0]); rows = []
for c in comps:
    if rows and c[0] < min(r[2] for r in rows[-1]) * 0.5 + rows[-1][0][0] * 0.5: rows[-1].append(c)
    else: rows.append([c])
comps = [c for r in rows for c in sorted(r, key=lambda c: c[1])]
print(len(comps), 'dishes found')
alpha = Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.copy(); rgba.putalpha(alpha)
for c, name in zip(comps, names):
    y0,x0,y1,x1,n = c; pad = 6 + (int(sys.argv[4]) if len(sys.argv)>4 else 9)//2
    box = (max(0,x0-pad), max(0,y0-pad), min(W,x1+pad), min(H,y1+pad))
    own = Image.fromarray(((lab==n)*255).astype('uint8')).resize((w*s,h*s), Image.NEAREST).crop((0,0,W,H)).filter(ImageFilter.MaxFilter(25))
    al = np.minimum(np.asarray(alpha), np.asarray(own)).astype('uint8')
    one = im.copy(); one.putalpha(Image.fromarray(al))
    piece = one.crop(box); side = max(piece.size)
    sq = Image.new('RGBA', (side, side), (0,0,0,0)); sq.paste(piece, ((side-piece.size[0])//2, (side-piece.size[1])//2))
    sq.save(f'{outdir}/{name}.png'); print(name, sq.size)
