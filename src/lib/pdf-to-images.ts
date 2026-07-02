'use client'

/**
 * Renders each page of a PDF file to a PNG image File, so PDFs can flow
 * through the exact same OCR pipeline as scanned images (Tesseract / Vision
 * AI both operate on raster images — neither reads PDF text/structure).
 *
 * Runs entirely client-side via pdfjs-dist; the PDF bytes never leave the
 * browser (consistent with Nerita's "private, in-browser" design).
 */

export type PdfConversionProgress = {
  page: number
  totalPages: number
}

const RENDER_SCALE = 2 // upscale for sharper OCR input than a 1:1 render

async function getPdfjs() {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  return pdfjsLib
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/**
 * Converts a single PDF File into one PNG File per page.
 * Throws if the file isn't a readable PDF (caller should catch per-file so
 * one bad PDF doesn't block the rest of a batch upload).
 */
export async function pdfToImageFiles(
  file: File,
  onProgress?: (p: PdfConversionProgress) => void,
): Promise<File[]> {
  const pdfjsLib = await getPdfjs()
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: buffer })
  const doc = await loadingTask.promise

  const name = baseName(file.name)
  const pages: File[] = []

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      onProgress?.({ page: pageNum, totalPages: doc.numPages })

      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: RENDER_SCALE })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context to render PDF page')

      await page.render({ canvasContext: ctx, viewport, canvas }).promise

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error(`Failed to rasterize page ${pageNum} of ${file.name}`)

      const pageLabel = doc.numPages > 1 ? `${name} (page ${pageNum} of ${doc.numPages}).png` : `${name}.png`
      pages.push(new File([blob], pageLabel, { type: 'image/png' }))

      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return pages
}

/**
 * Expands a mixed batch of Files: PDFs become one image File per page,
 * everything else passes through unchanged. Per-file failures are reported
 * via onError but don't abort the rest of the batch.
 */
export async function expandPdfsToImages(
  files: File[],
  onError?: (file: File, error: unknown) => void,
  onProgress?: (file: File, p: PdfConversionProgress) => void,
): Promise<File[]> {
  const out: File[] = []
  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      out.push(file)
      continue
    }
    try {
      const pages = await pdfToImageFiles(file, (p) => onProgress?.(file, p))
      out.push(...pages)
    } catch (err) {
      onError?.(file, err)
    }
  }
  return out
}
