'use client'

import { Download, Loader2, FileDown, Layers } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EXPORT_FORMATS, exportAllFormats, exportResult, type ExportFormat } from '@/lib/exporters'
import type { OcrResult } from '@/lib/ocr'

type Props = {
  result: OcrResult | null
  fileName: string
  disabled?: boolean
}

export function ExportPanel({ result, fileName, disabled }: Props) {
  const [busy, setBusy] = useState<ExportFormat | 'all' | null>(null)

  const handleExport = async (format: ExportFormat) => {
    if (!result) return
    setBusy(format)
    try {
      await exportResult(format, result, fileName)
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
      await exportAllFormats(result, fileName)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Export
          </CardTitle>
          {result && (
            <Badge variant="secondary" className="text-[10px]">
              {EXPORT_FORMATS.length} formats
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EXPORT_FORMATS.map((f) => {
            const isBusy = busy === f.id
            return (
              <TooltipProvider key={f.id} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled || !result || busy !== null}
                      onClick={() => handleExport(f.id)}
                      className="h-auto py-2 px-2 flex flex-col items-start gap-0.5 justify-start text-left"
                    >
                      <span className="flex items-center gap-1.5 w-full">
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span className="text-xs font-semibold uppercase">{f.ext}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                        {f.label}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    <p className="font-semibold">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>

        <Button
          variant="default"
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={disabled || !result || busy !== null}
          onClick={handleAll}
        >
          {busy === 'all' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Layers className="w-4 h-4 mr-2" />
          )}
          Download all 9 formats
        </Button>
      </CardContent>
    </Card>
  )
}
