'use client'

import Link from 'next/link'
import { ArrowRight, LogOut, ScanSearch } from 'lucide-react'

import { authClient } from '@/lib/auth/client'

export function Header() {
  const { data: session, isPending } = authClient.useSession()
  return <header className="site-header"><div className="header-inner"><Link href="/" className="brand"><span><ScanSearch /></span>StaleCheck</Link><nav className="header-nav"><a href="/#method" className="nav-link">Method</a>{!isPending && (session?.user ? <><Link href="/app" className="nav-link">Workspace</Link><button className="icon-action" title="Sign out" aria-label="Sign out" onClick={async () => { await authClient.signOut(); window.location.href = '/' }}><LogOut /></button></> : <><Link href="/auth/sign-in" className="nav-link">Sign in</Link><Link href="/auth/sign-up" className="header-cta">Start checking <ArrowRight /></Link></>)}</nav></div></header>
}
