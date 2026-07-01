'use client'

import type { OcrResult, OcrProgress } from './ocr'

/**
 * Hybrid OCR engine: routes between Tesseract.js (offline, fast) and
 * a vision LLM (accurate for handwriting / messy scans / mixed scripts).
 *
 * The vision LLM path calls a Next.js API route (/api/ocr-vision) that
 * calls the Anthropic Claude API server-side. The browser never sees the API key.
 */

export type EngineId = 'tesseract' | 'vision-ai' | 'auto'

export type EngineChoice = {
  engine: EngineId
  reason: string
}

export type ImageAnalysis = {
  width: number
  height: number
  aspectRatio: number
  /** 0..1 estimate of how "messy" the image is (low contrast, skew, handwriting) */
  messiness: number
  /** best guess at dominant script */
  script: 'latin' | 'cjk' | 'arabic' | 'mixed' | 'unknown'
  /** sharpness 0..1 (1 = crisp) */
  sharpness: number
  /** contrast 0..1 (1 = high contrast) */
  contrast: number
}

/**
 * Quickly analyze an image client-side to decide which engine to use.
 * Uses a tiny canvas + pixel statistics. No OCR is performed here.
 */
export async function analyzeImage(file: File): Promise<ImageAnalysis> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth
    const h = img.naturalHeight

    // Downscale to a thumbnail for fast analysis
    const thumbW = 160
    const thumbH = Math.max(1, Math.round((h / w) * thumbW))
    const canvas = document.createElement('canvas')
    canvas.width = thumbW
    canvas.height = thumbH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return { width: w, height: h, aspectRatio: w / h, messiness: 0.5, script: 'unknown', sharpness: 0.5, contrast: 0.5 }
    }
    ctx.drawImage(img, 0, 0, thumbW, thumbH)
    const { data } = ctx.getImageData(0, 0, thumbW, thumbH)

    // Compute luminance stats
    const lums: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      lums.push(0.299 * r + 0.587 * g + 0.114 * b)
    }
    const mean = lums.reduce((s, v) => s + v, 0) / lums.length
    const variance = lums.reduce((s, v) => s + (v - mean) ** 2, 0) / lums.length
    const std = Math.sqrt(variance)
    // contrast: std/128 → 0..1
    const contrast = Math.min(1, std / 64)

    // Sharpness: average absolute horizontal luminance gradient
    let gradSum = 0
    let gradCount = 0
    for (let y = 0; y < thumbH; y++) {
      for (let x = 1; x < thumbW; x++) {
        const idx = (y * thumbW + x) * 4
        const lumPrev = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2]
        const lumCur = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        gradSum += Math.abs(lumCur - lumPrev)
        gradCount++
      }
    }
    const meanGrad = gradSum / Math.max(1, gradCount)
    const sharpness = Math.min(1, meanGrad / 32)

    // Messiness heuristic: low sharpness OR low contrast OR very high density of dark pixels
    let darkPixels = 0
    for (const l of lums) if (l < 128) darkPixels++
    const darkRatio = darkPixels / lums.length
    let messiness = 0
    if (sharpness < 0.25) messiness += 0.4
    if (contrast < 0.3) messiness += 0.3
    if (darkRatio > 0.5) messiness += 0.2
    messiness = Math.min(1, messiness)

    return {
      width: w,
      height: h,
      aspectRatio: w / h,
      messiness,
      script: 'latin', // true script detection needs OCR; default latin
      sharpness,
      contrast,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Decide which engine to use based on analysis + user preference.
 * - 'tesseract' / 'vision-ai' → user's explicit choice
 * - 'auto' → use vision-ai if messiness is high OR image is small (likely handwriting/photo),
 *            otherwise tesseract (faster, offline)
 */
export function chooseEngine(
  pref: EngineId,
  analysis: ImageAnalysis,
): EngineChoice {
  if (pref === 'tesseract') return { engine: 'tesseract', reason: 'User selected offline Tesseract engine' }
  if (pref === 'vision-ai') return { engine: 'vision-ai', reason: 'User selected Vision AI engine' }

  // auto
  if (analysis.messiness >= 0.5) {
    return {
      engine: 'vision-ai',
      reason: `Auto: image looks messy (messiness ${(analysis.messiness * 100).toFixed(0)}%) — Vision AI will be more accurate`,
    }
  }
  if (analysis.sharpness < 0.2) {
    return {
      engine: 'vision-ai',
      reason: `Auto: low sharpness (${(analysis.sharpness * 100).toFixed(0)}%) — Vision AI handles blurry scans better`,
    }
  }
  if (analysis.width < 400 || analysis.height < 400) {
    return {
      engine: 'vision-ai',
      reason: 'Auto: small image — likely a photo/handwriting, Vision AI preferred',
    }
  }
  return {
    engine: 'tesseract',
    reason: `Auto: clean printed text detected (sharpness ${(analysis.sharpness * 100).toFixed(0)}%, contrast ${(analysis.contrast * 100).toFixed(0)}%) — Tesseract is fast and offline`,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = url
  })
}

/**
 * Call the server-side vision LLM OCR endpoint.
 * The server uses the Anthropic Claude API to call a vision model.
 */
export async function runVisionOcr(
  file: File,
  language: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  onProgress?.({ status: 'encoding', progress: 0.1 })

  // Convert file to base64
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'image/png'

  onProgress?.({ status: 'sending to vision AI', progress: 0.3 })

  const dataUrl = `data:${mimeType};base64,${base64}`
  const response = await fetch('/api/ocr-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: dataUrl,
      language,
    }),
  })

  onProgress?.({ status: 'vision AI thinking', progress: 0.6 })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Vision OCR failed (${response.status}): ${errText}`)
  }

  const data = (await response.json()) as {
    text: string
    blocks?: Array<{
      text: string
      confidence: number
      lines?: Array<{
        text: string
        confidence: number
        words?: Array<{
          text: string
          confidence: number
          bbox: { x0: number; y0: number; x1: number; y1: number }
        }>
      }>
    }>
    documentType?: string
    fields?: Record<string, string>
    confidence?: number
  }

  onProgress?.({ status: 'parsing', progress: 0.9 })

  // Normalize into OcrResult. Vision LLM doesn't return bboxes, so we
  // synthesize pseudo-bboxes by treating each line as a row.
  const blocks = (data.blocks ?? []).map((b) => {
    const lines = (b.lines ?? b.text.split('\n').filter(Boolean)).map((line) => {
      const words = (line.words ?? line.text.split(/\s+/).filter(Boolean)).map((w, idx) => ({
        text: w.text ?? w,
        confidence: w.confidence ?? 0.95,
        bbox: { x0: idx * 50, y0: 0, x1: idx * 50 + 40, y1: 20 },
      }))
      return {
        text: line.text?.trim() ?? '',
        confidence: line.confidence ?? 0.95,
        words: Array.isArray(line.words) ? words : words,
      }
    })
    return {
      text: b.text.trim(),
      confidence: b.confidence ?? 0.95,
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      lines,
      paragraph: true,
    }
  })

  // If blocks weren't returned, build them from text
  if (blocks.length === 0 && data.text) {
    const paragraphs = data.text.split(/\n\s*\n/).filter(Boolean)
    for (const p of paragraphs) {
      const lines = p.split('\n').filter(Boolean).map((lineText) => ({
        text: lineText.trim(),
        confidence: 0.95,
        words: lineText.split(/\s+/).filter(Boolean).map((w, idx) => ({
          text: w,
          confidence: 0.95,
          bbox: { x0: idx * 50, y0: 0, x1: idx * 50 + 40, y1: 20 },
        })),
      }))
      blocks.push({
        text: p.trim(),
        confidence: 0.95,
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
        lines,
        paragraph: true,
      })
    }
  }

  const lines = blocks.flatMap((b) => b.lines)
  const words = lines.flatMap((l) => l.words)

  onProgress?.({ status: 'done', progress: 1 })

  return {
    text: data.text,
    confidence: data.confidence ?? 0.95,
    blocks,
    lines,
    words,
    language,
    engine: 'vision-ai',
    documentType: (data.documentType as OcrResult['documentType']) ?? 'other',
    fields: data.fields ?? {},
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip "data:...;base64," prefix
      const commaIdx = result.indexOf(',')
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
