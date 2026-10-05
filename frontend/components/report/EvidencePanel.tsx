'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import type { Claim } from '@/lib/types'
import { verdictLabel } from '@/lib/verdicts'
import { VerdictBadge } from './VerdictBadge'
import { TierBadge } from './TierBadge'
import { EngineBadge } from './EngineBadge'

const formatDate = (date: string | null) => {
  if (!date) return 'Date unavailable'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(parsed)
}
export function EvidencePanel({ claim }: { claim?: Claim }) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(false), [claim?.id])
  if (!claim) return <div className="rounded-lg border border-border p-6 text-muted-foreground">Select a claim to inspect evidence.</div>
  const evidence = [...claim.evidence].sort((a, b) => a.tier - b.tier || String(b.date).localeCompare(String(a.date)))
  const visibleEvidence = expanded ? evidence : evidence.slice(0, 4)
  const meta = verdictLabel(claim.verdict)
  return <aside className="overflow-hidden rounded-lg border border-border bg-card"><div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><VerdictBadge verdict={claim.verdict} /><span className="text-xs capitalize text-muted-foreground">{claim.confidence} confidence</span></div><h2 className="mt-4 text-lg font-semibold leading-6">{claim.text}</h2>{claim.updated_value && <div className="mt-4 border-l-2 border-foreground/25 bg-muted/50 px-3 py-2.5 text-sm"><span className="text-muted-foreground">Previously </span><s>{claim.value}</s><span className="mx-2 text-muted-foreground">Now</span><strong>{claim.updated_value}</strong>{claim.changed_around && <span className="mt-1 block text-xs text-muted-foreground">Changed around {claim.changed_around}</span>}</div>}<p className="mt-4 text-sm leading-6 text-muted-foreground">{claim.reasoning}</p></div><div className="border-t border-border"><div className="flex items-center justify-between px-5 py-3 sm:px-6"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Supporting sources</h3><span className="text-xs tabular-nums text-muted-foreground">{evidence.length}</span></div><div className="divide-y divide-border border-t border-border">{visibleEvidence.map((item, index) => <article key={item.url + index} className="px-5 py-4 sm:px-6"><div className="flex items-start justify-between gap-3"><a href={item.url} target="_blank" rel="noreferrer" className="group text-sm font-semibold leading-5 hover:underline">{item.title}<ArrowUpRight className="ml-1 inline size-3.5 opacity-50 group-hover:opacity-100" /></a><TierBadge tier={item.tier} /></div><div className="mt-2 flex flex-wrap items-center gap-2"><EngineBadge engine={item.engine} /><span className="text-xs text-muted-foreground">{item.domain} · {formatDate(item.date)}</span></div><p className="mt-2 line-clamp-3 text-sm leading-5 text-muted-foreground">{item.snippet}</p></article>)}</div>{evidence.length > 4 && <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm font-semibold hover:bg-muted/50">{expanded ? <><ChevronUp className="size-4" />Show fewer sources</> : <><ChevronDown className="size-4" />Show all {evidence.length} sources</>}</button>}</div><span className="sr-only">{meta.label}</span></aside>
}
export default EvidencePanel
