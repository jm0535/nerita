'use client'

import { useMemo } from 'react'
import { FileText, Table2, MapPin, Code2, Eye, Tag, Spline } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OcrResult } from '@/lib/ocr'
import { detectGeoPoints, detectTables, toParagraphs } from '@/lib/structured-extraction'
import { vectorLayerToSvg, type VectorLayer } from '@/lib/vectorize'

type Props = {
  result: OcrResult | null
  fileName: string
  vectorLayer?: VectorLayer | null
  imagePreview?: string
}

export function ResultViewer({ result, fileName, vectorLayer, imagePreview }: Props) {
  const tables = useMemo(() => (result ? detectTables(result) : []), [result])
  const geo = useMemo(() => (result ? detectGeoPoints(result) : []), [result])
  const paragraphs = useMemo(() => (result ? toParagraphs(result.text) : []), [result])
  const fields = result?.fields ?? {}
  const fieldCount = Object.entries(fields).filter(([, v]) => v && String(v).trim()).length
  const svgString = useMemo(
    () => (vectorLayer ? vectorLayerToSvg(vectorLayer) : ''),
    [vectorLayer],
  )
  const xmlPreview = useMemo(() => {
    if (!result) return ''
    const doc = {
      document: {
        '@fileName': fileName,
        '@language': result.language,
        '@confidence': result.confidence.toFixed(2),
        '@engine': result.engine ?? 'tesseract',
        '@documentType': result.documentType ?? 'unknown',
        text: result.text,
        blockCount: result.blocks.length,
        lineCount: result.lines.length,
        wordCount: result.words.length,
        fields: result.fields ?? {},
        vectorPrimitives: vectorLayer?.totalPrimitives ?? 0,
      },
    }
    return JSON.stringify(doc, null, 2)
  }, [result, fileName, vectorLayer])

  if (!result) {
    return (
      <Card className="h-full min-h-[400px]">
        <CardContent className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
          <Eye className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">No OCR result yet</p>
          <p className="text-sm mt-1">Upload an image and run OCR to see the extracted content here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base truncate">{fileName}</CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            {result.engine && (
              <Badge
                variant="outline"
                className={`text-[10px] gap-1 ${
                  result.engine === 'vision-ai'
                    ? 'border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-400'
                    : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
                }`}
              >
                {result.engine === 'vision-ai' ? '🧠 Vision AI' : '⚡ Tesseract'}
              </Badge>
            )}
            {result.documentType && result.documentType !== 'unknown' && (
              <Badge variant="outline" className="text-[10px] capitalize border-teal-300 text-teal-700 dark:border-teal-800 dark:text-teal-400">
                {result.documentType}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {result.language.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {result.confidence.toFixed(1)}% conf
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {result.words.length} words
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-auto">
            <TabsTrigger value="text" className="gap-1">
              <FileText className="w-3.5 h-3.5" />
              Text
            </TabsTrigger>
            <TabsTrigger value="fields" className="gap-1">
              <Tag className="w-3.5 h-3.5" />
              Fields
              {fieldCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
                  {fieldCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-1">
              <Table2 className="w-3.5 h-3.5" />
              Tables
              {tables.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
                  {tables.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="geo" className="gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Geo
              {geo.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
                  {geo.length}
                </Badge>
              )}
            </TabsTrigger>
            {vectorLayer && (
              <TabsTrigger value="vectors" className="gap-1">
                <Spline className="w-3.5 h-3.5 text-amber-600" />
                Vectors
                <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                  {vectorLayer.totalPrimitives}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="structure" className="gap-1">
              <Code2 className="w-3.5 h-3.5" />
              Structure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-3">
            <ScrollArea className="h-[460px] w-full rounded-md border bg-zinc-50 dark:bg-zinc-950 p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {result.text || '(no text extracted)'}
              </pre>
            </ScrollArea>
            <p className="text-[11px] text-muted-foreground mt-2">
              {paragraphs.length} paragraph{paragraphs.length !== 1 && 's'} detected
            </p>
          </TabsContent>

          <TabsContent value="fields" className="mt-3">
            {fieldCount === 0 ? (
              <EmptyState
                icon={<Tag className="w-8 h-8" />}
                title="No structured fields detected"
                hint="Use the Vision AI engine to extract structured key-value fields (merchant, date, total, etc.) from receipts, invoices, ID cards, and forms."
              />
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold w-1/3">Field</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(fields)
                      .filter(([, v]) => v && String(v).trim())
                      .map(([key, value]) => (
                        <tr key={key} className="border-t">
                          <td className="px-3 py-1.5 font-medium text-muted-foreground capitalize align-top">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                          </td>
                          <td className="px-3 py-1.5 font-mono break-all">{String(value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tables" className="mt-3">
            {tables.length === 0 ? (
              <EmptyState
                icon={<Table2 className="w-8 h-8" />}
                title="No tables detected"
                hint="Tables are detected when consecutive rows share column boundaries. Use Vision AI for complex tables."
              />
            ) : (
              <div className="space-y-4">
                {tables.map((t, idx) => (
                  <div key={idx} className="rounded-md border overflow-hidden">
                    <div className="bg-teal-600/10 px-3 py-1.5 text-xs font-medium">
                      Table {idx + 1} · {t.rows.length} rows × {t.headers.length} cols
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-100 dark:bg-zinc-900">
                          <tr>
                            {t.headers.map((h, i) => (
                              <th key={i} className="px-2 py-1.5 text-left font-semibold border-b">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((row, ri) => (
                            <tr key={ri} className="border-b last:border-0">
                              {row.map((c, ci) => (
                                <td key={ci} className="px-2 py-1.5 border-r last:border-0">
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="geo" className="mt-3">
            {geo.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-8 h-8" />}
                title="No geo coordinates found"
                hint="Latitude/longitude pairs like '40.7128, -74.0060' will be detected automatically."
              />
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-900">
                    <tr>
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">Latitude</th>
                      <th className="px-2 py-1.5 text-left">Longitude</th>
                      <th className="px-2 py-1.5 text-left">Raw text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geo.map((g) => {
                      const [lng, lat] = g.geometry.coordinates
                      return (
                        <tr key={g.properties.index} className="border-t">
                          <td className="px-2 py-1.5">{g.properties.index + 1}</td>
                          <td className="px-2 py-1.5 font-mono">{lat}</td>
                          <td className="px-2 py-1.5 font-mono">{lng}</td>
                          <td className="px-2 py-1.5 font-mono text-muted-foreground">
                            {g.properties.raw}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="vectors" className="mt-3">
            {vectorLayer && vectorLayer.totalPrimitives > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <VectorStat label="Lines" value={vectorLayer.lines.length} color="text-amber-600" />
                  <VectorStat label="Circles" value={vectorLayer.circles.length} color="text-amber-600" />
                  <VectorStat label="Polygons" value={vectorLayer.polygons.length} color="text-amber-600" />
                </div>
                <div className="rounded-md border bg-amber-50/30 dark:bg-amber-950/10 p-3">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Vectorized preview — original image overlaid with detected geometry
                  </p>
                  <div
                    className="relative w-full bg-white rounded border overflow-hidden"
                    style={{ aspectRatio: `${vectorLayer.width} / ${vectorLayer.height}` }}
                  >
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="original"
                        className="absolute inset-0 w-full h-full object-contain opacity-40"
                      />
                    )}
                    <div
                      className="absolute inset-0 w-full h-full"
                      dangerouslySetInnerHTML={{
                        __html: svgString
                          .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;" ')
                          .replace(/stroke="black"/g, 'stroke="#d97706"')
                          .replace(/stroke-width="2"/g, 'stroke-width="1.5"'),
                      }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Export to <strong>SVG</strong> for web, <strong>DXF</strong> for AutoCAD/LibreCAD/QCAD/FreeCAD,
                  or <strong>SHP</strong> for QGIS/ArcGIS.
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<Spline className="w-8 h-8" />}
                title="No vectors yet"
                hint="Enable Drawing Mode and click 'Vectorize drawing' to extract line geometry from this image."
              />
            )}
          </TabsContent>

          <TabsContent value="structure" className="mt-3">
            <ScrollArea className="h-[460px] w-full rounded-md border bg-zinc-950 p-4">
              <pre className="text-xs text-teal-300 font-mono whitespace-pre-wrap">
                {xmlPreview}
              </pre>
            </ScrollArea>
            <p className="text-[11px] text-muted-foreground mt-2">
              Showing structure summary · export as JSON or XML to get full blocks/lines/words tree.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="rounded-md border border-dashed py-12 px-6 text-center">
      <div className="flex justify-center text-muted-foreground mb-2">{icon}</div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{hint}</p>
    </div>
  )
}

function VectorStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
