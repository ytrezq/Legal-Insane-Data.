"""Convertit un rendu PNG en JPEG.  Usage : python3 vers_jpg.py entree.png sortie.jpg  (nécessite Pillow)"""
import sys

from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im.save(dst, "JPEG", quality=92, optimize=True, progressive=True, subsampling=0, dpi=(300, 300))
print(dst, im.size, f"{im.size[0] * im.size[1] / 1e6:.2f} Mpx")
