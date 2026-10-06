"""Builds public/og-image.png (1200×630) — the link preview image for messengers and social networks.

    .venv/bin/python frontend/scripts/make-og-image.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 1200, 630
TEAL, TEAL_DARK, CREAM, AMBER = (14, 90, 84), (10, 66, 61), (243, 246, 245), (242, 181, 68)
FONTS = Path("/usr/share/fonts/truetype/noto")

img = Image.new("RGB", (W, H), TEAL)
draw = ImageDraw.Draw(img)
# Soft "radar" rings from the bottom-right: help spreading to people nearby.
for i, r in enumerate(range(760, 120, -120)):
    shade = TEAL_DARK if i % 2 else TEAL
    draw.ellipse((W - 180 - r, H - 120 - r, W - 180 + r, H - 120 + r), fill=shade)
draw.ellipse((W - 200, H - 140, W - 160, H - 100), fill=AMBER)

logo = Image.open(ROOT / "public/icons/icon-512.png").convert("RGBA").resize((150, 150))
img.paste(logo, (90, 90), logo)

name = ImageFont.truetype(str(FONTS / "NotoSans-Bold.ttf"), 120)
slogan = ImageFont.truetype(str(FONTS / "NotoSerif-Italic.ttf"), 52)
body = ImageFont.truetype(str(FONTS / "NotoSans-Regular.ttf"), 36)
draw.text((90, 270), "Poruch", font=name, fill=CREAM)
draw.text((94, 420), "Допомога від людей поруч", font=slogan, fill=(220, 236, 232))
draw.text((94, 510), "Попроси допомогу або допоможи сам", font=body, fill=(170, 205, 198))

out = ROOT / "public/og-image.png"
img.save(out, optimize=True)
print(out, out.stat().st_size // 1024, "KB")
