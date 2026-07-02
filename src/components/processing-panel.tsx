'use client'

import { useState } from 'react'
import { Play, Loader2, CheckCircle2, AlertCircle, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { runOcr, type OcrResult } from '@/lib/ocr'
import type { UploadedFile } from './ocr-uploader'
import type { OcrSettings } from './settings-panel'

export type ProcessedItem = {
  file: UploadedFile
  status: 'pending' | 'running' | 'done' | 'error'
  progress: number
  statusText: string
  result?: OcrResult
  error?: string
}

type Props = {
  items: ProcessedItem[]
  setItems: React.Dispatch<React.SetStateAction<ProcessedItem[]>>
  settings: OcrSettings
  onRunAll: () => void
  onRunOne: (id: string) => void
  onClear: () => void
  running: boolean
}

export function ProcessingPanel({
  items,
  setItems,
  onRunAll,
  onRunOne,
  onClear,
  running,
}: Props) {
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorCount = items.filter((i) => i.status === 'error').length

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Processing Queue</span>
            {items.length > 0 && (
              <>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length} total
                </Badge>
                {doneCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px]">{doneCount} done</Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {errorCount} failed
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={onRunAll}
              disabled={running || items.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md h-8"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              Run OCR{items.length > 1 ? ` on ${items.length} files` : ''}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear} disabled={running || items.length === 0} className="h-8 w-8 p-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No files queued yet. Upload scanned images above to begin.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.file.id}
                className="flex items-center gap-3 p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <img
                  src={item.file.preview}
                  alt={item.file.file.name}
                  className="w-10 h-10 rounded-md object-cover border border-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs truncate font-medium">{item.file.file.name}</p>
                    {item.status === 'done' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    )}
                  </div>
                  {item.status === 'running' ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={item.progress * 100} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {(item.progress * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : item.status === 'done' && item.result ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.result.words.length} words · {item.result.confidence.toFixed(1)}% conf ·{' '}
                      <span className="text-emerald-700 dark:text-emerald-400">{item.statusText}</span>
                    </p>
                  ) : item.status === 'error' ? (
                    <p className="text-[10px] text-red-600 mt-0.5 truncate">{item.error}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.statusText}</p>
                  )}
                </div>
                {item.status === 'done' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => onRunOne(item.file.id)}
                    disabled={running}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Helper hook for managing the processing queue.
 * Kept here for cohesion with the component.
 */
export function useProcessingQueue(settings: OcrSettings) {
  const [items, setItems] = useState<ProcessedItem[]>([])
  const [running, setRunning] = useState(false)

  const setFromFiles = (files: UploadedFile[]) => {
    setItems(
      files.map((f) => ({
        file: f,
        status: 'pending' as const,
        progress: 0,
        statusText: 'Queued',
      })),
    )
  }

  const runOne = async (id: string) => {
    setItems((prev) =>
      prev.map((p) => (p.file.id === id ? { ...p, status: 'running', progress: 0 } : p)),
    )
    const target = items.find((i) => i.file.id === id)
    if (!target) return
    try {
      const result = await runOcr(target.file.file, settings.language, (p) => {
        setItems((prev) =>
          prev.map((it) =>
            it.file.id === id
              ? { ...it, progress: p.progress, statusText: p.status }
              : it,
          ),
        )
      })
      setItems((prev) =>
        prev.map((it) =>
          it.file.id === id
            ? { ...it, status: 'done', progress: 1, statusText: 'Completed', result }
            : it,
        ),
      )
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.file.id === id
            ? {
                ...it,
                status: 'error',
                statusText: 'Failed',
                error: err instanceof Error ? err.message : String(err),
              }
            : it,
        ),
      )
    }
  }

  const runAll = async () => {
    setRunning(true)
    for (const item of items) {
      if (item.status === 'done') continue
       
      await runOne(item.file.id)
    }
    setRunning(false)
  }

  return { items, setItems, running, setFromFiles, runOne, runAll, setRunning }
}
