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
    tier === 'CLASSIQUE' ? 'tier-badge tier-classique'
    : tier === 'CIBLE' ? 'tier-badge tier-cible'
    : 'tier-badge tier-other'
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

function LiveCard({ live, onSubscribe, subscribing }: CardProps) {
  const { access } = live
  const hasFly = Boolean(live.flyerUrl)

  return (
    <div className={`sbc-card ${hasFly ? 'sbc-card-flyer' : ''}`}>
      {hasFly && (
        <div className="sbc-card-img">
          <img src={live.flyerUrl!} alt={live.title} />
          <div className="sbc-card-img-overlay" />
          {live.status === 'LIVE' && (
            <span className="onair-badge"><span className="led led-red" /> EN DIRECT</span>
          )}
          {live.requiredSbcTier && tierBadge(live.requiredSbcTier)}
        </div>
      )}
      <div className="sbc-card-body">
        {!hasFly && (
          <div className="sbc-card-top">
            {live.status === 'LIVE' && (
              <span className="onair-badge"><span className="led led-red" /> EN DIRECT</span>
            )}
            {live.requiredSbcTier && tierBadge(live.requiredSbcTier)}
          </div>
        )}
        <h3 className="sbc-card-title">{live.title}</h3>
        {live.scheduledAt && live.status === 'SCHEDULED' && (
          <p className="sbc-card-date">{fmtDate(live.scheduledAt)}</p>
        )}
        <p className="sbc-card-host">{live.host.displayName}</p>
        <div className="sbc-card-cta">
          {access.granted ? (
            <Link to={`/live/${live.shareCode}`} className="btn btn-red btn-full">
              {live.status === 'LIVE' ? 'Rejoindre' : 'Accéder'}
            </Link>
          ) : access.reason === 'tier_required' ? (
            <p className="card-locked-msg">
              Réservé aux abonnés <strong>{access.requiredTier ?? live.requiredSbcTier}</strong>
            </p>
          ) : access.paywall?.canPurchase ? (
            <button
              className="btn btn-amber btn-full"
              disabled={subscribing === access.paywall.offerId}
              onClick={() => onSubscribe(access.paywall!.offerId)}
            >
              {subscribing === access.paywall.offerId
                ? 'Redirection…'
                : `S'abonner · ${formatFcfa(access.paywall.monthlyPriceFcfa)}/mois`}
            </button>
          ) : (
            <p className="card-locked-msg">{access.paywall?.message ?? 'Accès restreint'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Catalog() {
  const nav = useNavigate()
  const [ongoing, setOngoing] = useState<CatalogLive[]>([])
  const [scheduled, setScheduled] = useState<CatalogLive[]>([])
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
        // fallback: try the catalog endpoint
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo" style={{ height: 32 }} />
        <div className="app-header-right">
          {user && <span className="app-username">{user.displayName}</span>}
          <Link to="/profile" className="btn btn-sm"><IconUser /></Link>
          {canHost && <Link to="/admin" className="btn btn-sm btn-red"><IconRadio /></Link>}
        </div>
      </header>

      <main className="app-body">
        <div className="app-search">
          <div className="mob-search-bar">
            <IconSearch />
            <input className="mob-search-input" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {err && <p className="err mono" style={{ padding: '8px 0' }}>{err}</p>}

        <section className="app-section">
          <div className="app-section-head">
            <span className="led led-red" />
            <h2 className="app-section-title">EN DIRECT</h2>
            <span className="app-section-count mono">{filteredOngoing.length}</span>
          </div>
          {loading && <p className="hint mono" style={{ padding: '16px 0' }}>Chargement…</p>}
          {!loading && filteredOngoing.length === 0 && (
            <div className="app-empty">
              <p className="hint">{q ? 'Aucun résultat.' : 'Aucun live en cours.'}</p>
            </div>
          )}
          {filteredOngoing.length > 0 && (
            <div className="app-cards">
              {filteredOngoing.map(live => <LiveCard key={live.id} live={live} onSubscribe={subscribe} subscribing={subscribing} />)}
            </div>
          )}
        </section>

        <section className="app-section">
          <div className="app-section-head">
            <span className="sbc-dot-orange" />
            <h2 className="app-section-title">PROGRAMMÉS</h2>
            <span className="app-section-count mono">{filteredScheduled.length}</span>
          </div>
          {!loading && filteredScheduled.length === 0 && (
            <div className="app-empty">
              <p className="hint">{q ? 'Aucun résultat.' : 'Aucun live programmé.'}</p>
            </div>
          )}
          {filteredScheduled.length > 0 && (
            <div className="app-cards">
              {filteredScheduled.map(live => <LiveCard key={live.id} live={live} onSubscribe={subscribe} subscribing={subscribing} />)}
            </div>
          )}
        </section>

        <div style={{ height: 16 }} />
      </main>

      {canHost && <Link to="/admin" className="mob-fab" aria-label="Créer un live"><IconPlus /></Link>}

      <nav className="mob-bottom-nav">
        <Link to="/catalog" className="mob-nav-item active"><IconHome /><span>Accueil</span></Link>
        <button className="mob-nav-item" onClick={() => document.querySelector<HTMLInputElement>('.mob-search-input')?.focus()}>
          <IconSearch /><span>Chercher</span>
        </button>
        <Link to="/profile" className="mob-nav-item"><IconUser /><span>Profil</span></Link>
        {canHost && <Link to="/admin" className="mob-nav-item"><IconRadio /><span>Studio</span></Link>}
      </nav>
    </div>
  )
}
