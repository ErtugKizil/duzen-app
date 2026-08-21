import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './supabaseClient'

const EMAIL_KEY = 'duzen_email'

export default function Login() {
  const [savedEmail, setSavedEmail] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(EMAIL_KEY)
    if (stored) setSavedEmail(stored)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const targetEmail = savedEmail ?? email

    if (mode === 'signup' && !savedEmail) {
      const { error } = await supabase.auth.signUp({ email: targetEmail, password })
      if (error) {
        setError(error.message)
      } else {
        localStorage.setItem(EMAIL_KEY, targetEmail)
        setError('Kayıt oldun! E-postana gelen linki onayladıktan sonra giriş yapabilirsin.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: targetEmail, password })
      if (error) {
        setError(error.message)
      } else {
        localStorage.setItem(EMAIL_KEY, targetEmail)
      }
    }
    setLoading(false)
  }

  const forgetEmail = () => {
    localStorage.removeItem(EMAIL_KEY)
    setSavedEmail(null)
    setEmail('')
    setPassword('')
  }

  return (
    <div className="login-screen">
      <div className="login-blob" aria-hidden="true" />
      <div className="login-card">
        <div className="mascot" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="72" height="72">
            <circle cx="60" cy="60" r="52" fill="var(--coral)" />
            <circle cx="42" cy="55" r="7" fill="var(--text)" />
            <circle cx="78" cy="55" r="7" fill="var(--text)" />
            <path d="M40 78 Q60 96 80 78" stroke="var(--text)" strokeWidth="6" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <h1>{savedEmail ? 'Tekrar hoş geldin' : "Düzen'e hoş geldin"}</h1>
        <p className="subtitle">
          {savedEmail ? savedEmail : 'Evini ve bütçeni tek yerden takip et'}
        </p>

        <form onSubmit={handleSubmit}>
          {!savedEmail && (
            <input
              type="email"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            inputMode="numeric"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Bir saniye...' : mode === 'signup' && !savedEmail ? 'Kayıt ol' : 'Giriş yap'}
          </button>
        </form>

        {!savedEmail && (
          <button className="link-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </button>
        )}

        {savedEmail && (
          <button className="link-button" onClick={forgetEmail}>
            Farklı hesapla giriş yap
          </button>
        )}

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  )
}
