'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, FileText, History, LoaderCircle, Plus, Upload, X } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { createCheck, listChecks } from '@/lib/api'
import type { CheckSummary } from '@/lib/types'

const formatDate = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

export default function WorkspacePage() {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'upload' | 'paste'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [history, setHistory] = useState<CheckSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { listChecks().then(setHistory).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load history')) }, [])

  async function submit() {
    setError('')
    if (tab === 'upload' && !file) return setError('Choose a PDF file.')
    if (tab === 'paste' && !text.trim()) return setError('Paste some text first.')
    if (!date) return setError('Choose the document date.')
    if (file && (file.type !== 'application/pdf' || file.size > 20 * 1024 * 1024)) return setError('Choose a PDF file no larger than 20 MB.')
    setLoading(true)
    try {
      const form = new FormData()
      if (tab === 'upload') form.append('file', file!); else form.append('text', text)
      form.append('title', title || 'Untitled notes')
      form.append('doc_as_of', date)
      const result = await createCheck(form)
      router.push(`/check/${result.check_id}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start check') } finally { setLoading(false) }
  }

  return <><Header /><main className="workspace"><section className="workspace-head"><div><p className="eyebrow">Evidence workspace</p><h1>Check a document</h1><p>Upload a PDF or paste text to compare its dated claims with current evidence.</p></div><div className="memory-stat"><span>{history.reduce((total, check) => total + check.claim_count, 0)}</span><small>claims in your memory</small></div></section><div className="workspace-grid"><section className="checker"><div className="segmented"><button onClick={() => setTab('upload')} className={tab === 'upload' ? 'active' : ''}><Upload /> PDF</button><button onClick={() => setTab('paste')} className={tab === 'paste' ? 'active' : ''}><FileText /> Paste text</button></div>{tab === 'upload' ? <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] || null) }} onClick={() => input.current?.click()}><input ref={input} type="file" accept="application/pdf" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />{file ? <div className="file-row"><FileText /><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button aria-label="Remove file" onClick={(event) => { event.stopPropagation(); setFile(null) }}><X /></button></div> : <><span className="drop-icon"><Plus /></span><strong>Drop your PDF here</strong><small>or click to choose a file, up to 20 MB</small></>}</div> : <textarea className="paste-area" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the document you want to check…" />}<div className="field-grid"><label>Document title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Climate policy notes" /></label><label>Document date<input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} /></label></div>{error && <p className="form-error">{error}</p>}<button className="primary-action submit-check" disabled={loading} onClick={submit}>{loading ? <><LoaderCircle className="spin" /> Starting check</> : <>Run live check <ArrowRight /></>}</button></section><aside className="history-panel"><div className="panel-heading"><History /><div><h2>Recent checks</h2><p>Your private evidence history</p></div></div>{history.length ? <div className="history-list">{history.map((check) => <Link href={check.status === 'done' ? `/check/${check.check_id}/report` : `/check/${check.check_id}`} key={check.check_id}><div><strong>{check.title}</strong><span>{formatDate(check.created_at)} · {check.claim_count} claims</span></div><div className={`score ${check.status}`}>{check.status === 'done' ? check.freshness_score : check.status}</div></Link>)}</div> : <div className="empty-history"><History /><p>Your completed checks will appear here.</p></div>}</aside></div></main></>
}