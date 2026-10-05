'use client'

import { MouseEvent, ReactNode } from 'react'

export function SpotlightPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  function trackPointer(event: MouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`)
    event.currentTarget.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`)
  }

  return <section className={`spotlight-panel ${className}`} onMouseMove={trackPointer}>{children}</section>
}