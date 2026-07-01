'use client'

import { useEffect, useState } from 'react'
import { History, Search, Trash2, RotateCcw, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  listHistory,
  deleteHistoryItem,
  clearHistory,
  searchHistory,
  formatRelativeTime,
  type HistoryItem,
} from '@/lib/history'

type Props = {
  onSelect: (item: HistoryItem) => void
  refreshKey?: number
}

export function HistoryPanel({ onSelect, refreshKey }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    listHistory().then(setItems)
  }, [refreshKey])

  const filtered = searchHistory(items, query)

  const handleDelete = async (id: string) => {
    await deleteHistoryItem(id)
    setItems(await listHistory())
  }

  const handleClear = async () => {
    await clearHistory()
    setItems([])
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="w-4 h-4 text-primary" />
            The Trail
            {items.length > 0 && (
              <Badge variant="secondary" className="text-[10px] font-medium">{items.length}</Badge>
            )}
          </CardTitle>
          {items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes all {items.length} items from your local trail. The original image files are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear}>Clear all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search trail..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No history yet. Processed documents will appear here — searchable, re-exportable, fully local.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No items match &ldquo;{query}&rdquo;
          </p>
        ) : (
          <ScrollArea className="h-[280px] -mx-1">
            <div className="space-y-1.5 px-1">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onSelect(item)}
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.fileName}
                      className="w-10 h-10 rounded-md object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                      <History className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate font-medium">{item.fileName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.documentType !== 'unknown' && (
                        <span className="text-primary capitalize">{item.documentType} · </span>
                      )}
                      {item.text.slice(0, 50).trim() || '(no text)'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {formatRelativeTime(item.createdAt)} · {item.engine === 'vision-ai' ? 'Vision AI' : 'Tesseract'} · {item.confidence.toFixed(0)}%
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(item.id)
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
