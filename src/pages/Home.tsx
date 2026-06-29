import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, SSO_STATE_KEY, USER_TOKEN_KEY, USER_KEY, authApi } from '../lib/api'
import type { AuthResponse, SsoAuthorizeResponse } from '../lib/types'

function parseShareCode(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    return u.pathname.split('/').filter(Boolean).pop() ?? null
  } catch {
    return t.split('/').filter(Boolean).pop() ?? null
  }
}

export default function Home() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [share, setShare] = useState('')
  const [busy, setBusy] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const alreadyIn = !!localStorage.getItem(USER_TOKEN_KEY)

  async function loginLocal(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const { accessToken, user } = await authApi.post<AuthResponse>('/auth/login', {
        email: email.trim(),
        password,
      })
      localStorage.setItem(USER_TOKEN_KEY, accessToken)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      nav('/catalog')
    } catch (er) {
      setErr(er instanceof ApiError ? er.message : String(er))
    } finally {
      setBusy(false)
    }
  }

  async function loginSso() {
    setSsoLoading(true)
    setErr(null)
    try {
      const { url, state } = await authApi.get<SsoAuthorizeResponse>('/auth/sso/authorize-url')
      sessionStorage.setItem(SSO_STATE_KEY, state)
      window.location.href = url
    } catch (er) {
      setErr(er instanceof ApiError ? er.message : String(er))
      setSsoLoading(false)
    }
  }

  function joinLive(e: FormEvent) {
    e.preventDefault()
    const code = parseShareCode(share)
    if (code) nav(`/live/${code}`)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img src="/logo/IMG_0477.PNG" alt="SBC Live" className="auth-logo" />
        </div>
        <h2 className="auth-title">Connexion à SBC Live</h2>
        <p className="auth-sub">Plateforme de lives SBC</p>

        <button
          className="btn btn-primary btn-xl"
          type="button"
          onClick={loginSso}
          disabled={ssoLoading || busy}
        >
          {ssoLoading ? 'Redirection…' : 'Se connecter avec SBC'}
        </button>

        <div className="auth-divider"><span>ou</span></div>

        <form onSubmit={loginLocal} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@sbcprecom.com"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button
            className="btn btn-xl"
            style={{ marginTop: 8, background: 'var(--surface-3)', borderColor: 'var(--border)' }}
            disabled={busy || !email.trim() || !password}
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {alreadyIn && !busy && (
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => nav('/catalog')}
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          >
            Reprendre la session →
          </button>
        )}

        {err && <p className="err">{err}</p>}

        <div className="auth-divider"><span>Vous avez un lien de live ?</span></div>

        <form onSubmit={joinLive} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="field" style={{ margin: 0 }}>
            <input
              value={share}
              onChange={e => setShare(e.target.value)}
              placeholder="https://live.sbcprecom.com/live/…"
            />
          </div>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={!parseShareCode(share)}
          >
            Rejoindre en spectateur
          </button>
        </form>
      </div>
    </div>
  )
}
