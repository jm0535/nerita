'use client'

import type { OcrResult } from './ocr'

/**
 * Detect simple tabular structures from OCR blocks.
 * Uses word bounding boxes (when available) to detect column boundaries:
 * if multiple consecutive lines have words that cluster into the same
 * number of horizontal groups, treat them as a table.
 *
 * Falls back to a whitespace-based heuristic when bboxes aren't available.
 */
export type DetectedTable = {
  headers: string[]
  rows: string[][]
}

export function detectTables(result: OcrResult): DetectedTable[] {
  // Strategy 1: bbox-based column clustering (more accurate)
  const bboxTables = detectTablesByBbox(result)
  if (bboxTables.length > 0) return bboxTables

  // Strategy 2: whitespace-based fallback
  const tables: DetectedTable[] = []
  const lines = result.lines.map((l) => l.text).filter(Boolean)
  let i = 0
  while (i < lines.length) {
    const split = splitColumns(lines[i])
    if (split.length >= 2) {
      const colCount = split.length
      const rows: string[][] = [split]
      let j = i + 1
      while (j < lines.length) {
        const s = splitColumns(lines[j])
        if (s.length === colCount) {
          rows.push(s)
          j++
        } else {
          break
        }
      }
      if (rows.length >= 2) {
        tables.push({ headers: rows[0], rows: rows.slice(1) })
        i = j
        continue
      }
    }
    i++
  }
  return tables
}

/**
 * Use word bounding boxes to detect columns. For each line, group words into
 * columns based on horizontal gaps. If consecutive non-empty lines have the
 * same column count and the column x-positions roughly align, treat as a table.
 */
function detectTablesByBbox(result: OcrResult): DetectedTable[] {
  const tables: DetectedTable[] = []
  const lines = result.lines.filter((l) => l.words.length > 0 && l.text.trim())
  if (lines.length < 2) return []

  // Collect all inter-word gaps across the whole document. The bimodal
  // distribution (small within-cell gaps, large between-column gaps) lets us
  // pick a sensible threshold for this particular image's scale.
  const allGaps: number[] = []
  for (const line of lines) {
    const sorted = [...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0)
    for (let k = 1; k < sorted.length; k++) {
      allGaps.push(sorted[k].bbox.x0 - sorted[k - 1].bbox.x1)
    }
  }
  allGaps.sort((a, b) => a - b)
  // The threshold is the midpoint of the gap distribution's upper half —
  // i.e. a gap that is bigger than most "normal" inter-word gaps.
  // If we have no gaps (single-word lines everywhere), bail.
  if (allGaps.length === 0) return []
  const p25 = allGaps[Math.floor(allGaps.length * 0.25)]
  const p75 = allGaps[Math.floor(allGaps.length * 0.75)]
  // If gaps are very uniform, there's no column structure to find.
  if (p75 - p25 < 3) return []
  const gapThreshold = Math.max(p75 * 1.5, p25 + 15)

  let i = 0
  while (i < lines.length) {
    const cols = clusterColumns(lines[i].words, gapThreshold)
    if (cols.length >= 2) {
      const colCount = cols.length
      const colXStarts = cols.map((c) => Math.min(...c.map((w) => w.bbox.x0)))
      const rows: string[][] = [cols.map((c) => c.map((w) => w.text).join(' ').trim())]
      let j = i + 1
      while (j < lines.length) {
        const nextCols = clusterColumns(lines[j].words, gapThreshold)
        if (
          nextCols.length === colCount &&
          columnsAlign(colXStarts, nextCols)
        ) {
          rows.push(nextCols.map((c) => c.map((w) => w.text).join(' ').trim()))
          j++
        } else {
          break
        }
      }
      if (rows.length >= 2) {
        tables.push({ headers: rows[0], rows: rows.slice(1) })
        i = j
        continue
      }
    }
    i++
  }
  return tables
}

/**
 * Group words into columns using the given gap threshold.
 */
function clusterColumns(words: OcrResult['words'], gapThreshold: number): OcrResult['words'][] {
  if (words.length === 0) return []
  const sorted = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0)
  const cols: OcrResult['words'][] = [[sorted[0]]]
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1]
    const cur = sorted[k]
    const gap = cur.bbox.x0 - prev.bbox.x1
    if (gap > gapThreshold) {
      cols.push([cur])
    } else {
      cols[cols.length - 1].push(cur)
    }
  }
  return cols
}

function columnsAlign(xStarts: number[], cols: OcrResult['words'][]): boolean {
  if (xStarts.length !== cols.length) return false
  const tolerance = 40
  for (let k = 0; k < xStarts.length; k++) {
    const colStart = Math.min(...cols[k].map((w) => w.bbox.x0))
    if (Math.abs(colStart - xStarts[k]) > tolerance) return false
  }
  return true
}

function splitColumns(line: string): string[] {
  return line
    .split(/\t|\s{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)
}

/**
 * Heuristic detection of geo-coordinates (lat, lng) in OCR text.
 * Looks for patterns like "40.7128, -74.0060" or "lat: 40.71, lng: -74.00".
 */
export type GeoFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { raw: string; index: number }
}

export function detectGeoPoints(result: OcrResult): GeoFeature[] {
  const text = result.text
  const features: GeoFeature[] = []
  const re = /(-?\d{1,3}\.\d{1,6})\s*,\s*(-?\d{1,3}\.\d{1,6})/g
  let m: RegExpExecArray | null
  let idx = 0
  while ((m = re.exec(text)) !== null) {
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { raw: m[0], index: idx++ },
      })
    }
  }
  return features
}

/**
 * Best-effort split of OCR text into paragraphs.
 * A blank line starts a new paragraph; very short lines (< 4 chars) are merged.
 */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}
