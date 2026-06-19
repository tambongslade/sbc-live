import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, SSO_STATE_KEY, USER_KEY, USER_TOKEN_KEY, authApi } from '../lib/api'
import type { AuthResponse } from '../lib/types'

export default function AuthCallback() {
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const expected = sessionStorage.getItem(SSO_STATE_KEY)

    if (!code) {
      setErr("Code d’autorisation manquant.")
      return
    }
    if (expected && state !== expected) {
      setErr('État invalide — possible attaque CSRF. Veuillez réessayer.')
      return
    }
    sessionStorage.removeItem(SSO_STATE_KEY)

    authApi
      .post<AuthResponse>('/auth/sso-callback', { code })
      .then(({ accessToken, user }) => {
        localStorage.setItem(USER_TOKEN_KEY, accessToken)
        localStorage.setItem(USER_KEY, JSON.stringify(user))
        nav('/catalog', { replace: true })
      })
      .catch((e: unknown) => {
        setErr(e instanceof ApiError ? e.message : String(e))
      })
  }, [nav])

  if (err) {
    return (
      <div className="page page-narrow center">
        <div className="panel rise center-panel">
          <h2 className="display">ERREUR DE CONNEXION</h2>
          <p className="err mono">{err}</p>
          <Link to="/" className="btn">
            Retour
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page page-narrow center">
      <p className="hint mono rise">Connexion en cours…</p>
    </div>
  )
}
