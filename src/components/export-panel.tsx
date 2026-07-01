'use client'

import { Download, Loader2, FileDown, Layers } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EXPORT_FORMATS, exportAllFormats, exportResult, type ExportFormat } from '@/lib/exporters'
import type { OcrResult } from '@/lib/ocr'
import type { VectorLayer } from '@/lib/vectorize'

type Props = {
  result: OcrResult | null
  fileName: string
  imageFile?: File
  vectorLayer?: VectorLayer | null
  disabled?: boolean
}

const DRAWING_FORMATS: ExportFormat[] = ['svg', 'dxf', 'shp']

export function ExportPanel({ result, fileName, imageFile, vectorLayer, disabled }: Props) {
  const [busy, setBusy] = useState<ExportFormat | 'all' | null>(null)

  const handleExport = async (format: ExportFormat) => {
    if (!result) return
    setBusy(format)
    try {
      await exportResult(format, result, fileName, imageFile, vectorLayer)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(null)
    }
  }

  const handleAll = async () => {
    if (!result) return
    setBusy('all')
    try {
      await exportAllFormats(result, fileName, imageFile, vectorLayer)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileDown className="w-4 h-4 text-primary" />
            Export
          </CardTitle>
          {result && (
            <Badge variant="secondary" className="text-[10px] font-medium">
              {EXPORT_FORMATS.length} formats
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {EXPORT_FORMATS.map((f) => {
            const isBusy = busy === f.id
            const isDrawing = DRAWING_FORMATS.includes(f.id)
            const drawingDisabled = isDrawing && !vectorLayer
            return (
              <TooltipProvider key={f.id} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled || !result || busy !== null || drawingDisabled}
                      onClick={() => handleExport(f.id)}
                      className={`h-auto py-1.5 px-2 flex flex-col items-start gap-0.5 justify-start text-left rounded-md ${
                        isDrawing && vectorLayer ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1.5 w-full">
                        {isBusy ? (
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        ) : (
                          <Download className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{f.ext}</span>
                        {isDrawing && vectorLayer && (
                          <span className="ml-auto text-[8px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1 rounded font-medium">VEC</span>
                        )}
                      </span>
                      <span className="text-[9px] text-muted-foreground leading-tight line-clamp-2">
                        {f.label}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]">
                    <p className="font-semibold text-xs">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                    {isDrawing && !vectorLayer && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                        Enable Drawing Mode + vectorize first
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>

        <Button
          variant="default"
          size="sm"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
          disabled={disabled || !result || busy !== null}
          onClick={handleAll}
        >
          {busy === 'all' ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Layers className="w-3.5 h-3.5 mr-1.5" />
          )}
          Download all {EXPORT_FORMATS.length} formats
        </Button>
      </CardContent>
    </Card>
  )
}
