'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Github,
  Sparkles,
  ShieldCheck,
  Zap,
  FileStack,
  Moon,
  Sun,
  Shell,
  PanelLeft,
  PanelRight,
  ChevronLeft,
  ChevronRight,
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
import { DrawingModePanel } from '@/components/drawing-mode-panel'
import { runOcr, type OcrResult } from '@/lib/ocr'
import {
  analyzeImage,
  chooseEngine,
  runVisionOcr,
  type EngineId,
  type ImageAnalysis,
} from '@/lib/hybrid-engine'
import { saveToHistory, type HistoryItem } from '@/lib/history'
import { vectorizeImage, type VectorLayer } from '@/lib/vectorize'

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
  const [drawingMode, setDrawingMode] = useState(false)
  const [vectorLayer, setVectorLayer] = useState<VectorLayer | null>(null)
  const [vectorizing, setVectorizing] = useState(false)
  const [vectorStatus, setVectorStatus] = useState<string>('')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

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

  // Reset vector layer when active file changes
  useEffect(() => {
    setVectorLayer(null)
    setVectorStatus('')
  }, [activeId])

  const handleVectorize = useCallback(async () => {
    if (!activeItem) {
      toast.error('Select a file to vectorize first')
      return
    }
    setVectorizing(true)
    setVectorStatus('Loading OpenCV.js')
    try {
      const layer = await vectorizeImage(activeItem.file.file, {}, (p) => {
        setVectorStatus(p.status)
      })
      setVectorLayer(layer)
      toast.success(`Vectorized: ${layer.totalPrimitives} primitives`, {
        description: `${layer.lines.length} lines · ${layer.circles.length} circles · ${layer.polygons.length} polygons`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Vectorization failed', { description: msg })
    } finally {
      setVectorizing(false)
      setVectorStatus('')
    }
  }, [activeItem])

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
      {/* Header — flat Airtable-style top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLeftCollapsed((v) => !v)}
              aria-label="Toggle left sidebar"
              title={leftCollapsed ? 'Show left panel' : 'Hide left panel'}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Shell className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-sm font-semibold leading-none">Nerita</h1>
                <span className="text-[11px] text-muted-foreground leading-none hidden md:inline">
                  OCR · Vector · Document AI
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 font-medium"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              <Sun className="w-3.5 h-3.5 hidden dark:block" />
              <Moon className="w-3.5 h-3.5 block dark:hidden" />
              <span className="hidden sm:inline dark:hidden">Dark</span>
              <span className="hidden sm:inline dark:inline">Light</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 font-medium"
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRightCollapsed((v) => !v)}
              aria-label="Toggle right sidebar"
              title={rightCollapsed ? 'Show right panel' : 'Hide right panel'}
            >
              <PanelRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero strip — flat, no gradient */}
      <section className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded mb-3">
                <Sparkles className="w-3 h-3" />
                Hybrid engine · 100% private · Open-source
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                The mangrove snail of OCR
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Nerita routes each image to the right engine (offline Tesseract.js or cloud Vision AI),
                detects document type & fields, builds searchable PDFs, vectorizes drawings to DXF/SHP,
                and remembers everything in your local trail.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <FeaturePill icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Private" color="text-emerald-600" />
              <FeaturePill icon={<Zap className="w-3.5 h-3.5" />} label="Hybrid" color="text-amber-600" />
              <FeaturePill icon={<FileStack className="w-3.5 h-3.5" />} label="Batch" color="text-violet-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Main — 3-column flex with collapsible sidebars */}
      <main className="flex-1 w-full">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex gap-5 items-start">
          {/* Left sidebar (collapsible) */}
          <div className="relative shrink-0 hidden lg:block">
            <aside
              className={`${
                leftCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[340px] opacity-100'
              } transition-all duration-200`}
            >
              <div className="space-y-4 sticky top-[4.5rem] max-h-[calc(100vh-5rem)] overflow-y-auto pr-1 pb-4">
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
                <DrawingModePanel
                  enabled={drawingMode}
                  onChange={setDrawingMode}
                  onVectorize={handleVectorize}
                  vectorLayer={vectorLayer}
                  vectorizing={vectorizing}
                  vectorStatus={vectorStatus}
                  disabled={running || !activeItem}
                />
                <SettingsPanel settings={settings} onChange={setSettings} disabled={running} />
              </div>
            </aside>
            <div className="absolute inset-x-0 top-0 h-0 flex justify-end z-10">
              <button
                onClick={() => setLeftCollapsed((v) => !v)}
                className="sticky top-[5.75rem] -mr-3 flex items-center justify-center w-6 h-6 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-sm transition-colors"
                aria-label={leftCollapsed ? 'Show left panel' : 'Hide left panel'}
                title={leftCollapsed ? 'Show left panel' : 'Hide left panel'}
              >
                {leftCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Middle column — always visible */}
          <div className="flex-1 min-w-0 space-y-4">
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
              vectorLayer={drawingMode ? vectorLayer : null}
              imagePreview={activeItem?.file.preview}
            />
          </div>

          {/* Right sidebar (collapsible) */}
          <div className="relative shrink-0 hidden lg:block">
            <div className="absolute inset-x-0 top-0 h-0 flex justify-start z-10">
              <button
                onClick={() => setRightCollapsed((v) => !v)}
                className="sticky top-[5.75rem] -ml-3 flex items-center justify-center w-6 h-6 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-sm transition-colors"
                aria-label={rightCollapsed ? 'Show right panel' : 'Hide right panel'}
                title={rightCollapsed ? 'Show right panel' : 'Hide right panel'}
              >
                {rightCollapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
            <aside
              className={`${
                rightCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[300px] opacity-100'
              } transition-all duration-200`}
            >
            <div className="space-y-4 sticky top-[4.5rem] max-h-[calc(100vh-5rem)] overflow-y-auto pr-1 pb-4">
              <ExportPanel
                result={activeItem?.result ?? null}
                fileName={activeItem?.file.file.name ?? 'nerita-result'}
                imageFile={activeItem?.file.file}
                vectorLayer={drawingMode ? vectorLayer : null}
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

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-5">
                  <h3 className="text-sm font-semibold mb-2">How Nerita grazes</h3>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Upload one or more scanned images</li>
                    <li>Pick an engine (or let Auto decide)</li>
                    <li>Click <strong className="text-foreground">Run OCR</strong> — Nerita clings to each image</li>
                    <li>Preview text, fields, tables & vectors</li>
                    <li>Export to any of 14 formats (or all at once)</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
            </aside>
          </div>
        </div>

        {/* Mobile fallback: stacked layout (single column) */}
        <div className="lg:hidden max-w-[1600px] mx-auto px-4 sm:px-6 pb-6 space-y-4">
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
          <DrawingModePanel
            enabled={drawingMode}
            onChange={setDrawingMode}
            onVectorize={handleVectorize}
            vectorLayer={vectorLayer}
            vectorizing={vectorizing}
            vectorStatus={vectorStatus}
            disabled={running || !activeItem}
          />
          <SettingsPanel settings={settings} onChange={setSettings} disabled={running} />
          <ExportPanel
            result={activeItem?.result ?? null}
            fileName={activeItem?.file.file.name ?? 'nerita-result'}
            imageFile={activeItem?.file.file}
            vectorLayer={drawingMode ? vectorLayer : null}
            disabled={running}
          />
          <HistoryPanel onSelect={handleHistorySelect} refreshKey={historyRefreshKey} />
        </div>
      </main>

      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p>
            <span className="text-primary font-semibold">Nerita</span> · Tesseract.js + Vision AI + OpenCV.js · Next.js · shadcn/ui
          </p>
          <p>Images never leave your browser · Local trail in IndexedDB</p>
        </div>
      </footer>
    </div>
  )
}

function FeaturePill({ icon, label, color }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background border border-border">
      <span className={color ?? 'text-primary'}>{icon}</span>
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p
        className={`text-xl font-semibold mt-0.5 ${
          accent ? 'text-primary' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}
