'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileImage, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export type UploadedFile = {
  id: string
  file: File
  preview: string
}

type Props = {
  files: UploadedFile[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function OcrUploader({ files, onAdd, onRemove, onClear }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const arr = Array.from(fileList).filter(
        (f) =>
          f.type.startsWith('image/') ||
          f.type === 'application/pdf' ||
          f.name.toLowerCase().endsWith('.pdf'),
      )
      if (arr.length) onAdd(arr)
    },
    [onAdd],
  )

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'relative rounded-md border-2 border-dashed transition-colors p-8 text-center cursor-pointer',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-accent/50',
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <UploadCloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Drop scanned images or PDFs here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WebP, GIF, BMP, PDF · multiple files supported
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-1 h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Select Images
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {files.length} file{files.length !== 1 && 's'} queued
            </p>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="w-4 h-4 mr-1" />
              Clear all
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map((f) => (
              <Card key={f.id} className="relative overflow-hidden p-0 group border-border">
                <div className="aspect-square bg-muted">
                  <img
                    src={f.preview}
                    alt={f.file.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(f.id)
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="p-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileImage className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <p className="text-xs truncate font-medium">{f.file.name}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {(f.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
