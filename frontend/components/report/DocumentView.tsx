'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { Claim, VerdictLabel } from '@/lib/types'
import { verdictLabel } from '@/lib/verdicts'

export function DocumentView({ text, claims, selected, filters, onSelect }: { text: string; claims: Claim[]; selected: string; filters: VerdictLabel[]; onSelect: (id: string) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const containerRef = useRef<HTMLElement>(null)
  const spans = useMemo(() => { let end = -1; return [...claims].sort((a, b) => a.span.start - b.span.start).filter((claim) => claim.span.start >= end && claim.span.end > claim.span.start && (end = claim.span.end)) }, [claims])
  useEffect(() => {
    const container = containerRef.current
    const target = selected ? refs.current.get(selected) : undefined
    if (container && target) container.scrollTo({ top: Math.max(0, target.offsetTop - container.clientHeight / 3), behavior: 'smooth' })
  }, [selected])
  const parts: React.ReactNode[] = []
  let cursor = 0
  spans.forEach((claim) => {
    parts.push(<span key={`${claim.id}-before`}>{text.slice(cursor, claim.span.start)}</span>)
    const visible = !filters.length || filters.includes(claim.verdict)
    if (visible) {
      const meta = verdictLabel(claim.verdict)
      const Icon = meta.icon
      parts.push(<button key={claim.id} ref={(node) => { if (node) refs.current.set(claim.id, node); else refs.current.delete(claim.id) }} onClick={() => onSelect(claim.id)} aria-label={`${meta.label}: ${claim.text}`} title={`${meta.label}: ${claim.updated_value ?? claim.value}`} className={`rounded px-0.5 underline decoration-current/30 underline-offset-4 ${meta.className} ${claim.id === selected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-background' : ''}`}><span>{text.slice(claim.span.start, claim.span.end)}</span><Icon aria-hidden="true" className="ml-1 inline size-3.5 align-[-1px]" /></button>)
    } else parts.push(<span key={claim.id}>{text.slice(claim.span.start, claim.span.end)}</span>)
    cursor = claim.span.end
  })
  parts.push(<span key="end">{text.slice(cursor)}</span>)
  return <article ref={containerRef} className="mx-auto max-h-[72vh] max-w-[76ch] overflow-y-auto whitespace-pre-wrap pr-2 font-serif text-base leading-8 text-foreground sm:text-lg">{parts}</article>
}

export default DocumentView
