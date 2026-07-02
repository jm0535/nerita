'use client'

import { Download, Loader2, FileDown, Layers } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SidebarSection } from '@/components/ui/sidebar-section'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(EXPORT_FORMATS[0].id)

  const selected = useMemo(
    () => EXPORT_FORMATS.find((f) => f.id === selectedFormat) ?? EXPORT_FORMATS[0],
    [selectedFormat],
  )
  const selectedIsDrawing = DRAWING_FORMATS.includes(selectedFormat)
  const selectedDisabled = selectedIsDrawing && !vectorLayer

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
    <SidebarSection
      title="Export"
      icon={<FileDown className="w-3.5 h-3.5" />}
      action={
        result && (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {EXPORT_FORMATS.length} formats
          </Badge>
        )
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Select
            value={selectedFormat}
            onValueChange={(v) => setSelectedFormat(v as ExportFormat)}
            disabled={disabled || !result}
          >
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue placeholder="Choose a format" />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_FORMATS.map((f) => {
                const isDrawing = DRAWING_FORMATS.includes(f.id)
                return (
                  <SelectItem key={f.id} value={f.id} disabled={isDrawing && !vectorLayer}>
                    <span className="text-[10px] font-semibold uppercase tracking-wide w-10 shrink-0">
                      {f.ext}
                    </span>
                    <span className="text-xs">{f.label}</span>
                    {isDrawing && vectorLayer && (
                      <span className="ml-auto text-[8px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1 rounded font-medium">
                        VEC
                      </span>
                    )}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-snug min-h-[1.5em]">
            {selectedIsDrawing && !vectorLayer
              ? 'Enable Drawing Mode + vectorize first'
              : selected.description}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-md"
          disabled={disabled || !result || busy !== null || selectedDisabled}
          onClick={() => handleExport(selectedFormat)}
        >
          {busy === selectedFormat ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Download {selected.ext.toUpperCase()}
        </Button>

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
      </div>
    </SidebarSection>
  )
}
