import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconUsers, IconShield, IconRadio } from '../lib/icons'
import { initials } from '../lib/types'

interface FilleulItem {
  id: string
  name: string
  avatarUrl: string | null
  joinedAt: string | null
}

interface FilleulsResponse {
  linked: boolean
  count: number
  items: FilleulItem[]
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
  hasHostTier: boolean
  canHostLive: boolean
  minReferralsToHost: number
  remainingToHost: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Filleuls() {
  const nav = useNavigate()
  const [data, setData] = useState<FilleulsResponse | null>(null)
  const [items, setItems] = useState<FilleulItem[]>([])
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!localStorage.getItem(USER_TOKEN_KEY)) { nav('/'); return }
    userApi.get<FilleulsResponse>('/users/filleuls?page=1&pageSize=50')
      .then((res) => {
        setData(res)
        setItems(res.items)
        setPage(1)
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) { localStorage.removeItem(USER_TOKEN_KEY); nav('/'); return }
        setErr(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [nav])

  async function loadMore() {
    if (!data?.hasMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await userApi.get<FilleulsResponse>(`/users/filleuls?page=${nextPage}&pageSize=50`)
      setData(res)
      setItems(prev => [...prev, ...res.items])
      setPage(nextPage)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }

  // Use items.length as fallback when count is 0 but items exist (SBC profile vs list discrepancy)
  const effectiveCount = data ? (data.count > 0 ? data.count : items.length) : 0
  const progress = data ? Math.min(100, Math.round((effectiveCount / data.minReferralsToHost) * 100)) : 0

  const filtered = search.trim()
    ? items.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="page page-narrow">
      {/* Nav */}
      <div className="profile-nav">
        <Link to="/catalog"><img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo" /></Link>
        <Link to="/profile" className="btn btn-sm">← Profil</Link>
      </div>

      {/* Stats panel */}
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 52, lineHeight: 1, color: 'var(--sbc)', letterSpacing: '-0.03em' }}>
                {effectiveCount.toLocaleString('fr-FR')}
              </span>
              <span className="hint" style={{ fontSize: 15 }}>filleul{effectiveCount > 1 ? 's' : ''} direct{effectiveCount > 1 ? 's' : ''}</span>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="mono" style={{ color: 'var(--muted)' }}>SEUIL POUR HÉBERGER DES LIVES</span>
                <span className="mono" style={{ color: data.canHostLive ? 'var(--green)' : 'var(--muted)' }}>
                  {effectiveCount} / {data.minReferralsToHost}
                </span>
              </div>
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
                  <strong style={{ color: 'var(--sbc)' }}>
                    {Math.max(0, data.minReferralsToHost - effectiveCount).toLocaleString('fr-FR')} filleul{Math.max(0, data.minReferralsToHost - effectiveCount) > 1 ? 's' : ''}
                  </strong>
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

      {/* List */}
      {data?.linked && items.length > 0 && (
        <div className="panel rise d1">
          <div className="panel-head">
            <IconUsers />
            <h2>Liste</h2>
            {data && <span className="chip mono">{effectiveCount.toLocaleString('fr-FR')}</span>}
          </div>

          <div style={{ margin: '10px 0 4px' }}>
            <input
              type="search"
              placeholder="Rechercher un filleul…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--line-2)',
                color: 'var(--txt)',
                fontFamily: 'var(--display)',
                fontSize: 15,
                padding: '10px 14px',
                borderRadius: 12,
                outline: 'none',
              }}
            />
          </div>

          {filtered.length === 0 && search && (
            <p className="hint mono" style={{ marginTop: 12 }}>Aucun résultat pour « {search} ».</p>
          )}

          <ul className="plain-list">
            {filtered.map((f) => (
              <li key={f.id} className="row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {f.avatarUrl ? (
                    <img
                      src={f.avatarUrl}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--line)' }}
                    />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--sbc-light)', color: 'var(--sbc)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)',
                      border: '2px solid var(--line)',
                    }}>
                      {initials(f.name)}
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: 14 }}>{f.name}</strong>
                    {f.joinedAt && <p className="hint" style={{ fontSize: 11, margin: 0 }}>Rejoint le {formatDate(f.joinedAt)}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {data?.hasMore && !search && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Chargement…' : `Voir plus · page ${page + 1} / ${data.totalPages}`}
              </button>
            </div>
          )}

          {!search && (
            <p className="hint mono" style={{ marginTop: 12, textAlign: 'center', fontSize: 11 }}>
              {items.length.toLocaleString('fr-FR')} affiché{items.length > 1 ? 's' : ''} sur {effectiveCount.toLocaleString('fr-FR')}
            </p>
          )}
        </div>
      )}

      {data?.linked && !loading && effectiveCount === 0 && (
        <div className="panel rise d1">
          <p className="hint">Vous n'avez pas encore de filleuls directs.</p>
        </div>
      )}
    </div>
  )
}
