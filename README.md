# 🐚 Nerita

**Clings to every pixel, grazes every word.**

Nerita is an open-source, browser-based OCR + drawing-vectorization app named after the mangrove nerita snail — a small mollusk that clings to surfaces, methodically grazes, and thrives at the boundary between land and water. Like its namesake, Nerita clings to every pixel of a scanned document and grazes across every word, thriving at the boundary between image and structured data.

## ✨ What makes Nerita different

Most browser OCR apps are thin wrappers around Tesseract.js. Nerita adds five layers that no other in-browser OCR tool combines:

### 1. Hybrid OCR engine with smart router
Nerita routes each image to the right engine automatically:
- **Tesseract.js** (offline, fast, private) — for clean printed text
- **Vision AI** (cloud, accurate) — for handwriting, messy scans, mixed scripts, math formulas

A client-side image analyzer computes sharpness, contrast, and messiness, then the smart router picks the best engine. You can also force a specific engine.

### 2. Document intelligence
The Vision AI engine doesn't just extract text — it classifies the document type (receipt, invoice, ID card, form, table, handwritten, book page, screenshot, mixed) and pulls out structured key-value fields:
- **Receipts** → merchant, date, total, currency, tax, payment method, line items
- **Invoices** → vendor, invoice number, date, due date, total, PO number
- **ID cards** → name, ID number, date of birth, expiry, issuer
- **Forms** → each labeled field

### 3. Drawing Mode — raster to vector
Upload a drawing, sketch, or architectural plan and Nerita vectorizes it into editable geometry using OpenCV.js:
- Line segments (Hough transform)
- Circles (contour analysis)
- Polygons (contour approximation)

Export the vectors to **SVG** (web), **DXF** (AutoCAD/LibreCAD/QCAD/FreeCAD), or **SHP** (QGIS/ArcGIS). Nerita is the only browser-based tool that goes from "photo of a sketch" to "editable DXF" entirely client-side.

### 4. Searchable PDF
Generate archival-quality PDFs with the original image as a visible background and an invisible text layer overlay — searchable, selectable, copyable.

### 5. The Trail — local-first history
Every processed document is auto-saved to IndexedDB with a thumbnail, extracted text, fields, and metadata. Fully searchable. Re-exportable. No account, no server, no tracking.

## 📤 Export formats (14 total)

| Category | Formats |
|---|---|
| Text | TXT, Markdown, HTML |
| Data | CSV, XLSX, JSON, XML |
| Documents | PDF, Searchable PDF, DOCX |
| Geo | GeoJSON |
| Vector / CAD / GIS | SVG, DXF, SHP |

## 🛠 Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS 4 + shadcn/ui + Framer Motion
- **OCR (offline)**: Tesseract.js v7 (17 languages)
- **OCR (cloud)**: Vision LLM via z-ai-web-dev-sdk
- **Vectorization**: OpenCV.js (loaded from CDN on demand)
- **PDF**: jsPDF
- **DOCX**: docx
- **XLSX**: ExcelJS
- **CSV**: PapaParse
- **Storage**: IndexedDB for local history
- **Theming**: next-themes (light/dark)

## 🚀 Getting started

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev

# Open http://localhost:3000
```

### Environment variables
The Vision AI engine calls `/api/ocr-vision` which uses `z-ai-web-dev-sdk`. The SDK reads credentials from the environment. If you want to use a different vision provider, edit `src/app/api/ocr-vision/route.ts`.

## 📂 Project structure

```
src/
├── app/
│   ├── api/ocr-vision/route.ts    # Vision LLM OCR endpoint (server-side)
│   ├── layout.tsx                 # Theme provider + metadata
│   └── page.tsx                   # Main page wiring everything
├── components/
│   ├── ocr-uploader.tsx           # Drag-drop multi-file upload
│   ├── engine-selector.tsx        # Hybrid engine picker + image analysis
│   ├── drawing-mode-panel.tsx     # Vectorize toggle + status
│   ├── settings-panel.tsx         # Language + extraction toggles
│   ├── processing-panel.tsx       # OCR queue with progress bars
│   ├── result-viewer.tsx          # Tabs: Text / Fields / Tables / Geo / Vectors / Structure
│   ├── document-info-panel.tsx    # Document type + fields card
│   ├── export-panel.tsx           # 14 format export buttons
│   └── history-panel.tsx          # Searchable local trail (IndexedDB)
└── lib/
    ├── ocr.ts                     # Tesseract.js wrapper
    ├── hybrid-engine.ts           # Image analysis + smart router + vision OCR client
    ├── vectorize.ts               # OpenCV.js vectorization pipeline
    ├── structured-extraction.ts   # Table + geo coordinate detection
    ├── exporters.ts               # All 14 export format implementations
    └── history.ts                 # IndexedDB persistence layer
```

## 🧭 Workflow

### Text OCR
1. Upload one or more scanned images (drag-drop or click)
2. Pick an engine (Auto / Tesseract / Vision AI) and a language
3. Click **Run OCR** — Nerita grazes across each image
4. Preview extracted text, fields, tables, and geo coordinates
5. Export to any of 14 formats (or all at once)

### Drawing vectorization
1. Upload a drawing, plan, or sketch
2. (Optional) Run OCR to extract any text labels
3. Toggle **Drawing Mode** ON
4. Click **Vectorize drawing** (first run loads OpenCV.js from CDN, ~5–10s)
5. View detected lines/circles/polygons in the **Vectors** tab
6. Export to SVG, DXF, or SHP

## ⚠️ Known limitations

- **DWG** (AutoCAD native binary) is not supported in-browser. Use DXF instead — it opens in all CAD software.
- **Hand-drawn pencil sketches** may produce noisier vectors than clean digital plans.
- **Curves/arcs** are approximated as polygons. True arc detection is on the roadmap.
- **Scale calibration** — coordinates are in image pixels, not real-world units. A scale-bar reference feature is on the roadmap.
- **Vision AI** sends the image to a cloud LLM. Use Tesseract mode for fully private/offline processing.

## 🗺 Roadmap

- [ ] Real-world scale calibration (scale bar reference)
- [ ] True arc/circle detection beyond polygon approximation
- [ ] Live text correction editor (click word → highlight bbox → fix)
- [ ] PDF page-as-image input (pdf.js integration)
- [ ] Watch folder mode (PWA, auto-OCR new files)
- [ ] Pipeline builder (OCR → translate → summarize → export)
- [ ] Template marketplace (community-shared extraction templates)
- [ ] Tauri/Electron desktop wrapper for fully offline use

## 📜 License

Open-source. Built on Tesseract.js (Apache 2.0), OpenCV.js (Apache 2.0), and the Next.js stack (MIT).

## 🙏 Acknowledgments

- [Tesseract.js](https://github.com/naptha/tesseract.js) — the OCR engine that runs in the browser
- [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) — computer vision in the browser
- [shadcn/ui](https://ui.shadcn.com/) — the component library
- The mangrove nerita snail — for the metaphor
