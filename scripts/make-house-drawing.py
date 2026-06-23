#!/usr/bin/env python3
"""Create a simple house drawing for vectorization testing."""
from PIL import Image, ImageDraw

img = Image.new('RGB', (600, 500), 'white')
draw = ImageDraw.Draw(img)

# House outline (rectangle)
draw.rectangle([(100, 200), (500, 450)], outline='black', width=3)

# Roof (triangle/polygon)
draw.polygon([(80, 200), (300, 80), (520, 200)], outline='black', width=3)

# Door (rectangle)
draw.rectangle([(260, 320), (340, 450)], outline='black', width=3)

# Window 1 (rectangle)
draw.rectangle([(130, 240), (220, 310)], outline='black', width=3)
# Window cross
draw.line([(175, 240), (175, 310)], fill='black', width=2)
draw.line([(130, 275), (220, 275)], fill='black', width=2)

# Window 2 (rectangle)
draw.rectangle([(380, 240), (470, 310)], outline='black', width=3)
draw.line([(425, 240), (425, 310)], fill='black', width=2)
draw.line([(380, 275), (470, 275)], fill='black', width=2)

# Sun (circle)
draw.ellipse([(490, 50), (560, 120)], outline='black', width=3)

# Ground line
draw.line([(50, 450), (560, 450)], fill='black', width=3)

# Path lines
draw.line([(260, 450), (260, 480)], fill='black', width=2)
draw.line([(340, 450), (340, 480)], fill='black', width=2)

img.save('/home/z/my-project/test-assets/house-drawing.png')
print('Saved house-drawing.png')
