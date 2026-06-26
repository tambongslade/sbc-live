import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconUsers, IconUser } from '../lib/icons'
import { initials } from '../lib/types'

interface Filleul {
  id: string
  displayName: string
  avatarUrl: string | null
  sbcTier?: string | null
  joinedAt?: string | null
  email?: string | null
}

interface FilleulsResponse {
  filleuls?: Filleul[]
  total?: number
  count?: number
  data?: Filleul[]
}

const TIER_COLORS: Record<string, string> = {
  CLASSIQUE: 'var(--muted)',
  CIBLE: 'var(--sbc)',
  RELANCE: 'var(--green)',
  VISIBILITE_MAX: 'var(--orange)',
  TIER_15K_TBD: 'var(--amber)',
}

const TIER_LABELS: Record<string, string> = {
  CLASSIQUE: 'Classique',
  CIBLE: 'Cible',
  RELANCE: 'Relance',
  VISIBILITE_MAX: 'Visibilité Max',
  TIER_15K_TBD: '15 000',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Filleuls() {
  const nav = useNavigate()
  const [filleuls, setFilleuls] = useState<Filleul[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!localStorage.getItem(USER_TOKEN_KEY)) { nav('/'); return }

    userApi.get<FilleulsResponse | Filleul[]>('/users/filleuls')
      .then((res) => {
        if (Array.isArray(res)) {
          setFilleuls(res)
          setTotal(res.length)
        } else {
          const list = res.filleuls ?? res.data ?? []
          setFilleuls(list)
          setTotal(res.total ?? res.count ?? list.length)
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) { localStorage.removeItem(USER_TOKEN_KEY); nav('/'); return }
        setErr(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [nav])

  const filtered = search.trim()
    ? filleuls.filter(f =>
        f.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (f.email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : filleuls

  return (
    <div className="page page-narrow">
      {/* Nav */}
      <div className="profile-nav">
        <Link to="/catalog"><img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo" /></Link>
        <Link to="/profile" className="btn btn-sm">← Profil</Link>
      </div>

      {/* Header */}
      <div className="panel rise">
        <div className="panel-head">
          <IconUsers />
          <h2>Mes filleuls</h2>
        </div>
        {total !== null && !loading && (
          <p className="hint">
            <span style={{ fontWeight: 700, color: 'var(--sbc)', fontSize: 28, lineHeight: 1 }}>{total.toLocaleString('fr-FR')}</span>
            {' '}filleul{total > 1 ? 's' : ''} directs
          </p>
        )}
        {loading && <p className="hint mono rise">Chargement…</p>}
        {err && <p className="err mono">{err}</p>}
      </div>

      {/* List */}
      {!loading && !err && filleuls.length > 0 && (
        <div className="panel rise d1">
          <div className="panel-head">
            <IconUser />
            <h2>Liste</h2>
          </div>

          {/* Search */}
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

          {filtered.length === 0 && (
            <p className="hint mono" style={{ marginTop: 12 }}>Aucun résultat pour « {search} ».</p>
          )}

          <ul className="plain-list">
            {filtered.map((f) => (
              <li key={f.id} className="row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Avatar */}
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
                      {initials(f.displayName)}
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: 14 }}>{f.displayName}</strong>
                    {f.email && <p className="hint" style={{ fontSize: 12, margin: 0 }}>{f.email}</p>}
                    {f.joinedAt && <p className="hint" style={{ fontSize: 11, margin: 0 }}>Rejoint le {formatDate(f.joinedAt)}</p>}
                  </div>
                </div>
                {f.sbcTier && (
                  <span className="chip mono" style={{ color: TIER_COLORS[f.sbcTier] ?? 'var(--muted)', borderColor: TIER_COLORS[f.sbcTier] ?? 'var(--line-2)' }}>
                    {TIER_LABELS[f.sbcTier] ?? f.sbcTier}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !err && filleuls.length === 0 && (
        <div className="panel rise d1">
          <p className="hint">Vous n'avez pas encore de filleuls directs.</p>
        </div>
      )}
    </div>
  )
}
