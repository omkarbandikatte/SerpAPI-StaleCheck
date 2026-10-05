'use client'

import { Check, CircleDot, Database, FileSearch, Newspaper, RotateCw, Search, Sparkles } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Header } from '@/components/layout/Header'
import { VerdictBadge } from '@/components/report/VerdictBadge'
import { getCheckStatus } from '@/lib/api'
import type { CheckStatus } from '@/lib/types'

const phases = [
  { state: 'queued', label: 'Preparing document', detail: 'Securing your check workspace', icon: FileSearch },
  { state: 'extracting', label: 'Reading claims', detail: 'Finding facts that can change over time', icon: Sparkles },
  { state: 'searching', label: 'Searching live sources', detail: 'Querying Google, News, and Scholar', icon: Search },
  { state: 'verifying', label: 'Comparing evidence', detail: 'Building verdicts from current sources', icon: Database },
] as const

export default function ProgressPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [status, setStatus] = useState<CheckStatus>()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const clock = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(clock)
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const next = await getCheckStatus(id)
        if (!alive) return
        setStatus(next)
        if (next.status === 'done') router.replace(`/check/${id}/report`)
        else if (next.status === 'failed') setError(next.error || 'The check failed.')
        else timer = setTimeout(poll, 1000)
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Could not load check')
      }
    }
    poll()
    return () => { alive = false; clearTimeout(timer) }
  }, [id, retry, router])

  const activeIndex = Math.max(0, phases.findIndex((phase) => phase.state === status?.status))
  const progress = status?.progress.total
    ? Math.round((status.progress.done / status.progress.total) * 100)
    : activeIndex * 22 + 8

  return <><Header /><main className="checking-shell"><section className="checking-intro"><p className="eyebrow">Live document check</p><h1>Following the evidence.</h1><p>We are reading your document, searching current sources, and comparing every dated claim.</p><div className="checking-meta"><span><CircleDot /> Live</span><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} elapsed</span></div></section>{error ? <section className="checking-error"><strong>We could not finish this check.</strong><p>{error}</p><button className="primary-action" onClick={() => { setError(''); setRetry((value) => value + 1) }}><RotateCw /> Check status again</button></section> : <section className="checking-board"><div className="evidence-radar" aria-hidden="true"><div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="radar-sweep" /><div className="radar-core"><Search /></div><span className="source-node source-google">Google</span><span className="source-node source-news"><Newspaper /> News</span><span className="source-node source-scholar">Scholar</span></div><div className="checking-progress"><div className="progress-copy"><strong>{status?.status === 'verifying' && status.progress.total ? `Verified ${status.progress.done} of ${status.progress.total} claims` : phases[activeIndex].label}</strong><span>{progress}%</span></div><div className="progress-track"><span style={{ width: `${Math.min(progress, 98)}%` }} /></div><div className="phase-list">{phases.map((phase, index) => { const Icon = phase.icon; const complete = index < activeIndex; const active = index === activeIndex; return <div key={phase.state} className={`phase-row ${complete ? 'complete' : ''} ${active ? 'active' : ''}`}><span className="phase-icon">{complete ? <Check /> : <Icon />}</span><div><strong>{phase.label}</strong><p>{phase.detail}</p></div>{active && <span className="activity-dots"><i /><i /><i /></span>}</div> })}</div></div>{status?.partial_claims.length ? <div className="claim-stream"><p className="eyebrow">Verified so far</p>{status.partial_claims.slice(-3).map((claim) => <div className="stream-row" key={claim.id}><p>{claim.text}</p><VerdictBadge verdict={claim.verdict} /></div>)}</div> : <div className="claim-stream waiting"><p className="eyebrow">Evidence feed</p><div className="stream-skeleton" /><div className="stream-skeleton short" /><span>Claims will appear here as they are verified.</span></div>}</section>}</main></>
}