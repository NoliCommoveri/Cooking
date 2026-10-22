import sys, numpy as np
# Splits the owner's world map into layers the Chef's Passport map can recolor:
#   map-base.webp     the map with every country in plain tan
#   map-lines.webp    the coastlines and borders only, drawn on top
#   map-<region>.png  one mask per passport region (white where its land is)
# Usage: python3 tools/split-world-map.py SOURCE OUTDIR [DEBUG.png]
# Points below are in the source's own pixels (1774 x 887). The Americas use the
# source's yellow fill (US vs. Latin America split at the Mexico border); the rest
# of the world goes to the nearest seed point, and seeds marked None stay tan.
from PIL import Image, ImageFilter
src, outdir = sys.argv[1], sys.argv[2]
SW, SH, W = 1774, 887, 1100
SEEDS = {
 'europe': [(800,325),(785,335),(905,345),(955,335),(790,290),(830,265),(870,300),(890,330),(945,350),(900,190),(880,140),(950,250),(1000,270),(1050,250),(810,230),(770,170),(930,300)],
 'mena':   [(800,385),(830,395),(860,385),(920,395),(990,390),(1000,345),(1040,335),(1030,365),(1080,360),(1120,370),(1050,420),(1080,445),(1140,345)],
 'africa': [(800,450),(880,470),(960,470),(1050,480),(900,550),(980,560),(950,650),(1060,600),(1070,620),(1000,520)],
 'sasia':  [(1250,430),(1260,500),(1225,400),(1185,385),(1265,512),(1310,425),(1275,392)],
 'easia':  [(1350,350),(1420,330),(1450,380),(1490,330),(1560,330),(1540,370),(1580,320),(1360,450),(1380,480),(1400,540),(1440,560),(1480,570),(1500,480),(1490,455),(1480,410),(1430,280),(1340,300),(1330,400)],
 None:     [(1100,180),(1200,150),(1300,150),(1400,150),(1500,140),(1600,160),(1650,200),(1700,180),(1200,250),(1150,290),(1210,300),(1170,340),(1100,280),(1500,700),(1550,680),(1450,650),(1700,750),(900,850),(500,850),(1300,850),(1590,575),(1620,590),(1470,612),(1520,600),(1560,605),(1100,860)],
}
im = Image.open(src).convert('RGB')
assert im.size == (SW, SH), im.size
H = round(W*SH/SW); k = W/SW
a = np.asarray(im.resize((W, H), Image.LANCZOS)).astype(float)
r, g, b = a[...,0], a[...,1], a[...,2]; lum = .3*r+.59*g+.11*b
white = a.min(axis=2) > 238
water = (b > r+25) & (b > 170)
dark = lum < 150
land = ~white & ~water & ~dark
# small islands lose their fill when shrunk, so find yellow at full size first
fa = np.asarray(im).astype(int)
yfull = (fa[...,0]-fa[...,2] > 110) & (fa[...,0] > 200)
yd = np.asarray(Image.fromarray((yfull*255).astype('uint8')).resize((W, H), Image.BOX)) > 40
yellow = (land & (r-b > 90)) | yd
TAN = np.array([232,217,185.]); YEL = np.array([253,200,70.])
# base: yellow fill (and its blends into the outline) turned tan
t = np.clip((r-b-47)/(183-47), 0, 1)[...,None] * (~water)[...,None]
base = np.clip(a + t*(TAN-YEL), 0, 255)
alpha = np.where(white, 0, 255)
Image.fromarray(np.dstack([base, alpha]).astype('uint8'), 'RGBA').save(f'{outdir}/map-base.webp', quality=86)
# outlines: dark pixels only, with soft edges
la = np.clip((185-lum)/(185-70), 0, 1)*255*(~white)
ink = np.zeros((H, W, 4)); ink[...,0], ink[...,1], ink[...,2], ink[...,3] = 43, 42, 40, la
Image.fromarray(ink.astype('uint8'), 'RGBA').save(f'{outdir}/map-lines.webp', lossless=True)
# region labels
ys, xs = np.mgrid[0:H, 0:W]; ox, oy = xs/k, ys/k
names = [n for n in SEEDS if n]; label = np.full((H, W), -1)
pts = [(x*k, y*k, i) for i, n in enumerate(list(SEEDS)) for (x, y) in SEEDS[n]]
best = np.full((H, W), np.inf); who = np.full((H, W), -1)
for x, y, i in pts:
    d = (xs-x)**2 + (ys-y)**2; m = d < best; best[m] = d[m]; who[m] = i
keys = list(SEEDS)
for i, n in enumerate(keys):
    if n: label[(who == i) & (ox >= 700)] = names.index(n)
# Africa west of the Red Sea splits at a straight line across the Sahara
afr = (ox < 1035) & np.isin(label, [names.index('mena'), names.index('africa')])
label[afr & (oy < 425)] = names.index('mena'); label[afr & (oy >= 425)] = names.index('africa')
# Americas: yellow land only; north of the Mexico border (and Alaska, Hawaii) is the US
border = np.where(ox <= 345, 380+(ox-245)*.3, np.where(ox <= 415, 400, 420))
amer = (ox < 700) & yellow
label[amer & ((oy < border) | (ox < 200))] = len(names)
label[amer & (oy >= border) & (ox >= 200)] = len(names)+1
names += ['usa', 'latam']
grow = land | dark
for i, n in enumerate(names):
    m = (label == i) & (land | yellow)
    m = np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
    m &= grow
    out = np.zeros((H, W, 4), 'uint8'); out[..., :3] = 255; out[..., 3] = m*255
    Image.fromarray(out, 'RGBA').save(f'{outdir}/map-{n}.png', optimize=True)
if len(sys.argv) > 3:
    cols = [(34,64,107),(217,65,43),(78,139,58),(122,62,142),(46,125,122),(246,201,69),(181,101,29)]
    dbg = base.copy()
    for i in range(len(names)): dbg[(label == i) & land] = cols[i]
    dbg[dark] = 30
    Image.fromarray(dbg.astype('uint8')).save(sys.argv[3])
    print('order:', names)
