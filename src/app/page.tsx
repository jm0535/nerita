'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ScanText,
  Github,
  Sparkles,
  ShieldCheck,
  Zap,
  FileStack,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { OcrUploader, type UploadedFile } from '@/components/ocr-uploader'
import { SettingsPanel, type OcrSettings } from '@/components/settings-panel'
import { ProcessingPanel, type ProcessedItem } from '@/components/processing-panel'
import { ExportPanel } from '@/components/export-panel'
import { ResultViewer } from '@/components/result-viewer'
import { runOcr } from '@/lib/ocr'

export default function Home() {
  const { theme, setTheme } = useTheme()

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [items, setItems] = useState<ProcessedItem[]>([])
  const [running, setRunning] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [settings, setSettings] = useState<OcrSettings>({
    language: 'eng',
    autoDetectTables: true,
    autoDetectGeo: true,
    preserveLayout: true,
  })

  const addFiles = useCallback((incoming: File[]) => {
    const newOnes: UploadedFile[] = incoming.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
    }))
    setFiles((prev) => {
      const next = [...prev, ...newOnes]
      // Initialize / extend the processing queue too.
      setItems((prevItems) => [
        ...prevItems,
        ...newOnes.map((f) => ({
          file: f,
          status: 'pending' as const,
          progress: 0,
          statusText: 'Queued',
        })),
      ])
      return next
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((f) => f.id !== id)
    })
    setItems((prev) => prev.filter((i) => i.file.id !== id))
    setActiveId((cur) => (cur === id ? null : cur))
  }, [])

  const clearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview))
    setFiles([])
    setItems([])
    setActiveId(null)
  }, [files])

  const runOne = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.file.id === id)
      if (!target) return
      setItems((prev) =>
        prev.map((p) => (p.file.id === id ? { ...p, status: 'running', progress: 0 } : p)),
      )
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
        setActiveId(id)
        toast.success(`OCR completed: ${target.file.file.name}`, {
          description: `${result.words.length} words · ${result.confidence.toFixed(1)}% confidence`,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setItems((prev) =>
          prev.map((it) =>
            it.file.id === id
              ? { ...it, status: 'error', statusText: 'Failed', error: message }
              : it,
          ),
        )
        toast.error(`OCR failed: ${target.file.file.name}`, { description: message })
      }
    },
    [items, settings.language],
  )

  const runAll = useCallback(async () => {
    setRunning(true)
    const pending = items.filter((i) => i.status !== 'done')
    if (pending.length === 0) {
      toast.info('All files already processed')
      setRunning(false)
      return
    }
    toast.info(`Starting OCR on ${pending.length} file${pending.length !== 1 ? 's' : ''}`)
    for (const item of pending) {
       
      await runOne(item.file.id)
    }
    setRunning(false)
    toast.success('Batch OCR complete')
  }, [items, runOne])

  const activeItem = useMemo(
    () => items.find((i) => i.file.id === activeId) ?? items.find((i) => i.status === 'done') ?? null,
    [items, activeId],
  )

  const doneCount = items.filter((i) => i.status === 'done').length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
              <ScanText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">OpenOCR</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Open-source document OCR & format export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              <Sun className="w-4 h-4 hidden dark:block" />
              <Moon className="w-4 h-4 block dark:hidden" />
              <span className="hidden sm:inline dark:hidden">Dark</span>
              <span className="hidden sm:inline dark:inline">Light</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              asChild
            >
              <a
                href="https://github.com/naptha/tesseract.js"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tesseract.js</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section className="border-b bg-gradient-to-b from-emerald-50/60 to-background dark:from-emerald-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mb-2">
                <Sparkles className="w-3 h-3" />
                100% client-side · No upload · No tracking
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Turn scanned documents into{' '}
                <span className="text-emerald-600 dark:text-emerald-400">9 structured formats</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Powered by Tesseract.js — runs entirely in your browser. Export to PDF, DOCX,
                Markdown, TXT, CSV, HTML, XLSX, XML & GeoJSON with automatic table & geo-coordinate
                detection.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <FeaturePill icon={<ShieldCheck className="w-4 h-4" />} label="Private" />
              <FeaturePill icon={<Zap className="w-4 h-4" />} label="Fast" />
              <FeaturePill icon={<FileStack className="w-4 h-4" />} label="Batch" />
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: upload + settings */}
          <div className="lg:col-span-4 space-y-5">
            <Card>
              <CardContent className="pt-5">
                <OcrUploader
                  files={files}
                  onAdd={addFiles}
                  onRemove={removeFile}
                  onClear={clearAll}
                />
              </CardContent>
            </Card>
            <SettingsPanel settings={settings} onChange={setSettings} disabled={running} />
          </div>

          {/* Middle column: queue + result */}
          <div className="lg:col-span-5 space-y-5">
            <ProcessingPanel
              items={items}
              setItems={setItems}
              settings={settings}
              onRunAll={runAll}
              onRunOne={runOne}
              onClear={clearAll}
              running={running}
            />
            <ResultViewer
              result={activeItem?.result ?? null}
              fileName={activeItem?.file.file.name ?? ''}
            />
          </div>

          {/* Right column: export + stats */}
          <div className="lg:col-span-3 space-y-5">
            <ExportPanel
              result={activeItem?.result ?? null}
              fileName={activeItem?.file.file.name ?? 'ocr-result'}
              disabled={running}
            />

            <Card>
              <CardContent className="pt-5 space-y-3">
                <h3 className="text-sm font-semibold">Session stats</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Files" value={items.length} />
                  <Stat label="Processed" value={doneCount} accent />
                  <Stat
                    label="Words"
                    value={items
                      .filter((i) => i.result)
                      .reduce((s, i) => s + (i.result?.words.length ?? 0), 0)}
                  />
                  <Stat
                    label="Avg conf"
                    value={
                      items.filter((i) => i.result).length
                        ? `${(
                            items
                              .filter((i) => i.result)
                              .reduce((s, i) => s + (i.result?.confidence ?? 0), 0) /
                            items.filter((i) => i.result).length
                          ).toFixed(1)}%`
                        : '—'
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-1.5">How it works</h3>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Upload one or more scanned images</li>
                  <li>Pick a recognition language</li>
                  <li>Click <strong>Run OCR</strong> — Tesseract runs locally</li>
                  <li>Preview text, tables & geo points</li>
                  <li>Export to any of 9 formats (or all at once)</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t bg-background py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Built with <span className="text-emerald-600 dark:text-emerald-400 font-medium">Tesseract.js</span>{' '}
            · Next.js · shadcn/ui — fully open-source
          </p>
          <p>Images never leave your browser</p>
        </div>
      </footer>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-background border">
      <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${
          accent ? 'text-emerald-600 dark:text-emerald-400' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}
