import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconHome, IconPlus, IconRadio, IconSearch, IconUser } from '../lib/icons'
import type { AuthUser, BillingCycle, CatalogLive, HomeResponse, SubscriptionResponse } from '../lib/types'
import { TIER_PRICES, formatFcfa } from '../lib/types'

function tierBadge(tier: string | null) {
  if (!tier) return null
  const label = tier === 'TIER_15K_TBD' ? '15 000 FCFA' : (TIER_PRICES[tier] ? `${TIER_PRICES[tier]} FCFA` : tier)
  const cls =
    tier === 'CLASSIQUE' ? 'stream-tier-badge stream-tier-classique'
    : tier === 'CIBLE' ? 'stream-tier-badge stream-tier-cible'
    : 'stream-tier-badge stream-tier-other'
  return <span className={cls}>{label}</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

type CardProps = {
  live: CatalogLive
  onSubscribe: (offerId: string) => void
  subscribing: string | null
}

function StreamCard({ live, onSubscribe, subscribing }: CardProps) {
  const { access } = live
  const hasFly = Boolean(live.flyerUrl)

  return (
    <div className="stream-card">
      <div className="stream-thumb-wrap">
        {hasFly ? (
          <img src={live.flyerUrl!} alt={live.title} className="stream-thumb" loading="lazy" />
        ) : (
          <div className="stream-placeholder">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
            </svg>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.06em' }}>SBC LIVE</span>
          </div>
        )}
        {live.status === 'LIVE' && <span className="stream-live-badge">EN DIRECT</span>}
        {live.status === 'SCHEDULED' && (
          <span className="stream-scheduled-badge">PROGRAMMÉ</span>
        )}
        {live.status === 'LIVE' && (
          <span className="stream-viewer-count">
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            Direct
          </span>
        )}
        {live.status === 'SCHEDULED' && live.scheduledAt && (
          <span style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(0,0,0,0.75)', color: '#fff',
            fontSize: 11, padding: '3px 8px', borderRadius: 3,
          }}>
            {fmtDate(live.scheduledAt)}
          </span>
        )}
      </div>

      <div className="stream-card-info">
        <div className="stream-avatar">
          {live.host.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="stream-meta">
          <div className="stream-title">{live.title}</div>
          <div className="stream-host">{live.host.displayName}</div>
          {live.requiredSbcTier && tierBadge(live.requiredSbcTier)}
          <div style={{ marginTop: 8 }}>
            {access.granted ? (
              <Link
                to={`/live/${live.shareCode}`}
                className="btn btn-primary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {live.status === 'LIVE' ? 'Regarder' : 'Accéder'}
              </Link>
            ) : access.reason === 'tier_required' ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                Réservé · <strong style={{ color: 'var(--txt)' }}>{access.requiredTier ?? live.requiredSbcTier}</strong>
              </p>
            ) : access.paywall?.canPurchase ? (
              <button
                className="btn btn-amber btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={subscribing === access.paywall.offerId}
                onClick={() => onSubscribe(access.paywall!.offerId)}
              >
                {subscribing === access.paywall.offerId
                  ? 'Redirection…'
                  : `S'abonner · ${formatFcfa(access.paywall.monthlyPriceFcfa)}/mois`}
              </button>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                {access.paywall?.message ?? 'Accès restreint'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function Catalog() {
  const nav = useNavigate()
  const [ongoing, setOngoing] = useState<CatalogLive[]>([])
  const [scheduled, setScheduled] = useState<CatalogLive[]>([])
  const [scheduledPage, setScheduledPage] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const storedUser = localStorage.getItem(USER_KEY)
  const user: AuthUser | null = storedUser ? (JSON.parse(storedUser) as AuthUser) : null
  const canHost = user?.role === 'CREATOR' || user?.role === 'ADMIN'

  useEffect(() => {
    if (!localStorage.getItem(USER_TOKEN_KEY)) { nav('/'); return }
    userApi
      .get<HomeResponse>('/lives/home')
      .then(({ ongoing: o, scheduled: s }) => {
        setOngoing(Array.isArray(o) ? o : [])
        setScheduled(Array.isArray(s) ? s : [])
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem(USER_TOKEN_KEY); nav('/'); return
        }
        userApi.get<CatalogLive[]>('/lives/catalog')
          .then((all) => {
            setOngoing(all.filter(l => l.status === 'LIVE'))
            setScheduled(all.filter(l => l.status === 'SCHEDULED'))
          })
          .catch((e2: unknown) => setErr(e2 instanceof ApiError ? e2.message : String(e2)))
      })
      .finally(() => setLoading(false))
  }, [nav])

  async function subscribe(offerId: string, billingCycle: BillingCycle = 'MONTHLY') {
    setSubscribing(offerId); setErr(null)
    try {
      const { checkoutUrl } = await userApi.post<SubscriptionResponse>('/subscriptions', { offerId, billingCycle })
      window.location.href = checkoutUrl
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e)); setSubscribing(null)
    }
  }

  const q = search.toLowerCase().trim()
  const filterLives = (list: CatalogLive[]) =>
    q ? list.filter(l => l.title?.toLowerCase().includes(q) || l.host.displayName.toLowerCase().includes(q)) : list

  const filteredOngoing = filterLives(ongoing)
  const filteredScheduled = filterLives(scheduled)
  const visibleScheduled = q ? filteredScheduled : filteredScheduled.slice(0, scheduledPage)
  const hasMoreScheduled = !q && filteredScheduled.length > scheduledPage

  return (
    <div className="tw-shell">
      <header className="tw-topbar">
        <Link to="/catalog" className="tw-logo">
          <img src="/logo/IMG_0477.PNG" alt="SBC Live" />
        </Link>

        <div className="tw-search-wrap">
          <IconSearch className="tw-search-icon" />
          <input
            className="tw-search"
            placeholder="Rechercher un live ou un hôte…"
            value={search}
            onChange={e => { setSearch(e.target.value); setScheduledPage(PAGE_SIZE) }}
          />
        </div>

        <div className="tw-topbar-right">
          {user && <span className="tw-user-name">{user.displayName}</span>}
          <Link to="/profile" className="btn btn-sm btn-icon"><IconUser /></Link>
          {canHost && (
            <Link to="/admin" className="btn btn-sm btn-icon btn-primary"><IconRadio /></Link>
          )}
        </div>
      </header>

      <div className="tw-body">
        <aside className="tw-sidebar">
          <nav className="tw-nav">
            <Link to="/catalog" className="tw-nav-item active">
              <IconHome className="tw-nav-icon" /> Accueil
            </Link>
            <Link to="/profile" className="tw-nav-item">
              <IconUser className="tw-nav-icon" /> Profil
            </Link>
            {canHost && (
              <Link to="/admin" className="tw-nav-item">
                <IconRadio className="tw-nav-icon" /> Studio
              </Link>
            )}
          </nav>
          <div className="tw-sidebar-divider" />
        </aside>

        <main className="tw-content">
          {err && <p className="err" style={{ marginBottom: 12 }}>{err}</p>}

          {/* EN DIRECT */}
          <div className="section-head">
            <span className="live-dot" />
            <h2 className="section-title">EN DIRECT</h2>
            <span className="section-count">
              {filteredOngoing.length} stream{filteredOngoing.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading && <p className="hint" style={{ padding: '16px 0' }}>Chargement…</p>}
          {!loading && filteredOngoing.length === 0 && (
            <p className="hint" style={{ padding: '8px 0 24px' }}>
              {q ? 'Aucun résultat.' : 'Aucun live en cours pour l\'instant.'}
            </p>
          )}
          {filteredOngoing.length > 0 && (
            <div className="stream-grid">
              {filteredOngoing.map(live => (
                <StreamCard key={live.id} live={live} onSubscribe={subscribe} subscribing={subscribing} />
              ))}
            </div>
          )}

          {/* PROGRAMMÉS */}
          <div className="section-head">
            <span className="sbc-dot-orange" />
            <h2 className="section-title">PROGRAMMÉS</h2>
            <span className="section-count">{filteredScheduled.length}</span>
          </div>

          {!loading && filteredScheduled.length === 0 && (
            <p className="hint" style={{ padding: '8px 0' }}>
              {q ? 'Aucun résultat.' : 'Aucun live programmé.'}
            </p>
          )}
          {visibleScheduled.length > 0 && (
            <div className="stream-grid">
              {visibleScheduled.map(live => (
                <StreamCard key={live.id} live={live} onSubscribe={subscribe} subscribing={subscribing} />
              ))}
            </div>
          )}
          {hasMoreScheduled && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                className="btn"
                onClick={() => setScheduledPage(p => p + PAGE_SIZE)}
              >
                Voir plus · {filteredScheduled.length - scheduledPage} restant{filteredScheduled.length - scheduledPage > 1 ? 's' : ''}
              </button>
            </div>
          )}

          <div style={{ height: 16 }} />
        </main>
      </div>

      {canHost && (
        <Link to="/admin" className="mob-fab" aria-label="Créer un live">
          <IconPlus />
        </Link>
      )}

      <nav className="mob-bottom-nav">
        <Link to="/catalog" className="mob-nav-item active">
          <IconHome /><span>Accueil</span>
        </Link>
        <button
          className="mob-nav-item"
          onClick={() => document.querySelector<HTMLInputElement>('.tw-search')?.focus()}
        >
          <IconSearch /><span>Chercher</span>
        </button>
        <Link to="/profile" className="mob-nav-item"><IconUser /><span>Profil</span></Link>
        {canHost && <Link to="/admin" className="mob-nav-item"><IconRadio /><span>Studio</span></Link>}
      </nav>
    </div>
  )
}
