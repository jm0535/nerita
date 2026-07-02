import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

// Subscribes to matchMedia via useSyncExternalStore instead of
// effect+setState — the correct primitive for syncing with an external
// browser API, avoids an extra render on mount, and is SSR-safe.
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
