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
    <div className="login-shell">
      <div className="login-brand">
        <img src="/logo/IMG_0477.PNG" alt="SBC Live" className="login-logo" />
        <p className="login-tagline mono">Plateforme de lives SBC</p>
      </div>

      <div className="login-body">
        <form className="login-card" onSubmit={loginLocal}>
          <button className="btn btn-sbc btn-xl" type="button" onClick={loginSso} disabled={ssoLoading || busy}>
            {ssoLoading ? 'Redirection…' : 'Se connecter avec SBC'}
          </button>
          <div className="divider mono">ou</div>
          <label className="field">
            <span className="mono">E-mail</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@sbcprecom.com" autoComplete="email" />
          </label>
          <label className="field">
            <span className="mono">Mot de passe</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>
          <button className="btn btn-red btn-xl" style={{ marginTop: 0 }} disabled={busy || !email.trim() || !password}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          {alreadyIn && !busy && (
            <button className="btn btn-sm" type="button" onClick={() => nav('/catalog')} style={{ width: '100%', marginTop: 4 }}>
              Reprendre la session →
            </button>
          )}
          {err && <p className="err mono">{err}</p>}
        </form>

        <div className="login-divider"><span className="mono hint">Vous avez un lien de live ?</span></div>

        <form className="login-card" onSubmit={joinLive}>
          <label className="field">
            <span className="mono">Lien ou code de partage</span>
            <input value={share} onChange={e => setShare(e.target.value)} placeholder="https://live.sbcprecom.com/live/…" />
          </label>
          <button className="btn btn-full" disabled={!parseShareCode(share)}>
            Rejoindre en spectateur
          </button>
        </form>
      </div>
    </div>
  )
}
