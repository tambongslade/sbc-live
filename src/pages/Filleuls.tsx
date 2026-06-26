import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconUsers, IconShield, IconRadio } from '../lib/icons'

interface FilleulsResponse {
  linked: boolean
  count: number
  items: unknown[]
  hasHostTier: boolean
  canHostLive: boolean
  minReferralsToHost: number
  remainingToHost: number
}

export default function Filleuls() {
  const nav = useNavigate()
  const [data, setData] = useState<FilleulsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem(USER_TOKEN_KEY)) { nav('/'); return }
    userApi.get<FilleulsResponse>('/users/filleuls')
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) { localStorage.removeItem(USER_TOKEN_KEY); nav('/'); return }
        setErr(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [nav])

  const progress = data ? Math.min(100, Math.round((data.count / data.minReferralsToHost) * 100)) : 0

  return (
    <div className="page page-narrow">
      {/* Nav */}
      <div className="profile-nav">
        <Link to="/catalog"><img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo" /></Link>
        <Link to="/profile" className="btn btn-sm">← Profil</Link>
      </div>

      {/* Header panel */}
      <div className="panel rise">
        <div className="panel-head">
          <IconUsers />
          <h2>Mes filleuls</h2>
        </div>

        {loading && <p className="hint mono">Chargement…</p>}
        {err && <p className="err mono">{err}</p>}

        {data && !data.linked && (
          <div className="eligibility-box" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 20 }}>🔗</span>
            <p className="hint">Aucun compte SBC lié à ce profil. Connectez-vous via SSO pour voir vos filleuls.</p>
          </div>
        )}

        {data && data.linked && (
          <div style={{ marginTop: 12 }}>
            {/* Big count */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 52, lineHeight: 1, color: 'var(--sbc)', letterSpacing: '-0.03em' }}>
                {data.count.toLocaleString('fr-FR')}
              </span>
              <span className="hint" style={{ fontSize: 15 }}>filleul{data.count > 1 ? 's' : ''} direct{data.count > 1 ? 's' : ''}</span>
            </div>

            {/* Host gate status */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="mono" style={{ color: 'var(--muted)' }}>SEUIL POUR HÉBERGER DES LIVES</span>
                <span className="mono" style={{ color: data.canHostLive ? 'var(--green)' : 'var(--muted)' }}>
                  {data.count} / {data.minReferralsToHost}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, background: 'var(--line)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: data.canHostLive ? 'var(--green)' : 'var(--sbc)',
                  borderRadius: 100,
                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }} />
              </div>

              {data.canHostLive ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <span style={{ color: 'var(--green)', fontSize: 18 }}>✓</span>
                  <p className="hint" style={{ color: 'var(--green)', fontWeight: 600, margin: 0 }}>
                    Vous pouvez héberger des lives.
                  </p>
                  <Link to="/admin" className="btn btn-sm btn-ok" style={{ marginLeft: 'auto' }}>
                    <IconRadio /> Studio
                  </Link>
                </div>
              ) : (
                <p className="hint" style={{ marginTop: 10 }}>
                  Encore{' '}
                  <strong style={{ color: 'var(--sbc)' }}>{data.remainingToHost.toLocaleString('fr-FR')} filleul{data.remainingToHost > 1 ? 's' : ''}</strong>
                  {' '}pour débloquer l'hébergement de lives.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tier override */}
      {data?.hasHostTier && (
        <div className="panel rise d1">
          <div className="panel-head">
            <IconShield />
            <h2>Accès par palier SBC</h2>
          </div>
          <p className="hint">Votre palier SBC (VISIBILITÉ MAX ou supérieur) vous donne accès à l'hébergement de lives sans condition de filleuls.</p>
        </div>
      )}
    </div>
  )
}
