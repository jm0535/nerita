'use client'

import { PencilRuler, Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { VectorLayer } from '@/lib/vectorize'

type Props = {
  enabled: boolean
  onChange: (v: boolean) => void
  onVectorize: () => void
  vectorLayer: VectorLayer | null
  vectorizing: boolean
  vectorStatus?: string
  disabled?: boolean
}

export function DrawingModePanel({
  enabled,
  onChange,
  onVectorize,
  vectorLayer,
  vectorizing,
  vectorStatus,
  disabled,
}: Props) {
  return (
    <Card className={enabled ? 'border-amber-400 dark:border-amber-600' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <PencilRuler className={`w-4 h-4 ${enabled ? 'text-amber-600' : 'text-muted-foreground'}`} />
            Drawing Mode
          </CardTitle>
          <Switch
            checked={enabled}
            onCheckedChange={onChange}
            disabled={disabled}
            aria-label="Toggle drawing mode"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {enabled
            ? 'Nerita will vectorize line drawings, plans, and schematics into editable geometry — lines, circles, polygons. Export to SVG, DXF (AutoCAD), or SHP (GIS).'
            : 'Enable to extract vector geometry from drawings, sketches, and architectural plans. Best for clean line art — pencil sketches may be noisier.'}
        </p>

        {enabled && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onVectorize}
              disabled={disabled || vectorizing}
              className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 rounded-md h-8"
            >
              {vectorizing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              )}
              {vectorizing ? (vectorStatus ?? 'Vectorizing…') : 'Vectorize drawing'}
            </Button>

            {vectorLayer && (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <Stat label="Lines" value={vectorLayer.lines.length} />
                <Stat label="Circles" value={vectorLayer.circles.length} />
                <Stat label="Polys" value={vectorLayer.polygons.length} />
              </div>
            )}

            {vectorLayer && vectorLayer.totalPrimitives > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <Badge variant="secondary" className="text-[9px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium">
                  {vectorLayer.totalPrimitives} primitives
                </Badge>
                <Badge variant="outline" className="text-[9px] font-medium">
                  {vectorLayer.width}×{vectorLayer.height}px
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-1.5 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-0.5">{value}</p>
    </div>
  )
}
