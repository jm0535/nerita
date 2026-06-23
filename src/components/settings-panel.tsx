'use client'

import { Settings2, Languages, Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SUPPORTED_LANGUAGES } from '@/lib/ocr'

export type OcrSettings = {
  language: string
  autoDetectTables: boolean
  autoDetectGeo: boolean
  preserveLayout: boolean
}

type Props = {
  settings: OcrSettings
  onChange: (s: OcrSettings) => void
  disabled?: boolean
}

export function SettingsPanel({ settings, onChange, disabled }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          OCR Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" />
            Recognition Language
          </Label>
          <Select
            value={settings.language}
            onValueChange={(v) => onChange({ ...settings, language: v })}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Tesseract will download the language data on first use (~5–15 MB).
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <ToggleRow
            icon={<Gauge className="w-3.5 h-3.5" />}
            label="Auto-detect tables"
            description="Detect tabular structures → CSV / XLSX / MD tables"
            checked={settings.autoDetectTables}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ ...settings, autoDetectTables: v })}
          />
          <ToggleRow
            icon={<Gauge className="w-3.5 h-3.5" />}
            label="Auto-detect geo coordinates"
            description="Find lat/lng pairs → GeoJSON"
            checked={settings.autoDetectGeo}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ ...settings, autoDetectGeo: v })}
          />
          <ToggleRow
            icon={<Gauge className="w-3.5 h-3.5" />}
            label="Preserve line layout"
            description="Keep original line breaks in text output"
            checked={settings.preserveLayout}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ ...settings, preserveLayout: v })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex-1 min-w-0">
        <Label className="text-xs flex items-center gap-1.5">{icon}{label}</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}
