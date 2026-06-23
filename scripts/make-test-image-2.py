#!/usr/bin/env python3
"""Create a second test image with different content."""
from PIL import Image, ImageDraw, ImageFont

img = Image.new('RGB', (800, 300), 'white')
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
    font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except IOError:
    font = ImageFont.load_default()
    font_small = font

draw.text((40, 40), 'Invoice #12345', fill='black', font=font)
draw.text((40, 90), 'Date: 2024-01-15', fill='black', font=font_small)
draw.text((40, 120), 'Customer: Acme Corp', fill='black', font=font_small)
draw.text((40, 150), 'Total: $1,234.56', fill='black', font=font_small)
draw.text((40, 200), 'Item        Qty     Price', fill='black', font=font_small)
draw.text((40, 225), 'Widget       10     $5.99', fill='black', font=font_small)
draw.text((40, 250), 'Gadget       5      $12.50', fill='black', font=font_small)

img.save('/home/z/my-project/test-assets/sample2.png')
print('Saved sample2.png')
