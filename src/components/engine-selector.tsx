'use client'

import { Brain, Zap, Shuffle, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { EngineId, ImageAnalysis } from '@/lib/hybrid-engine'

type Props = {
  enginePref: EngineId
  onChange: (e: EngineId) => void
  analysis?: ImageAnalysis | null
  routingReason?: string
  disabled?: boolean
}

export function EngineSelector({ enginePref, onChange, analysis, routingReason, disabled }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="w-4 h-4 text-primary" />
          OCR Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Recognition engine</Label>
          <Select value={enginePref} onValueChange={(v) => onChange(v as EngineId)} disabled={disabled}>
            <SelectTrigger className="w-full h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <span className="flex items-center gap-2">
                  <Shuffle className="w-3.5 h-3.5 text-primary" />
                  Auto (smart router)
                </span>
              </SelectItem>
              <SelectItem value="tesseract">
                <span className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Tesseract.js (offline)
                </span>
              </SelectItem>
              <SelectItem value="vision-ai">
                <span className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-violet-500" />
                  Vision AI (cloud)
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {routingReason && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5">
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              {routingReason}
            </p>
          </div>
        )}

        {analysis && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <Stat label="Sharpness" value={`${(analysis.sharpness * 100).toFixed(0)}%`} />
            <Stat label="Contrast" value={`${(analysis.contrast * 100).toFixed(0)}%`} />
            <Stat label="Messiness" value={`${(analysis.messiness * 100).toFixed(0)}%`} />
            <Stat label="Size" value={`${analysis.width}×${analysis.height}`} />
          </div>
        )}

        <div className="flex items-start gap-1 pt-1">
          <Badge variant="outline" className="text-[9px] gap-1 font-medium">
            <Zap className="w-2.5 h-2.5" /> Fast
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1 font-medium">
            <Brain className="w-2.5 h-2.5" /> Accurate
          </Badge>
          <Badge variant="outline" className="text-[9px] font-medium">
            🔒 Private
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-1.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xs font-mono font-semibold mt-0.5">{value}</p>
    </div>
  )
}
