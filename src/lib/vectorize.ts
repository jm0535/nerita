'use client'

/**
 * Vectorization pipeline: turn a raster image (drawing/sketch/plan) into
 * geometric primitives — line segments, circles, rectangles, polygons.
 *
 * Uses OpenCV.js loaded from CDN at runtime (the npm package is 11MB and
 * chokes Turbopack). The CDN script is loaded lazily on first use.
 *
 * Pipeline:
 *   - Grayscale + Gaussian blur
 *   - Canny edge detection
 *   - Hough line transform (straight lines)
 *   - Contour detection (closed shapes)
 *   - Polygon approximation (rectangles, polygons)
 *
 * Output is engine-agnostic — a VectorLayer that can be rendered as SVG,
 * exported as DXF / SHP / GeoJSON, or overlaid on the original image.
 */

export type Point = { x: number; y: number }

export type LineSegment = {
  type: 'line'
  start: Point
  end: Point
  length: number
}

export type Circle = {
  type: 'circle'
  center: Point
  radius: number
}

export type Polygon = {
  type: 'polygon'
  points: Point[]
  closed: boolean
  area: number
}

export type VectorPrimitive = LineSegment | Circle | Polygon

export type VectorLayer = {
  width: number
  height: number
  lines: LineSegment[]
  circles: Circle[]
  polygons: Polygon[]
  totalPrimitives: number
}

export type VectorizeProgress = {
  status: string
  progress: number // 0..1
}

/**
 * OpenCV.js runtime shape — only the methods we use.
 */
type Cv = {
  Mat: new () => CvMat
  MatVector: new () => { size: () => number; get: (i: number) => CvMat; delete: () => void }
  Size: new (w: number, h: number) => unknown
  matFromImageData: (img: ImageData) => CvMat
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void
  GaussianBlur: (src: CvMat, dst: CvMat, ksize: unknown, sigma: number) => void
  Canny: (src: CvMat, dst: CvMat, low: number, high: number, aperture: number, l2: boolean) => void
  HoughLinesP: (src: CvMat, dst: CvMat, rho: number, theta: number, thresh: number, minLen: number, maxGap: number) => void
  findContours: (img: CvMat, contours: { size: () => number; get: (i: number) => CvMat }, hierarchy: CvMat, mode: number, method: number) => void
  approxPolyDP: (src: CvMat, dst: CvMat, epsilon: number, closed: boolean) => void
  contourArea: (mat: CvMat) => number
  arcLength: (mat: CvMat, closed: boolean) => number
  RETR_LIST: number
  CHAIN_APPROX_SIMPLE: number
  COLOR_RGBA2GRAY: number
}

type CvMat = {
  data32S: Int32Array
  data32F: Float32Array
  rows: number
  cols: number
  delete: () => void
}

declare global {
  interface Window {
    cv?: Cv
  }
}

const CV_CDN_URL = 'https://docs.opencv.org/4.x/opencv.js'
let cvPromise: Promise<Cv> | null = null

/**
 * Load OpenCV.js from CDN and wait for the WASM runtime to be ready.
 * The CDN script attaches `cv` to window, then `cv.Mat` becomes available
 * once the WASM module finishes initializing (it emits 'onRuntimeInitialized').
 */
async function loadCv(): Promise<Cv> {
  if (cvPromise) return cvPromise

  cvPromise = new Promise<Cv>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('OpenCV.js requires a browser environment'))
      return
    }
    if (window.cv && 'Mat' in window.cv) {
      resolve(window.cv)
      return
    }
    const script = document.createElement('script')
    script.src = CV_CDN_URL
    script.async = true
    script.onload = () => {
      // Poll for runtime ready (cv.Mat becomes available after WASM init)
      const start = Date.now()
      const check = () => {
        if (window.cv && 'Mat' in window.cv) {
          resolve(window.cv)
        } else if (Date.now() - start > 30000) {
          reject(new Error('OpenCV.js failed to initialize within 30s'))
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    }
    script.onerror = () => reject(new Error('Failed to load OpenCV.js from CDN'))
    document.head.appendChild(script)
  })

  return cvPromise
}

/**
 * Main vectorization entry point. Accepts a File (image) and returns a
 * VectorLayer of detected primitives.
 *
 * Tunables:
 *   - threshold: Canny low/high thresholds. Lower = more sensitive.
 *   - minLineLength: ignore Hough lines shorter than this (pixels).
 *   - maxLineGap: merge Hough lines closer than this (pixels).
 *   - minArea: ignore contours smaller than this (square pixels).
 */
export async function vectorizeImage(
  file: File,
  opts: {
    threshold?: { low: number; high: number }
    minLineLength?: number
    maxLineGap?: number
    minArea?: number
  } = {},
  onProgress?: (p: VectorizeProgress) => void,
): Promise<VectorLayer> {
  const { low = 80, high = 200 } = opts.threshold ?? {}
  const minLineLength = opts.minLineLength ?? 30
  const maxLineGap = opts.maxLineGap ?? 10
  const minArea = opts.minArea ?? 100

  onProgress?.({ status: 'Loading OpenCV.js (~8MB from CDN)', progress: 0.1 })
  const cv = await loadCv()

  onProgress?.({ status: 'Decoding image', progress: 0.2 })
  const imageData = await fileToImageData(file)
  const width = imageData.width
  const height = imageData.height

  const src = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const lines = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  const detectedLines: LineSegment[] = []
  const detectedCircles: Circle[] = []
  const detectedPolygons: Polygon[] = []

  try {
    onProgress?.({ status: 'Preprocessing', progress: 0.35 })
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0)

    onProgress?.({ status: 'Detecting edges (Canny)', progress: 0.5 })
    cv.Canny(blurred, edges, low, high, 3, false)

    // --- Hough line detection ---
    onProgress?.({ status: 'Extracting lines (Hough)', progress: 0.65 })
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, minLineLength, maxLineGap)
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4]
      const y1 = lines.data32S[i * 4 + 1]
      const x2 = lines.data32S[i * 4 + 2]
      const y2 = lines.data32S[i * 4 + 3]
      const length = Math.hypot(x2 - x1, y2 - y1)
      if (length >= minLineLength) {
        detectedLines.push({
          type: 'line',
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          length,
        })
      }
    }

    // --- Contour detection (closed shapes) ---
    onProgress?.({ status: 'Detecting contours', progress: 0.8 })
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const area = cv.contourArea(contour)
      if (area < minArea) {
        contour.delete()
        continue
      }

      // Approximate polygon to simplify the contour
      const approx = new cv.Mat()
      const peri = cv.arcLength(contour, true)
      cv.approxPolyDP(contour, approx, 0.02 * peri, true)

      const points: Point[] = []
      for (let j = 0; j < approx.rows; j++) {
        points.push({
          x: approx.data32S[j * 2],
          y: approx.data32S[j * 2 + 1],
        })
      }

      if (points.length >= 3) {
        // Detect circle: contour has many points and is roughly equidistant from centroid
        if (points.length >= 8 && looksCircular(points)) {
          const center = centroidOf(points)
          const radius = points.reduce((s, p) => s + Math.hypot(p.x - center.x, p.y - center.y), 0) / points.length
          detectedCircles.push({ type: 'circle', center, radius })
        } else {
          detectedPolygons.push({
            type: 'polygon',
            points,
            closed: true,
            area,
          })
        }
      }

      approx.delete()
      contour.delete()
    }

    onProgress?.({ status: 'Done', progress: 1 })

    return {
      width,
      height,
      lines: dedupeLines(detectedLines, 8),
      circles: detectedCircles,
      polygons: detectedPolygons,
      totalPrimitives: detectedLines.length + detectedCircles.length + detectedPolygons.length,
    }
  } finally {
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    lines.delete()
    contours.delete()
    hierarchy.delete()
  }
}

/**
 * Convert a File to ImageData (RGBA pixels) via canvas.
 */
async function fileToImageData(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = (e) => reject(e)
      i.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not get canvas 2d context')
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Heuristic: a contour is "circular" if all points are within ~15% of the
 * mean distance from the centroid.
 */
function looksCircular(points: Point[]): boolean {
  const c = centroidOf(points)
  const dists = points.map((p) => Math.hypot(p.x - c.x, p.y - c.y))
  const mean = dists.reduce((s, d) => s + d, 0) / dists.length
  if (mean === 0) return false
  const variance = dists.reduce((s, d) => s + (d - mean) ** 2, 0) / dists.length
  const cv = Math.sqrt(variance) / mean // coefficient of variation
  return cv < 0.15
}

function centroidOf(points: Point[]): Point {
  const sx = points.reduce((s, p) => s + p.x, 0)
  const sy = points.reduce((s, p) => s + p.y, 0)
  return { x: sx / points.length, y: sy / points.length }
}

/**
 * Remove near-duplicate lines (same line detected multiple times by Hough).
 * Two lines are dupes if both endpoints are within `tolerance` pixels of
 * each other (in either order).
 */
function dedupeLines(lines: LineSegment[], tolerance: number): LineSegment[] {
  const result: LineSegment[] = []
  for (const line of lines) {
    const isDupe = result.some((existing) =>
      pointsClose(line.start, existing.start, tolerance) && pointsClose(line.end, existing.end, tolerance),
    ) || result.some((existing) =>
      pointsClose(line.start, existing.end, tolerance) && pointsClose(line.end, existing.start, tolerance),
    )
    if (!isDupe) result.push(line)
  }
  return result
}

function pointsClose(a: Point, b: Point, tol: number): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol
}

/**
 * Render a VectorLayer as an SVG string. Y-axis is flipped so the SVG
 * matches the original image orientation (image y goes down, SVG y goes down
 * too — so no flip needed actually; we use image coordinates directly).
 */
export function vectorLayerToSvg(layer: VectorLayer): string {
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layer.width} ${layer.height}" width="${layer.width}" height="${layer.height}">`)
  parts.push(`<rect width="${layer.width}" height="${layer.height}" fill="white"/>`)

  // Lines
  for (const line of layer.lines) {
    parts.push(
      `<line x1="${line.start.x}" y1="${line.start.y}" x2="${line.end.x}" y2="${line.end.y}" stroke="black" stroke-width="2"/>`,
    )
  }

  // Circles
  for (const c of layer.circles) {
    parts.push(
      `<circle cx="${c.center.x}" cy="${c.center.y}" r="${c.radius}" fill="none" stroke="black" stroke-width="2"/>`,
    )
  }

  // Polygons
  for (const p of layer.polygons) {
    const pts = p.points.map((pt) => `${pt.x},${pt.y}`).join(' ')
    parts.push(
      `<polygon points="${pts}" fill="none" stroke="black" stroke-width="2"/>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
