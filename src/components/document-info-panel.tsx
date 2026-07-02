'use client'

import { FileText, Receipt, FileSpreadsheet, IdCard, FileEdit, Table2, PenLine, BookOpen, Monitor, Layers, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DocumentType, OcrResult } from '@/lib/ocr'

const DOC_TYPE_META: Record<DocumentType, { label: string; icon: React.ReactNode; color: string }> = {
  receipt: { label: 'Receipt', icon: <Receipt className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  invoice: { label: 'Invoice', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, color: 'text-blue-600' },
  'id-card': { label: 'ID Card', icon: <IdCard className="w-3.5 h-3.5" />, color: 'text-violet-600' },
  form: { label: 'Form', icon: <FileEdit className="w-3.5 h-3.5" />, color: 'text-rose-600' },
  table: { label: 'Table', icon: <Table2 className="w-3.5 h-3.5" />, color: 'text-teal-600' },
  handwritten: { label: 'Handwritten', icon: <PenLine className="w-3.5 h-3.5" />, color: 'text-orange-600' },
  'book-page': { label: 'Book Page', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  screenshot: { label: 'Screenshot', icon: <Monitor className="w-3.5 h-3.5" />, color: 'text-slate-600' },
  mixed: { label: 'Mixed', icon: <Layers className="w-3.5 h-3.5" />, color: 'text-purple-600' },
  other: { label: 'Document', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-gray-600' },
  unknown: { label: 'Analyzing...', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-muted-foreground' },
}

type Props = {
  result: OcrResult | null
}

export function DocumentInfoPanel({ result }: Props) {
  if (!result || (result.documentType === 'unknown' && !result.fields)) {
    return null
  }

  const docType = result.documentType ?? 'unknown'
  const meta = DOC_TYPE_META[docType] ?? DOC_TYPE_META.other
  const fields = result.fields ?? {}
  const fieldEntries = Object.entries(fields).filter(([, v]) => v && String(v).trim())

  if (docType === 'unknown' && fieldEntries.length === 0) return null

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader className="pb-4 border-b border-primary/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Tag className={`w-4 h-4 ${meta.color}`} />
            Document Intelligence
          </CardTitle>
          {docType !== 'unknown' && (
            <Badge variant="outline" className={`text-[10px] gap-1 ${meta.color} font-medium`}>
              {meta.icon}
              {meta.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {fieldEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No structured fields detected. Switch to the Vision AI engine for field extraction.
          </p>
        ) : (
          <dl className="space-y-1.5">
            {fieldEntries.map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <dt className="font-medium text-muted-foreground min-w-[100px] shrink-0 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}:
                </dt>
                <dd className="font-mono text-foreground break-all flex-1">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {result.engine && (
          <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
            Extracted by <span className="font-medium">{result.engine === 'vision-ai' ? 'Vision AI' : 'Tesseract.js'}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
