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
      const arr = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
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
          'relative rounded-xl border-2 border-dashed transition-all p-8 text-center cursor-pointer',
          dragOver
            ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01]'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-500',
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <UploadCloud className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Drop scanned images here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PNG, JPG, WebP, GIF, BMP · multiple files supported
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2">
            <Plus className="w-4 h-4 mr-1" />
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
              <Card key={f.id} className="relative overflow-hidden p-0 group">
                <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
                  { }
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
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="p-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileImage className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs truncate">{f.file.name}</p>
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
