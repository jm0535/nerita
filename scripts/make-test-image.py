#!/usr/bin/env python3
"""Create a simple test image with text for OCR testing."""
from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs('/home/z/my-project/test-assets', exist_ok=True)

# Image 1: Simple paragraph with table and coordinates
img = Image.new('RGB', (800, 400), 'white')
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 28)
    font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except IOError:
    font = ImageFont.load_default()
    font_small = font

draw.text((40, 40), 'Hello OCR World!', fill='black', font=font)
draw.text((40, 90), 'This is a test document for the OpenOCR app.', fill='black', font=font_small)
draw.text((40, 120), 'It contains a paragraph of text that should', fill='black', font=font_small)
draw.text((40, 150), 'be recognized by Tesseract.js.', fill='black', font=font_small)

draw.text((40, 200), 'Name    Age    City', fill='black', font=font_small)
draw.text((40, 230), 'Alice    30     Paris', fill='black', font=font_small)
draw.text((40, 260), 'Bob      25     London', fill='black', font=font_small)
draw.text((40, 290), 'Charlie  35     Tokyo', fill='black', font=font_small)

draw.text((40, 340), 'Coordinates: 48.8566, 2.3522', fill='black', font=font_small)

img.save('/home/z/my-project/test-assets/sample1.png')
print('Saved /home/z/my-project/test-assets/sample1.png')
