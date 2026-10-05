'use client'

import { ArrowRight, KeyRound, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

import { authClient } from '@/lib/auth/client'
import { listChecks } from '@/lib/api'

function authErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  if (message.toLowerCase().includes('user already exists')) {
    return 'An account with this email already exists. Sign in instead.'
  }
  return message || fallback
}

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const isSignUp = mode === 'sign-up'
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { router.prefetch('/app') }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const credentials = {
      email: String(data.get('email')),
      password: String(data.get('password')),
      ...(isSignUp ? { name: String(data.get('name')) } : {}),
    }
    try {
      const result = isSignUp
        ? await authClient.signUp.email(credentials as { email: string; password: string; name: string })
        : await authClient.signIn.email(credentials)
      if (result.error) {
        setError(authErrorMessage(result.error, 'Authentication failed. Please try again.'))
        setPending(false)
        return
      }
      void listChecks().catch(() => undefined)
      router.replace('/app')
    } catch (authError) {
      setError(authErrorMessage(authError, 'Authentication failed. Please try again.'))
      setPending(false)
    }
  }

  async function handleGoogle() {
    setPending(true)
    setError('')
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/app' })
      if (result.error) {
        setError(authErrorMessage(result.error, 'Google sign-in failed.'))
        setPending(false)
      }
    } catch (authError) {
      setError(authErrorMessage(authError, 'Google sign-in failed.'))
      setPending(false)
    }
  }

  return (
    <main className="auth-shell">
      <Link href="/" className="auth-brand"><span>SC</span> StaleCheck</Link>
      <section className="auth-panel">
        <div className="auth-copy">
          <p className="eyebrow">Evidence workspace</p>
          <h1>{isSignUp ? 'Build a memory for what changed.' : 'Welcome back to the facts.'}</h1>
          <p>{isSignUp ? 'Your checks become a private evidence library that gets more useful over time.' : 'Continue checking dated claims against current, cited evidence.'}</p>
        </div>
        <div className="auth-form-wrap">
          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && <label>Name<input name="name" autoComplete="name" minLength={2} required /></label>}
            <label>Email<input name="email" type="email" autoComplete="email" required suppressHydrationWarning /></label>
            <label>Password<input name="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-action" disabled={pending}>
              {pending ? <LoaderCircle className="spin" /> : <>{isSignUp ? 'Create account' : 'Sign in'} <ArrowRight /></>}
            </button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          <button className="google-action" onClick={handleGoogle} disabled={pending}><KeyRound /> Continue with Google</button>
          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to StaleCheck?'}{' '}
            <Link href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}>{isSignUp ? 'Sign in' : 'Create one'}</Link>
          </p>
        </div>
      </section>
    </main>
  )
}