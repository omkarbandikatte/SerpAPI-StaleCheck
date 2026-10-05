'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, ListChecks, X } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { getReport } from '@/lib/api'
import type { Report, VerdictLabel } from '@/lib/types'
import { verdictOrder, verdicts } from '@/lib/verdicts'
import { DocumentView } from '@/components/report/DocumentView'
import { ClaimList } from '@/components/report/ClaimList'
import { EvidencePanel } from '@/components/report/EvidencePanel'
import { FreshnessScore } from '@/components/report/FreshnessScore'
import { ExportDialog } from '@/components/report/ExportDialog'

const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report>()
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [filters, setFilters] = useState<VerdictLabel[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [view, setView] = useState<'claims' | 'document'>('claims')

  useEffect(() => {
    getReport(id).then((next) => { setReport(next); setSelected(next.claims[0]?.id || '') }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load report'))
  }, [id])

  useEffect(() => {
    if (!report) return
    const visible = report.claims.filter((claim) => !filters.length || filters.includes(claim.verdict))
    if (!visible.some((claim) => claim.id === selected)) setSelected(visible[0]?.id || '')
  }, [report, filters, selected])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?') { event.preventDefault(); setShortcuts((value) => !value) }
      else if (event.key === 'Escape') { setShortcuts(false); setExportOpen(false); setDrawerOpen(false) }
      else if (report && (event.key === 'j' || event.key === 'k')) {
        const visible = report.claims.filter((claim) => !filters.length || filters.includes(claim.verdict))
        const index = visible.findIndex((claim) => claim.id === selected)
        setSelected(visible[(index + (event.key === 'j' ? 1 : -1) + visible.length) % visible.length]?.id || '')
      } else if (report && ['1', '2', '3', '4'].includes(event.key)) {
        const verdict = verdictOrder[Number(event.key) - 1]
        setFilters((value) => value.includes(verdict) ? value.filter((item) => item !== verdict) : [...value, verdict])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [report, selected, filters])

  const claim = useMemo(() => report?.claims.find((item) => item.id === selected), [report, selected])
  const choose = (claimId: string) => { setSelected(claimId); if (view === 'claims' && window.innerWidth < 1024) setDrawerOpen(true) }
  const toggle = (verdict: VerdictLabel) => setFilters((value) => value.includes(verdict) ? value.filter((item) => item !== verdict) : [...value, verdict])

  if (error) return <><Header /><main className="mx-auto max-w-5xl p-8 text-red-600">{error}</main></>
  if (!report) return <><Header /><main className="mx-auto max-w-5xl p-8"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></main></>
  if (!report.claims.length) return <><Header /><main className="mx-auto max-w-5xl p-8"><h1 className="text-3xl font-semibold">No checkable facts found</h1></main></>

  return <>
    <Header />
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <Link href="/app" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to workspace</Link>
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidence report</p><h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{report.doc_title}</h1><p className="mt-2 text-sm text-muted-foreground">Written {formatDate(report.doc_as_of)} <span className="mx-1.5">·</span> Checked {formatDate(report.checked_at)} <span className="mx-1.5">·</span> {report.claims.length} claims reviewed</p></div>
        <div className="flex items-center justify-between gap-5 sm:justify-end"><FreshnessScore score={report.freshness_score} /><button type="button" onClick={() => setExportOpen(true)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Export report</button></div>
      </div>

      <section aria-label="Verdict summary" className="mt-5 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
        {verdictOrder.map((verdict) => { const meta = verdicts[verdict]; const Icon = meta.icon; const active = filters.includes(verdict); const count = report.counts[verdict]; return <button type="button" key={verdict} onClick={() => toggle(verdict)} aria-pressed={active} disabled={count === 0} className={`flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent ${active ? 'bg-muted ring-2 ring-inset ring-foreground/20' : ''}`}><span className="flex items-center gap-2 text-sm font-medium"><Icon className={`size-4 ${meta.className.split(' ')[0]}`} />{meta.label}</span><strong className="text-xl tabular-nums">{count}</strong></button> })}
      </section>

      <div className="mt-6 flex items-center justify-between gap-4 border-b border-border">
        <div className="flex" role="tablist" aria-label="Report view">
          <button type="button" role="tab" aria-selected={view === 'claims'} onClick={() => setView('claims')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${view === 'claims' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><ListChecks className="size-4" />Claims &amp; evidence</button>
          <button type="button" role="tab" aria-selected={view === 'document'} onClick={() => { setView('document'); setDrawerOpen(false) }} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${view === 'document' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><FileText className="size-4" />Source document</button>
        </div>
        {filters.length > 0 && <button type="button" onClick={() => setFilters([])} className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">Clear filters</button>}
      </div>

      {view === 'claims' ? <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <ClaimList claims={report.claims} selected={selected} onSelect={choose} filters={filters} />
        <div className="hidden lg:block"><EvidencePanel claim={claim} /></div>
      </div> : <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="rounded-lg border border-border bg-card p-5 sm:p-7"><DocumentView text={report.document_text} claims={report.claims} selected={selected} filters={filters} onSelect={choose} /></div>
        <div className="hidden xl:block"><EvidencePanel claim={claim} /></div>
      </div>}

      {view === 'claims' && drawerOpen && <><button type="button" aria-label="Close evidence backdrop" onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-20 bg-black/25 lg:hidden" /><aside className="fixed inset-x-0 bottom-0 z-30 max-h-[82vh] overflow-auto rounded-t-xl bg-background p-4 shadow-2xl lg:hidden"><div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" /><button aria-label="Close evidence panel" onClick={() => setDrawerOpen(false)} className="absolute right-4 top-4 rounded-md p-1 hover:bg-muted"><X /></button><EvidencePanel claim={claim} /></aside></>}
      <footer className="mt-10 border-t border-border pt-4 text-sm text-muted-foreground">{report.searches_used} live searches via SerpApi</footer>
    </main>
    {shortcuts && <div className="fixed right-5 top-16 z-30 rounded-xl border border-border bg-card p-3 text-xs shadow-lg">j/k move, 1–4 filter, Esc close</div>}
    {exportOpen && <ExportDialog open={exportOpen} report={report} onClose={() => setExportOpen(false)} />}
  </>
}
