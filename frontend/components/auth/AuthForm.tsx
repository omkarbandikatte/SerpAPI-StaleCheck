'use client'

import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

import { authClient } from '@/lib/auth/client'

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
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => { router.prefetch('/app') }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name')).trim()
    const credentials = {
      email: String(data.get('email')).trim().toLowerCase(),
      password: String(data.get('password')),
      ...(isSignUp ? { name } : {}),
    }
    if (isSignUp && name.length < 2) {
      setError('Enter your full name.')
      setPending(false)
      return
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
          <div className="auth-preview" aria-hidden="true">
            <Image src="/stalecheck-report.png" alt="" fill sizes="(max-width: 640px) 100vw, 490px" priority />
          </div>
          <p className="eyebrow">Evidence workspace</p>
          <h1>{isSignUp ? 'Build a memory for what changed.' : 'Welcome back to the facts.'}</h1>
          <p>{isSignUp ? 'Your checks become a private evidence library that gets more useful over time.' : 'Continue checking dated claims against current, cited evidence.'}</p>
        </div>
        <div className="auth-form-wrap">
          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && <label>Name<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>}
            <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required suppressHydrationWarning /></label>
            <div className="password-group"><label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <Eye /> : <EyeOff />}</button></div></div>
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