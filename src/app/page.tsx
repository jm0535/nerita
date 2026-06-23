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
  Shell,
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
import { EngineSelector } from '@/components/engine-selector'
import { DocumentInfoPanel } from '@/components/document-info-panel'
import { HistoryPanel } from '@/components/history-panel'
import { runOcr, type OcrResult } from '@/lib/ocr'
import {
  analyzeImage,
  chooseEngine,
  runVisionOcr,
  type EngineId,
  type ImageAnalysis,
} from '@/lib/hybrid-engine'
import { saveToHistory, type HistoryItem } from '@/lib/history'

export default function Home() {
  const { theme, setTheme } = useTheme()

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [items, setItems] = useState<ProcessedItem[]>([])
  const [running, setRunning] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [settings, setSettings] = useState<OcrSettings>({
    language: 'eng',
    autoDetectTables: true,
    autoDetectGeo: true,
    preserveLayout: true,
  })
  const [enginePref, setEnginePref] = useState<EngineId>('auto')
  const [analyses, setAnalyses] = useState<Record<string, ImageAnalysis>>({})
  const [routingReasons, setRoutingReasons] = useState<Record<string, string>>({})

  const addFiles = useCallback((incoming: File[]) => {
    const newOnes: UploadedFile[] = incoming.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
    }))
    setFiles((prev) => {
      const next = [...prev, ...newOnes]
      setItems((prevItems) => [
        ...prevItems,
        ...newOnes.map((f) => ({
          file: f,
          status: 'pending' as const,
          progress: 0,
          statusText: 'Queued',
        })),
      ])
      // Analyze each new image in parallel (non-blocking)
      newOnes.forEach(async (uf) => {
        try {
          const a = await analyzeImage(uf.file)
          setAnalyses((prev) => ({ ...prev, [uf.id]: a }))
          const choice = chooseEngine(enginePref, a)
          setRoutingReasons((prev) => ({ ...prev, [uf.id]: choice.reason }))
        } catch (err) {
          console.error('analyze failed', err)
        }
      })
      return next
    })
  }, [enginePref])

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
    setAnalyses({})
    setRoutingReasons({})
  }, [files])

  const runOne = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.file.id === id)
      if (!target) return
      setItems((prev) =>
        prev.map((p) => (p.file.id === id ? { ...p, status: 'running', progress: 0 } : p)),
      )
      try {
        const analysis = analyses[id]
        const choice = chooseEngine(enginePref, analysis ?? {
          width: 0, height: 0, aspectRatio: 1, messiness: 0.5, script: 'unknown', sharpness: 0.5, contrast: 0.5,
        })
        let result: OcrResult
        if (choice.engine === 'vision-ai') {
          result = await runVisionOcr(target.file.file, settings.language, (p) => {
            setItems((prev) =>
              prev.map((it) =>
                it.file.id === id
                  ? { ...it, progress: p.progress, statusText: p.status }
                  : it,
              ),
            )
          })
        } else {
          result = await runOcr(target.file.file, settings.language, (p) => {
            setItems((prev) =>
              prev.map((it) =>
                it.file.id === id
                  ? { ...it, progress: p.progress, statusText: p.status }
                  : it,
              ),
            )
          })
        }
        setItems((prev) =>
          prev.map((it) =>
            it.file.id === id
              ? { ...it, status: 'done', progress: 1, statusText: 'Completed', result }
              : it,
          ),
        )
        setActiveId(id)
        // Save to local history trail
        const saved = await saveToHistory(target.file.file, result)
        if (saved) setHistoryRefreshKey((k) => k + 1)
        toast.success(`OCR completed: ${target.file.file.name}`, {
          description: `${result.words.length} words · ${result.confidence.toFixed(1)}% confidence · ${choice.engine === 'vision-ai' ? 'Vision AI' : 'Tesseract'}`,
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
    [items, settings.language, enginePref, analyses],
  )

  const runAll = useCallback(async () => {
    setRunning(true)
    const pending = items.filter((i) => i.status !== 'done')
    if (pending.length === 0) {
      toast.info('All files already processed')
      setRunning(false)
      return
    }
    toast.info(`Nerita is grazing on ${pending.length} file${pending.length !== 1 ? 's' : ''}`)
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

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    // Reconstruct a minimal OcrResult from the history item so the viewer + exporters work
    const result: OcrResult = {
      text: item.text,
      confidence: item.confidence,
      blocks: [],
      lines: [],
      words: [],
      language: item.language,
      engine: item.engine,
      documentType: item.documentType,
      fields: item.fields,
    }
    // Show as a synthetic "done" item
    const syntheticFile: UploadedFile = {
      id: item.id,
      file: new File([], item.fileName),
      preview: item.thumbnail,
    }
    setItems([
      {
        file: syntheticFile,
        status: 'done',
        progress: 1,
        statusText: 'From history',
        result,
      },
    ])
    setActiveId(item.id)
    toast.info(`Loaded from trail: ${item.fileName}`)
  }, [])

  const doneCount = items.filter((i) => i.status === 'done').length

  return (
    <div className="bg-background min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Shell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Nerita</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Clings to every pixel, grazes every word
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
      <section className="border-b bg-gradient-to-b from-teal-50/60 to-background dark:from-teal-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/40 px-2 py-0.5 rounded-full mb-2">
                <Sparkles className="w-3 h-3" />
                Hybrid engine · 100% private · Open-source
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                The mangrove snail of OCR —{' '}
                <span className="text-teal-600 dark:text-teal-400">methodical, resilient, thorough</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Nerita routes each image to the right engine (offline Tesseract.js or cloud Vision AI),
                detects document type & fields, builds a searchable PDF, and remembers everything in your local trail.
                Export to PDF, DOCX, Markdown, TXT, CSV, HTML, XLSX, XML, GeoJSON & JSON.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <FeaturePill icon={<ShieldCheck className="w-4 h-4" />} label="Private" />
              <FeaturePill icon={<Zap className="w-4 h-4" />} label="Hybrid" />
              <FeaturePill icon={<FileStack className="w-4 h-4" />} label="Batch" />
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: upload + engine + settings */}
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
            <EngineSelector
              enginePref={enginePref}
              onChange={setEnginePref}
              analysis={activeItem ? analyses[activeItem.file.id] : null}
              routingReason={activeItem ? routingReasons[activeItem.file.id] : undefined}
              disabled={running}
            />
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
            <DocumentInfoPanel result={activeItem?.result ?? null} />
            <ResultViewer
              result={activeItem?.result ?? null}
              fileName={activeItem?.file.file.name ?? ''}
            />
          </div>

          {/* Right column: export + history + stats */}
          <div className="lg:col-span-3 space-y-5">
            <ExportPanel
              result={activeItem?.result ?? null}
              fileName={activeItem?.file.file.name ?? 'nerita-result'}
              imageFile={activeItem?.file.file}
              disabled={running}
            />
            <HistoryPanel onSelect={handleHistorySelect} refreshKey={historyRefreshKey} />

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

            <Card className="bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900">
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-1.5">How Nerita grazes</h3>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Upload one or more scanned images</li>
                  <li>Pick an engine (or let Auto decide)</li>
                  <li>Click <strong>Run OCR</strong> — Nerita clings to each image</li>
                  <li>Preview text, fields, tables & geo points</li>
                  <li>Export to any of 11 formats (or all at once)</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t bg-background py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            <span className="text-teal-600 dark:text-teal-400 font-medium">Nerita</span> · Built with Tesseract.js + Vision AI · Next.js · shadcn/ui — fully open-source
          </p>
          <p>Images never leave your browser (offline mode) · Local trail stored in IndexedDB</p>
        </div>
      </footer>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-background border">
      <span className="text-teal-600 dark:text-teal-400">{icon}</span>
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
          accent ? 'text-teal-600 dark:text-teal-400' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}
