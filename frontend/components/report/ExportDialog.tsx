'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Report } from '@/lib/types'
type Kind = 'notes' | 'changelog' | 'flashcards'
const safe = (name: string) => name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
export function ExportDialog({ open, onClose, report }: { open: boolean; onClose: () => void; report: Report }) {
  const [kind, setKind] = useState<Kind>('notes')
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [onClose])
  const content = useMemo(() => {
    const outdated = report.claims.filter((claim) => claim.verdict === 'outdated' && claim.updated_value).sort((a, b) => b.span.start - a.span.start)
    let corrected = report.document_text
    for (const claim of outdated) corrected = corrected.slice(0, claim.span.start) + corrected.slice(claim.span.start, claim.span.end).replace(claim.value, claim.updated_value!) + corrected.slice(claim.span.end)
    const relevant = report.claims.filter((claim) => claim.verdict === 'outdated' || claim.verdict === 'contradicted')
    const changelog = relevant.map((claim) => `- **${claim.verdict}**: ${claim.value} → ${claim.updated_value ?? 'No confirmed replacement'}; changed around ${claim.changed_around ?? 'unknown'}; ${claim.evidence[0]?.url ?? 'No source'}`).join('\n')
    const csv = ['front,back,changed around,source', ...outdated.map((claim) => [claim.text, claim.updated_value, claim.changed_around, claim.evidence[0]?.url].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
    return { notes: corrected, changelog: `# Changelog\n\n${changelog}`, flashcards: csv }
  }, [report])
  if (!open) return null
  const download = () => { const blob = new Blob([content[kind]], { type: kind === 'flashcards' ? 'text/csv' : 'text/markdown' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${safe(report.doc_title)}-${kind}.${kind === 'flashcards' ? 'csv' : 'md'}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0) }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div role="dialog" aria-modal="true" className="w-full max-w-4xl rounded-2xl border border-border bg-background p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Export report</h2><button onClick={onClose} aria-label="Close" className="text-xl">×</button></div><div className="mt-5 grid gap-4 md:grid-cols-[190px_1fr]"><div className="flex gap-2 md:flex-col">{(['notes','changelog','flashcards'] as Kind[]).map((value) => <button key={value} onClick={() => setKind(value)} className={`rounded-xl border p-3 text-left capitalize ${kind === value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border'}`}>{value === 'notes' ? 'Corrected notes' : value === 'flashcards' ? 'Flashcards' : 'Changelog'}</button>)}</div><div className="min-h-64 rounded-xl bg-muted/40 p-4"><pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5">{content[kind]}</pre>{kind === 'flashcards' && <p className="mt-4 text-xs text-muted-foreground">Import into Anki: File → Import</p>}</div></div><button onClick={download} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Download .{kind === 'flashcards' ? 'csv' : 'md'}</button></div></div>
}
export default ExportDialog
