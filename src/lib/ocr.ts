'use client'

import Tesseract from 'tesseract.js'

export type OcrProgress = {
  status: string
  progress: number // 0..1
}

export type OcrWord = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export type OcrLine = {
  text: string
  confidence: number
  words: OcrWord[]
}

export type OcrBlock = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
  lines: OcrLine[]
  paragraph?: boolean
}

export type OcrResult = {
  text: string
  confidence: number
  blocks: OcrBlock[]
  lines: OcrLine[]
  words: OcrWord[]
  language: string
}

/**
 * Run Tesseract.js OCR on a single image file (or image data URL).
 * Returns the recognized text plus structured blocks / lines / words.
 *
 * Tesseract.js v7 may return either a nested structure (data.blocks[].lines[].words[])
 * or flat arrays (data.lines, data.words) depending on the version and output options.
 * This function normalizes both shapes into the OcrResult format.
 */
export async function runOcr(
  image: File | string,
  language: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const worker = await Tesseract.createWorker(language, 1, {
    logger: (m: { status: string; progress?: number }) => {
      if (onProgress && typeof m.progress === 'number') {
        onProgress({ status: m.status, progress: m.progress })
      }
    },
  })

  try {
    // Explicitly request block/line/word output so we always get the hierarchy.
    // Note: `blocks: true` returns Block objects with nested paragraphs/lines/words.
    // Do NOT enable `layoutBlocks` — that returns text regions without the hierarchy.
    const { data } = await worker.recognize(
      image,
      {},
      {
        text: true,
        blocks: true,
        hocr: false,
        tsv: false,
      },
    )

    const blocks: OcrBlock[] = []
    const lines: OcrLine[] = []
    const words: OcrWord[] = []

    // Tesseract.js v7 hierarchy: data.blocks[].paragraphs[].lines[].words[]
    type RawWord = {
      text: string
      confidence: number
      bbox: { x0: number; y0: number; x1: number; y1: number }
    }
    type RawLine = {
      text: string
      confidence: number
      bbox: { x0: number; y0: number; x1: number; y1: number }
      words?: RawWord[]
    }
    type RawParagraph = {
      text: string
      confidence: number
      bbox: { x0: number; y0: number; x1: number; y1: number }
      lines?: RawLine[]
    }
    type RawBlock = {
      text: string
      confidence: number
      bbox: { x0: number; y0: number; x1: number; y1: number }
      blocktype?: string
      paragraphs?: RawParagraph[]
      // Some versions put lines directly on the block:
      lines?: RawLine[]
    }

    const rawBlocks = (data.blocks ?? []) as unknown as RawBlock[]

    for (const block of rawBlocks) {
      const blockLines: OcrLine[] = []
      // In v7, lines are nested under paragraphs. Fall back to block.lines
      // for older versions that put lines directly on the block.
      const paragraphs = block.paragraphs ?? []
      const directLines = block.lines ?? []
      const sourceLines: RawLine[] =
        paragraphs.length > 0 ? paragraphs.flatMap((p) => p.lines ?? []) : directLines

      for (const line of sourceLines) {
        const lineWords: OcrWord[] = (line.words ?? []).map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox,
        }))
        const lineObj: OcrLine = {
          text: (line.text ?? '').trim(),
          confidence: line.confidence ?? 0,
          words: lineWords,
        }
        blockLines.push(lineObj)
        lines.push(lineObj)
        words.push(...lineWords)
      }
      blocks.push({
        text: (block.text ?? '').trim(),
        confidence: block.confidence ?? 0,
        bbox: block.bbox,
        lines: blockLines,
        paragraph: paragraphs.length > 0,
      })
    }

    // Fallback: if blocks/lines weren't returned in the nested structure,
    // build lines/words from the flat arrays Tesseract provides.
    if (lines.length === 0) {
      const flatLines = (data as unknown as { lines?: Array<{
        text: string
        confidence: number
        bbox: { x0: number; y0: number; x1: number; y1: number }
        words?: Array<{
          text: string
          confidence: number
          bbox: { x0: number; y0: number; x1: number; y1: number }
        }>
      }> }).lines ?? []

      for (const line of flatLines) {
        const lineWords: OcrWord[] = (line.words ?? []).map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox,
        }))
        const lineObj: OcrLine = {
          text: (line.text ?? '').trim(),
          confidence: line.confidence ?? 0,
          words: lineWords,
        }
        lines.push(lineObj)
        words.push(...lineWords)
      }
    }

    // Last-resort fallback: if we still have no lines but have flat words,
    // reconstruct lines from word y-positions.
    if (lines.length === 0) {
      const flatWords = (data as unknown as { words?: Array<{
        text: string
        confidence: number
        bbox: { x0: number; y0: number; x1: number; y1: number }
      }> }).words ?? []
      if (flatWords.length) {
        // Group by row (similar y-center)
        const sorted = [...flatWords].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
        const rows: OcrWord[][] = []
        const rowThreshold = 8
        for (const w of sorted) {
          const lastRow = rows[rows.length - 1]
          if (lastRow) {
            const lastY = (lastRow[0].bbox.y0 + lastRow[0].bbox.y1) / 2
            const curY = (w.bbox.y0 + w.bbox.y1) / 2
            if (Math.abs(lastY - curY) <= rowThreshold) {
              lastRow.push(w)
              continue
            }
          }
          rows.push([w])
        }
        for (const row of rows) {
          row.sort((a, b) => a.bbox.x0 - b.bbox.x0)
          lines.push({
            text: row.map((w) => w.text).join(' ').trim(),
            confidence: row.reduce((s, w) => s + w.confidence, 0) / row.length,
            words: row,
          })
          words.push(...row)
        }
      }
    }

    return {
      text: data.text,
      confidence: data.confidence,
      blocks,
      lines,
      words,
      language,
    }
  } finally {
    await worker.terminate()
  }
}

/**
 * Supported OCR languages with friendly labels.
 * The `code` matches Tesseract's traineddata file name (without `.traineddata`).
 */
export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'eng', label: 'English' },
  { code: 'chi_sim', label: '中文 (Simplified Chinese)' },
  { code: 'chi_tra', label: '中文 (Traditional Chinese)' },
  { code: 'spa', label: 'Español (Spanish)' },
  { code: 'fra', label: 'Français (French)' },
  { code: 'deu', label: 'Deutsch (German)' },
  { code: 'ita', label: 'Italiano (Italian)' },
  { code: 'por', label: 'Português (Portuguese)' },
  { code: 'rus', label: 'Русский (Russian)' },
  { code: 'jpn', label: '日本語 (Japanese)' },
  { code: 'kor', label: '한국어 (Korean)' },
  { code: 'ara', label: 'العربية (Arabic)' },
  { code: 'hin', label: 'हिन्दी (Hindi)' },
  { code: 'nld', label: 'Nederlands (Dutch)' },
  { code: 'tur', label: 'Türkçe (Turkish)' },
  { code: 'vie', label: 'Tiếng Việt (Vietnamese)' },
  { code: 'tha', label: 'ภาษาไทย (Thai)' },
]
