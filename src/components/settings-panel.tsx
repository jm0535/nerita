'use client'

import { Settings2, Languages, Table2, MapPin, AlignLeft } from 'lucide-react'
import { SidebarSection } from '@/components/ui/sidebar-section'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <SidebarSection title="OCR Settings" icon={<Settings2 className="w-3.5 h-3.5" />}>
      <div className="space-y-3">
        <SelectRow
          icon={<Languages className="w-3.5 h-3.5" />}
          label="Recognition Language"
          value={settings.language}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, language: v })}
          options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          help="Tesseract downloads language data on first use (~5–15 MB)."
        />
        <SelectRow
          icon={<Table2 className="w-3.5 h-3.5" />}
          label="Table Detection"
          value={settings.autoDetectTables ? 'on' : 'off'}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, autoDetectTables: v === 'on' })}
          options={[
            { value: 'on', label: 'Auto-detect (CSV / XLSX / MD)' },
            { value: 'off', label: 'Off — text only' },
          ]}
          help="Find tabular structures from word positions."
        />
        <SelectRow
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="Geo Coordinate Detection"
          value={settings.autoDetectGeo ? 'on' : 'off'}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, autoDetectGeo: v === 'on' })}
          options={[
            { value: 'on', label: 'Auto-detect (GeoJSON)' },
            { value: 'off', label: 'Off' },
          ]}
          help="Find lat/lng pairs like '40.7128, -74.0060'."
        />
        <SelectRow
          icon={<AlignLeft className="w-3.5 h-3.5" />}
          label="Line Layout"
          value={settings.preserveLayout ? 'preserve' : 'reflow'}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, preserveLayout: v === 'preserve' })}
          options={[
            { value: 'preserve', label: 'Preserve original line breaks' },
            { value: 'reflow', label: 'Reflow into paragraphs' },
          ]}
          help="Controls how text output preserves line structure."
        />
      </div>
    </SidebarSection>
  )
}

function SelectRow({
  icon,
  label,
  value,
  options,
  onChange,
  disabled,
  help,
}: {
  icon: React.ReactNode
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  disabled?: boolean
  help?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5 font-medium">
        {icon}
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  )
}
