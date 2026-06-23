'use client'

import type { OcrResult, DocumentType } from './ocr'

/**
 * Local-first OCR history stored in IndexedDB.
 * Every processed document is persisted with its thumbnail, text, and
 * structured fields — searchable & re-exportable, no account needed.
 */

const DB_NAME = 'nerita'
const DB_VERSION = 1
const STORE = 'history'

export type HistoryItem = {
  id: string
  fileName: string
  fileSize: number
  thumbnail: string // data URL (small jpeg)
  createdAt: number
  language: string
  engine: 'tesseract' | 'vision-ai'
  confidence: number
  documentType: DocumentType
  fields: Record<string, string>
  text: string
  // We don't persist the full blocks/lines/words tree to keep storage small.
  // Re-export of structured formats still works because we re-derive tables/geo
  // from text. Full JSON export will contain the persisted subset.
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('documentType', 'documentType')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/**
 * Generate a small JPEG thumbnail (max 200px) data URL from an image File.
 * Used for the history list preview.
 */
export async function makeThumbnail(file: File, maxSize = 200): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = (e) => reject(e)
      i.src = url
    })
    const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.7)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function saveToHistory(
  file: File,
  result: OcrResult,
): Promise<HistoryItem | null> {
  try {
    const thumbnail = await makeThumbnail(file)
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fileName: file.name,
      fileSize: file.size,
      thumbnail,
      createdAt: Date.now(),
      language: result.language,
      engine: result.engine ?? 'tesseract',
      confidence: result.confidence,
      documentType: result.documentType ?? 'unknown',
      fields: result.fields ?? {},
      text: result.text,
    }
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return item
  } catch (err) {
    console.error('[nerita] failed to save history item:', err)
    return null
  }
}

export async function listHistory(): Promise<HistoryItem[]> {
  try {
    const db = await openDb()
    return await new Promise<HistoryItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => {
        const items = (req.result as HistoryItem[]).sort((a, b) => b.createdAt - a.createdAt)
        resolve(items)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('[nerita] failed to list history:', err)
    return []
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('[nerita] failed to delete history item:', err)
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('[nerita] failed to clear history:', err)
  }
}

/**
 * Search history items by query (matches filename, text, fields, documentType).
 */
export function searchHistory(items: HistoryItem[], query: string): HistoryItem[] {
  if (!query.trim()) return items
  const q = query.toLowerCase()
  return items.filter((it) => {
    if (it.fileName.toLowerCase().includes(q)) return true
    if (it.text.toLowerCase().includes(q)) return true
    if (it.documentType.toLowerCase().includes(q)) return true
    for (const [k, v] of Object.entries(it.fields)) {
      if (k.toLowerCase().includes(q) || v.toLowerCase().includes(q)) return true
    }
    return false
  })
}

/**
 * Format helper for display.
 */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const date = new Date(ts)
  return date.toLocaleDateString()
}
