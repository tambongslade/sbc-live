import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconRadio, IconUser } from '../lib/icons'
import type { AuthUser, CatalogLive, HomeResponse, SubscriptionResponse } from '../lib/types'
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

  async function subscribe(offerId: string) {
    setSubscribing(offerId); setErr(null)
    try {
      const { checkoutUrl } = await userApi.post<SubscriptionResponse>('/subscriptions', { offerId })
      window.location.href = checkoutUrl
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e)); setSubscribing(null)
    }
  }

  function logout() {
    localStorage.removeItem(USER_TOKEN_KEY); localStorage.removeItem(USER_KEY); nav('/')
  }

  return (
    <div className="sbc-home">

      {/* ── Top nav ──────────────────────────────────────────── */}
      <header className="sbc-nav">
        <div className="sbc-nav-brand">
          <img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo" />
        </div>
        <nav className="sbc-nav-links">
          {user && <span className="sbc-nav-user">{user.displayName}</span>}
          <Link to="/profile" className="btn btn-sm"><IconUser /> Profil</Link>
          {canHost && <Link to="/admin" className="btn btn-sm"><IconRadio /> Studio</Link>}
          <button className="btn btn-sm" onClick={logout}>Déco</button>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="sbc-hero">
        <div className="sbc-hero-inner">
          <img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo app-logo-hero" />
          <h1 className="sbc-hero-title">
            Le réseau de <em>lives SBC</em>
          </h1>
          <p className="sbc-hero-sub">Rejoignez des formations, des lives trading, du coaching — en direct ou en replay.</p>
          {canHost && (
            <Link to="/admin" className="btn btn-red sbc-hero-cta">
              <IconRadio /> Créer un live maintenant
            </Link>
          )}
        </div>
      </div>

      <main className="sbc-main">
        {err && <p className="err mono" style={{ marginBottom: 24 }}>{err}</p>}

        {/* ── EN DIRECT ──────────────────────────────────────── */}
        <section className="sbc-section">
          <div className="sbc-section-head">
            <span className="led led-red" />
            <h2 className="sbc-section-title">EN DIRECT</h2>
          </div>

          {loading && <p className="hint mono">Chargement…</p>}

          {!loading && ongoing.length === 0 && (
            <div className="sbc-empty">
              <p className="hint">Aucun live en cours pour le moment.</p>
              {canHost && (
                <Link to="/admin" className="btn btn-red" style={{ marginTop: 12 }}>
                  <IconRadio /> Lancer un live
                </Link>
              )}
            </div>
          )}

          {ongoing.length > 0 && (
            <div className="sbc-grid">
              {ongoing.map(live => (
                <LiveCard key={live.id} live={live} onSubscribe={subscribe} subscribing={subscribing} />
              ))}
            </div>
          )}
        </section>

        {/* ── PROGRAMMÉS ─────────────────────────────────────── */}
        <section className="sbc-section">
          <div className="sbc-section-head">
            <span className="sbc-dot-orange" />
            <h2 className="sbc-section-title">LIVES PROGRAMMÉS</h2>
          </div>

          {!loading && scheduled.length === 0 && (
            <div className="sbc-empty">
              <p className="hint">Aucun live programmé pour le moment.</p>
            </div>
          )}

          {scheduled.length > 0 && (
            <div className="sbc-grid sbc-grid-scheduled">
              {scheduled.map(live => (
                <LiveCard key={live.id} live={live} onSubscribe={subscribe} subscribing={subscribing} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
