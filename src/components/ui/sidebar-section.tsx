import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A single grouped section within a unified sidebar panel — Airtable-style.
 * Airtable's side panels (left nav, filter/sort menus, record detail panel)
 * are one flat surface split into sections by hairline dividers and small
 * uppercase micro-labels, not a stack of separately-bordered cards. Use this
 * as a direct child of a `divide-y divide-border` container.
 */
function SidebarSection({
  className,
  title,
  icon,
  action,
  accent,
  ...props
}: React.ComponentProps<"div"> & {
  title?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  /** Optional tint color (e.g. "amber") applied as a subtle left accent + label color when a section is in an active/special state. */
  accent?: string
}) {
  return (
    <div
      data-slot="sidebar-section"
      className={cn(
        "px-4 py-4 space-y-3 first:pt-0 last:pb-0",
        accent && "border-l-2 -ml-px pl-[calc(1rem-2px)]",
        className,
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
      {...props}
    >
      {title && (
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={accent ? { color: accent } : undefined}
          >
            {icon}
            {title}
          </div>
          {action}
        </div>
      )}
      {props.children}
    </div>
  )
}

export { SidebarSection }
