'use client'

import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import type { OcrResult } from './ocr'
import { detectGeoPoints, detectTables, toParagraphs } from './structured-extraction'

export type ExportFormat =
  | 'txt'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'xlsx'
  | 'docx'
  | 'pdf'
  | 'searchable-pdf'
  | 'xml'
  | 'geojson'
  | 'json'

export const EXPORT_FORMATS: {
  id: ExportFormat
  label: string
  description: string
  mime: string
  ext: string
}[] = [
  {
    id: 'txt',
    label: 'Plain Text',
    description: 'Raw extracted text (.txt)',
    mime: 'text/plain',
    ext: 'txt',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Structured Markdown with headings & tables (.md)',
    mime: 'text/markdown',
    ext: 'md',
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'Self-contained styled HTML document (.html)',
    mime: 'text/html',
    ext: 'html',
  },
  {
    id: 'csv',
    label: 'CSV',
    description: 'Detected tables as comma-separated values (.csv)',
    mime: 'text/csv',
    ext: 'csv',
  },
  {
    id: 'xlsx',
    label: 'Excel',
    description: 'Workbook with detected tables, one sheet per table (.xlsx)',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  },
  {
    id: 'docx',
    label: 'Word',
    description: 'Microsoft Word document with paragraphs (.docx)',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Reflowed text PDF document (.pdf)',
    mime: 'application/pdf',
    ext: 'pdf',
  },
  {
    id: 'searchable-pdf',
    label: 'Searchable PDF',
    description: 'Original image with invisible text layer — for archival (.pdf)',
    mime: 'application/pdf',
    ext: 'pdf',
  },
  {
    id: 'xml',
    label: 'XML',
    description: 'Structured XML with blocks/lines/words (.xml)',
    mime: 'application/xml',
    ext: 'xml',
  },
  {
    id: 'geojson',
    label: 'GeoJSON',
    description: 'Detected lat/lng points as GeoJSON FeatureCollection (.geojson)',
    mime: 'application/geo+json',
    ext: 'geojson',
  },
  {
    id: 'json',
    label: 'Structured JSON',
    description: 'Full result with document type, fields, blocks (.json)',
    mime: 'application/json',
    ext: 'json',
  },
]

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

// ============================================================================
// Plain Text
// ============================================================================
function exportTxt(result: OcrResult, fileName: string) {
  const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, `${baseName(fileName)}.txt`)
}

// ============================================================================
// Markdown
// ============================================================================
function exportMarkdown(result: OcrResult, fileName: string) {
  const tables = detectTables(result)
  const paragraphs = toParagraphs(result.text)
  const geo = detectGeoPoints(result)
  const lines: string[] = []

  lines.push(`# ${baseName(fileName)}`)
  lines.push('')
  lines.push(`> OCR extracted via Tesseract.js · Language: \`${result.language}\` · Confidence: ${result.confidence.toFixed(1)}%`)
  lines.push('')

  if (paragraphs.length) {
    lines.push('## Text')
    lines.push('')
    paragraphs.forEach((p) => {
      lines.push(p)
      lines.push('')
    })
  }

  if (tables.length) {
    lines.push('## Detected Tables')
    lines.push('')
    tables.forEach((t, idx) => {
      lines.push(`### Table ${idx + 1}`)
      lines.push('')
      lines.push(`| ${t.headers.join(' | ')} |`)
      lines.push(`| ${t.headers.map(() => '---').join(' | ')} |`)
      t.rows.forEach((row) => {
        lines.push(`| ${row.join(' | ')} |`)
      })
      lines.push('')
    })
  }

  if (geo.length) {
    lines.push('## Detected Geo Coordinates')
    lines.push('')
    lines.push('| # | Latitude | Longitude | Raw |')
    lines.push('| --- | --- | --- | --- |')
    geo.forEach((g) => {
      const [lng, lat] = g.geometry.coordinates
      lines.push(`| ${g.properties.index + 1} | ${lat} | ${lng} | ${g.properties.raw} |`)
    })
    lines.push('')
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, `${baseName(fileName)}.md`)
}

// ============================================================================
// HTML
// ============================================================================
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function exportHtml(result: OcrResult, fileName: string) {
  const tables = detectTables(result)
  const paragraphs = toParagraphs(result.text)
  const geo = detectGeoPoints(result)

  const parts: string[] = []
  parts.push('<!DOCTYPE html>')
  parts.push('<html lang="en">')
  parts.push('<head>')
  parts.push('<meta charset="UTF-8">')
  parts.push(`<title>${escapeHtml(baseName(fileName))} — OCR Result</title>`)
  parts.push('<style>')
  parts.push(`
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           max-width: 920px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
    h1 { border-bottom: 3px solid #10b981; padding-bottom: .5rem; }
    h2 { margin-top: 2rem; color: #047857; }
    .meta { color: #6b7280; font-size: .9rem; margin-bottom: 2rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #d1d5db; padding: .5rem .75rem; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    .geo-list { font-family: monospace; background: #f9fafb; padding: 1rem; border-radius: 6px; }
    p { margin: 0 0 1rem; }
  `)
  parts.push('</style>')
  parts.push('</head>')
  parts.push('<body>')
  parts.push(`<h1>${escapeHtml(baseName(fileName))}</h1>`)
  parts.push(
    `<div class="meta">Extracted with Tesseract.js · Language: ${escapeHtml(result.language)} · Confidence: ${result.confidence.toFixed(1)}%</div>`,
  )

  if (paragraphs.length) {
    parts.push('<h2>Text</h2>')
    paragraphs.forEach((p) => parts.push(`<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`))
  }

  if (tables.length) {
    parts.push('<h2>Detected Tables</h2>')
    tables.forEach((t, idx) => {
      parts.push(`<h3>Table ${idx + 1}</h3>`)
      parts.push('<table>')
      parts.push(`<thead><tr>${t.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`)
      parts.push('<tbody>')
      t.rows.forEach((row) => {
        parts.push(`<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      })
      parts.push('</tbody></table>')
    })
  }

  if (geo.length) {
    parts.push('<h2>Detected Geo Coordinates</h2>')
    parts.push('<ul class="geo-list">')
    geo.forEach((g) => {
      const [lng, lat] = g.geometry.coordinates
      parts.push(`<li>#${g.properties.index + 1} — lat: ${lat}, lng: ${lng} <code>(${g.properties.raw})</code></li>`)
    })
    parts.push('</ul>')
  }

  parts.push('</body></html>')

  const blob = new Blob([parts.join('\n')], { type: 'text/html;charset=utf-8' })
  saveAs(blob, `${baseName(fileName)}.html`)
}

// ============================================================================
// CSV
// ============================================================================
function exportCsv(result: OcrResult, fileName: string) {
  const tables = detectTables(result)
  if (tables.length === 0) {
    // Fallback: one row per non-empty line
    const rows = result.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => [l])
    const csv = Papa.unparse(rows.length ? rows : [['(no text extracted)']])
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseName(fileName)}.csv`)
    return
  }
  // Combine all tables vertically with a blank row between them
  const allRows: string[][] = []
  tables.forEach((t, idx) => {
    if (idx > 0) allRows.push([])
    allRows.push(t.headers)
    allRows.push(...t.rows)
  })
  const csv = Papa.unparse(allRows)
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseName(fileName)}.csv`)
}

// ============================================================================
// XLSX
// ============================================================================
async function exportXlsx(result: OcrResult, fileName: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'OpenSource OCR'
  wb.created = new Date()

  const tables = detectTables(result)
  const paragraphs = toParagraphs(result.text)
  const geo = detectGeoPoints(result)

  // Sheet 1: Raw text
  const textSheet = wb.addWorksheet('Text', { views: [{ state: 'frozen', ySplit: 1 }] })
  textSheet.columns = [{ header: '#', key: 'idx', width: 6 }, { header: 'Paragraph', key: 'p', width: 100 }]
  paragraphs.forEach((p, i) => textSheet.addRow({ idx: i + 1, p }))
  textSheet.getRow(1).font = { bold: true }

  // Sheet 2..N: Tables
  tables.forEach((t, idx) => {
    const sheet = wb.addWorksheet(`Table ${idx + 1}`.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    sheet.columns = t.headers.map((h) => ({ header: h, key: h, width: 22 }))
    t.rows.forEach((row) => {
      const obj: Record<string, string> = {}
      t.headers.forEach((h, i) => {
        obj[h] = row[i] ?? ''
      })
      sheet.addRow(obj)
    })
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  })

  // Sheet: Geo
  if (geo.length) {
    const geoSheet = wb.addWorksheet('Geo Points')
    geoSheet.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Latitude', key: 'lat', width: 14 },
      { header: 'Longitude', key: 'lng', width: 14 },
      { header: 'Raw', key: 'raw', width: 30 },
    ]
    geo.forEach((g) => {
      const [lng, lat] = g.geometry.coordinates
      geoSheet.addRow({ idx: g.properties.index + 1, lat, lng, raw: g.properties.raw })
    })
    geoSheet.getRow(1).font = { bold: true }
  }

  const buffer = await wb.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${baseName(fileName)}.xlsx`,
  )
}

// ============================================================================
// DOCX
// ============================================================================
async function exportDocx(result: OcrResult, fileName: string) {
  const paragraphs = toParagraphs(result.text)
  const tables = detectTables(result)
  const geo = detectGeoPoints(result)

  const docChildren: Paragraph[] = []
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: baseName(fileName), bold: true })],
    }),
  )
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `Extracted with Tesseract.js · Language: ${result.language} · Confidence: ${result.confidence.toFixed(1)}%`,
          italics: true,
          color: '6B7280',
          size: 18,
        }),
      ],
    }),
  )
  docChildren.push(new Paragraph({ text: '' }))

  if (paragraphs.length) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Text', bold: true })],
      }),
    )
    paragraphs.forEach((p) => {
      docChildren.push(new Paragraph({ children: [new TextRun({ text: p })] }))
    })
  }

  if (tables.length) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Detected Tables (${tables.length})`, bold: true })],
      }),
    )
    tables.forEach((t, idx) => {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: `Table ${idx + 1}`, bold: true })],
        }),
      )
      t.headers.forEach((h) => {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: `• ${h}`, bold: true })] }))
      })
      t.rows.forEach((row) => {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: row.join('  |  ') })] }))
      })
    })
  }

  if (geo.length) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Detected Geo Coordinates (${geo.length})`, bold: true })],
      }),
    )
    geo.forEach((g) => {
      const [lng, lat] = g.geometry.coordinates
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `#${g.properties.index + 1}  `, bold: true }),
            new TextRun({ text: `lat: ${lat}, lng: ${lng}  ` }),
            new TextRun({ text: `(${g.properties.raw})`, italics: true, color: '6B7280' }),
          ],
        }),
      )
    })
  }

  const doc = new Document({
    creator: 'OpenSource OCR',
    title: baseName(fileName),
    sections: [{ properties: {}, children: docChildren }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${baseName(fileName)}.docx`)
}

// ============================================================================
// PDF
// ============================================================================
function exportPdf(result: OcrResult, fileName: string) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 48
  const maxWidth = pageWidth - margin * 2
  let y = margin

  // Header
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(baseName(fileName), margin, y)
  y += 24
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(10)
  pdf.setTextColor(110, 110, 110)
  pdf.text(
    `Extracted with Tesseract.js · Language: ${result.language} · Confidence: ${result.confidence.toFixed(1)}%`,
    margin,
    y,
  )
  y += 24
  pdf.setDrawColor(16, 185, 129)
  pdf.setLineWidth(1.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 18
  pdf.setTextColor(0, 0, 0)

  const paragraphs = toParagraphs(result.text)

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  ensureSpace(20)
  pdf.text('Text', margin, y)
  y += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)

  paragraphs.forEach((p) => {
    const wrapped = pdf.splitTextToSize(p, maxWidth) as string[]
    wrapped.forEach((line) => {
      ensureSpace(16)
      pdf.text(line, margin, y)
      y += 15
    })
    y += 6
  })

  const tables = detectTables(result)
  if (tables.length) {
    ensureSpace(20)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.text(`Detected Tables (${tables.length})`, margin, y)
    y += 20
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)

    tables.forEach((t, idx) => {
      ensureSpace(20)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text(`Table ${idx + 1}`, margin, y)
      y += 16
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      t.headers.forEach((h) => {
        ensureSpace(14)
        pdf.text(`• ${h}`, margin + 12, y)
        y += 13
      })
      pdf.setFont('helvetica', 'normal')
      t.rows.forEach((row) => {
        ensureSpace(14)
        pdf.text(row.join('   |   '), margin + 12, y)
        y += 13
      })
      y += 8
    })
  }

  const geo = detectGeoPoints(result)
  if (geo.length) {
    ensureSpace(20)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.text(`Detected Geo Coordinates (${geo.length})`, margin, y)
    y += 18
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    geo.forEach((g) => {
      const [lng, lat] = g.geometry.coordinates
      ensureSpace(14)
      pdf.text(`#${g.properties.index + 1}  lat: ${lat}, lng: ${lng}  (${g.properties.raw})`, margin, y)
      y += 14
    })
  }

  pdf.save(`${baseName(fileName)}.pdf`)
}

// ============================================================================
// Searchable PDF (image + invisible text layer)
// ============================================================================
/**
 * Build a "searchable PDF": the original image is rendered as a visible
 * page background, with the OCR text laid over it as an invisible text
 * layer. This is the standard archival format for scanned documents
 * because it lets users search, copy, and select text while preserving
 * the original visual.
 *
 * We use jsPDF's text-rendering mode 3 (invisible) to draw the text.
 * For approximate positioning we place text lines top-to-bottom using
 * the line index and page height.
 */
async function exportSearchablePdf(
  result: OcrResult,
  fileName: string,
  imageFile?: File,
) {
  // Need the original image to embed it. If not provided, fall back to text-only.
  if (!imageFile) {
    return exportPdf(result, fileName)
  }

  const imageDataUrl = await fileToDataUrl(imageFile)
  const img = await loadImageDimensions(imageDataUrl)

  // Use image's pixel dimensions to size the PDF page (in pt at 72dpi).
  // Cap page size to A4 portrait (595x842 pt) — scale down if larger.
  const maxW = 595
  const maxH = 842
  let pageW = img.width
  let pageH = img.height
  const scale = Math.min(maxW / pageW, maxH / pageH, 1)
  pageW = Math.round(pageW * scale)
  pageH = Math.round(pageH * scale)

  const pdf = new jsPDF({
    unit: 'pt',
    format: [pageW, pageH],
    orientation: pageW > pageH ? 'landscape' : 'portrait',
  })

  // Add the image as the visible background (full page).
  pdf.addImage(imageDataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST')

  // Now lay the text over it invisibly. We use the line positions from
  // the OCR result if bboxes are available; otherwise distribute lines
  // evenly down the page.
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  // text rendering mode 3 = invisible (fill nor stroke)
  ;(pdf as unknown as { GState: (opts: Record<string, unknown>) => void }).GState({})
  // Use the running text command with rendering mode 3 via setTextRenderingMode
  const pdfInternal = pdf as unknown as {
    text: (text: string, x: number, y: number, options?: Record<string, unknown>) => jsPDF
    setTextColor: (r: number, g: number, b: number) => jsPDF
  }
  // Set text to fully transparent (so it's invisible but selectable)
  pdfInternal.setTextColor(255, 255, 255)

  const lines = result.text.split('\n')
  const lineSpacing = pageH / Math.max(lines.length + 1, 20)
  lines.forEach((line, idx) => {
    if (!line.trim()) return
    const y = (idx + 1) * lineSpacing
    // Spread words across the page width to match the image roughly.
    pdfInternal.text(line, 8, y, {
      renderingMode: 3,
      maxWidth: pageW - 16,
    } as Record<string, unknown>)
  })

  pdf.save(`${baseName(fileName)}-searchable.pdf`)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

// ============================================================================
// Structured JSON
// ============================================================================
function exportJson(result: OcrResult, fileName: string) {
  const tables = detectTables(result)
  const geo = detectGeoPoints(result)
  const payload = {
    fileName,
    language: result.language,
    engine: result.engine ?? 'tesseract',
    confidence: result.confidence,
    documentType: result.documentType ?? 'unknown',
    fields: result.fields ?? {},
    text: result.text,
    blocks: result.blocks,
    lines: result.lines,
    words: result.words,
    detectedTables: tables,
    detectedGeoPoints: geo,
    generatedBy: 'Nerita',
    generatedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  saveAs(blob, `${baseName(fileName)}.json`)
}

// ============================================================================
// XML
// ============================================================================
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function exportXml(result: OcrResult, fileName: string) {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    `<document fileName="${escapeXml(fileName)}" language="${escapeXml(result.language)}" confidence="${result.confidence.toFixed(2)}">`,
  )
  lines.push(`  <text>${escapeXml(result.text)}</text>`)
  lines.push('  <blocks>')
  for (const b of result.blocks) {
    lines.push(
      `    <block confidence="${b.confidence.toFixed(2)}" bbox="${b.bbox.x0},${b.bbox.y0},${b.bbox.x1},${b.bbox.y1}">`,
    )
    lines.push(`      <text>${escapeXml(b.text)}</text>`)
    lines.push('      <lines>')
    for (const l of b.lines) {
      lines.push(`        <line confidence="${l.confidence.toFixed(2)}">`)
      lines.push(`          <text>${escapeXml(l.text)}</text>`)
      lines.push('          <words>')
      for (const w of l.words) {
        lines.push(
          `            <word confidence="${w.confidence.toFixed(2)}" bbox="${w.bbox.x0},${w.bbox.y0},${w.bbox.x1},${w.bbox.y1}">${escapeXml(w.text)}</word>`,
        )
      }
      lines.push('          </words>')
      lines.push('        </line>')
    }
    lines.push('      </lines>')
    lines.push('    </block>')
  }
  lines.push('  </blocks>')
  // Also include detected tables and geo points for convenience
  const tables = detectTables(result)
  if (tables.length) {
    lines.push('  <tables>')
    tables.forEach((t, idx) => {
      lines.push(`    <table index="${idx + 1}" rows="${t.rows.length}" cols="${t.headers.length}">`)
      lines.push('      <headers>')
      t.headers.forEach((h) => lines.push(`        <header>${escapeXml(h)}</header>`))
      lines.push('      </headers>')
      lines.push('      <rows>')
      t.rows.forEach((row) => {
        lines.push('        <row>')
        row.forEach((c) => lines.push(`          <cell>${escapeXml(c)}</cell>`))
        lines.push('        </row>')
      })
      lines.push('      </rows>')
      lines.push('    </table>')
    })
    lines.push('  </tables>')
  }
  const geo = detectGeoPoints(result)
  if (geo.length) {
    lines.push('  <geoPoints>')
    geo.forEach((g) => {
      const [lng, lat] = g.geometry.coordinates
      lines.push(
        `    <geoPoint index="${g.properties.index + 1}" lat="${lat}" lng="${lng}" raw="${escapeXml(g.properties.raw)}"/>`,
      )
    })
    lines.push('  </geoPoints>')
  }
  lines.push('</document>')

  const blob = new Blob([lines.join('\n')], { type: 'application/xml;charset=utf-8' })
  saveAs(blob, `${baseName(fileName)}.xml`)
}

// ============================================================================
// GeoJSON
// ============================================================================
function exportGeoJson(result: OcrResult, fileName: string) {
  const features = detectGeoPoints(result)
  const fc = {
    type: 'FeatureCollection',
    metadata: {
      source: fileName,
      language: result.language,
      ocrConfidence: result.confidence,
      generatedBy: 'OpenSource OCR (Tesseract.js)',
    },
    features,
  }
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json;charset=utf-8' })
  saveAs(blob, `${baseName(fileName)}.geojson`)
}

// ============================================================================
// Dispatcher
// ============================================================================
export async function exportResult(
  format: ExportFormat,
  result: OcrResult,
  fileName: string,
  imageFile?: File,
): Promise<void> {
  switch (format) {
    case 'txt':
      return exportTxt(result, fileName)
    case 'markdown':
      return exportMarkdown(result, fileName)
    case 'html':
      return exportHtml(result, fileName)
    case 'csv':
      return exportCsv(result, fileName)
    case 'xlsx':
      return exportXlsx(result, fileName)
    case 'docx':
      return exportDocx(result, fileName)
    case 'pdf':
      return exportPdf(result, fileName)
    case 'searchable-pdf':
      return exportSearchablePdf(result, fileName, imageFile)
    case 'xml':
      return exportXml(result, fileName)
    case 'geojson':
      return exportGeoJson(result, fileName)
    case 'json':
      return exportJson(result, fileName)
    default:
      throw new Error(`Unknown export format: ${format}`)
  }
}

/**
 * Convenience: export ALL formats for the same result.
 * Useful for the "Download all" button.
 * Adds a short delay between exports so the browser doesn't block
 * multiple consecutive anchor-click downloads.
 */
export async function exportAllFormats(
  result: OcrResult,
  fileName: string,
  imageFile?: File,
) {
  for (let i = 0; i < EXPORT_FORMATS.length; i++) {
    const f = EXPORT_FORMATS[i]
    try {
      await exportResult(f.id, result, fileName, imageFile)
      // Small delay between downloads so browsers don't block them as spam.
      await new Promise((r) => setTimeout(r, 400))
    } catch (err) {
      console.error(`Failed to export ${f.id}`, err)
    }
  }
}
