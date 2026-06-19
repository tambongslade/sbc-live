import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconRadio, IconUser, IconUsers } from '../lib/icons'
import type { AuthUser, CatalogLive, SubscriptionResponse } from '../lib/types'
import { formatFcfa } from '../lib/types'

function statusLabel(status: string) {
  switch (status) {
    case 'LIVE': return 'EN DIRECT'
    case 'SCHEDULED': return 'PROGRAMMÉ'
    case 'ENDED': return 'TERMINÉ'
    case 'CANCELLED': return 'ANNULÉ'
    default: return status
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'LIVE': return 'chip-live'
    case 'SCHEDULED': return 'chip-scheduled'
    default: return ''
  }
}

export default function Catalog() {
  const nav = useNavigate()
  const [lives, setLives] = useState<CatalogLive[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState<string | null>(null)

  const storedUser = localStorage.getItem(USER_KEY)
  const user: AuthUser | null = storedUser ? (JSON.parse(storedUser) as AuthUser) : null
  const canHost = user?.role === 'CREATOR' || user?.role === 'ADMIN'

  useEffect(() => {
    if (!localStorage.getItem(USER_TOKEN_KEY)) {
      nav('/')
      return
    }
    userApi
      .get<CatalogLive[]>('/lives/catalog')
      .then(setLives)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem(USER_TOKEN_KEY)
          nav('/')
          return
        }
        setErr(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [nav])

  async function subscribe(offerId: string) {
    setSubscribing(offerId)
    setErr(null)
    try {
      const { checkoutUrl } = await userApi.post<SubscriptionResponse>('/subscriptions', { offerId })
      window.location.href = checkoutUrl
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e))
      setSubscribing(null)
    }
  }

  function logout() {
    localStorage.removeItem(USER_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    nav('/')
  }

  return (
    <div className="page page-catalog">
      <header className="catalog-header rise">
        <div className="catalog-brand">
          <span className="led led-red" />
          <span className="wordmark-sm">
            SBC<em>LIVE</em>
          </span>
        </div>
        <div className="catalog-actions">
          {user && (
            <span className="mono catalog-user">
              {user.displayName}
              <span className="chip mono">{user.role}</span>
            </span>
          )}
          <Link to="/profile" className="btn btn-sm">
            <IconUser /> Profil
          </Link>
          {canHost && (
            <Link to="/admin" className="btn btn-sm">
              <IconRadio /> Studio
            </Link>
          )}
          <button className="btn btn-sm" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main>
        <h2 className="catalog-title mono">LIVES DISPONIBLES</h2>
        {err && <p className="err mono">{err}</p>}

        {loading && <p className="hint mono">Chargement…</p>}

        {!loading && lives.length === 0 && (
          <div className="panel rise center-panel">
            <p className="hint">Aucun live disponible pour le moment.</p>
            {canHost && (
              <Link to="/admin" className="btn btn-red">
                <IconRadio /> Créer un live
              </Link>
            )}
          </div>
        )}

        <div className="catalog-grid">
          {lives.map((live) => {
            const { access } = live
            return (
              <div key={live.id} className="catalog-card rise">
                <div className="card-top">
                  <span className={`chip mono ${statusClass(live.status)}`}>
                    {live.status === 'LIVE' && <span className="led led-white" />}
                    {statusLabel(live.status)}
                  </span>
                  {live.offerId && !access.granted && (
                    <span className="chip mono chip-paid">PAYANT</span>
                  )}
                </div>
                <h3 className="card-title">{live.title}</h3>
                {live.description && <p className="card-desc hint">{live.description}</p>}
                <div className="card-host mono">
                  <IconUsers />
                  {live.host.displayName}
                </div>
                <div className="card-cta">
                  {access.granted ? (
                    <Link to={`/live/${live.shareCode}`} className="btn btn-red btn-full">
                      Rejoindre
                    </Link>
                  ) : access.paywall?.canPurchase ? (
                    <button
                      className="btn btn-amber btn-full"
                      disabled={subscribing === access.paywall.offerId}
                      onClick={() => subscribe(access.paywall!.offerId)}
                    >
                      {subscribing === access.paywall.offerId
                        ? 'Redirection…'
                        : `S'abonner · ${formatFcfa(access.paywall.monthlyPriceFcfa)}/mois`}
                    </button>
                  ) : (
                    <p className="hint mono card-locked">
                      {access.paywall?.message ?? 'Accès restreint'}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
