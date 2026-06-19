import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconAlertTriangle, IconRadio, IconShield, IconTag, IconUser, IconX } from '../lib/icons'
import { formatFcfa, type AuthUser, type Live, type Offer, type OfferAccessMode, type SbcTier } from '../lib/types'

const VIEWER_TIERS: { tier: SbcTier; label: string; desc: string }[] = [
  { tier: 'CLASSIQUE', label: 'CLASSIQUE', desc: 'Membres SBC Classique' },
  { tier: 'CIBLE', label: 'CIBLE', desc: 'Membres SBC Cible' },
]

function statusLabel(s: string) {
  const map: Record<string, string> = { LIVE: 'EN DIRECT', SCHEDULED: 'PROGRAMMÉ', ENDED: 'TERMINÉ', CANCELLED: 'ANNULÉ' }
  return map[s] ?? s
}

export default function Profile() {
  const nav = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [lives, setLives] = useState<Live[]>([])
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  // Offer form
  const [editingOffer, setEditingOffer] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMode, setOfferMode] = useState<OfferAccessMode>('OPEN_TO_ALL')
  const [offerBusy, setOfferBusy] = useState(false)
  const [offerErr, setOfferErr] = useState<string | null>(null)
  const [offerEligErr, setOfferEligErr] = useState<string | null>(null)

  // Waiver rules
  const [waiverBusy, setWaiverBusy] = useState<SbcTier | null>(null)
  const [waiverErr, setWaiverErr] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem(USER_TOKEN_KEY)) { nav('/'); return }
    const cached = localStorage.getItem(USER_KEY)
    if (cached) { try { setUser(JSON.parse(cached) as AuthUser) } catch { /* ignore */ } }

    Promise.all([
      userApi.get<AuthUser>('/auth/me'),
      userApi.get<Live[]>('/lives/mine'),
      userApi.get<Offer | null>('/offers/mine'),
    ])
      .then(([me, ls, off]) => {
        setUser(me)
        localStorage.setItem(USER_KEY, JSON.stringify(me))
        setLives(Array.isArray(ls) ? ls : [])
        setOffer(off)
        if (off) { setOfferPrice(String(off.monthlyPriceFcfa)); setOfferMode(off.accessMode) }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) { localStorage.removeItem(USER_TOKEN_KEY); nav('/') }
      })
      .finally(() => setLoading(false))
  }, [nav])

  async function saveOffer(e: FormEvent) {
    e.preventDefault()
    const price = parseInt(offerPrice, 10)
    if (!price || price < 1) { setOfferErr('Prix invalide (minimum 1 FCFA).'); return }
    setOfferBusy(true); setOfferErr(null); setOfferEligErr(null)
    try {
      const body = { monthlyPriceFcfa: price, accessMode: offerMode }
      const saved = offer
        ? await userApi.patch<Offer>(`/offers/${offer.id}`, body)
        : await userApi.post<Offer>('/offers', body)
      setOffer(saved)
      setOfferPrice(String(saved.monthlyPriceFcfa))
      setOfferMode(saved.accessMode)
      setEditingOffer(false)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 503)) {
        setOfferEligErr(err.message)
      } else {
        setOfferErr(err instanceof ApiError ? err.message : String(err))
      }
    } finally { setOfferBusy(false) }
  }

  async function toggleOfferActive() {
    if (!offer) return
    setOfferBusy(true); setOfferErr(null)
    try {
      setOffer(await userApi.patch<Offer>(`/offers/${offer.id}`, { isActive: !offer.isActive }))
    } catch (err) {
      setOfferErr(err instanceof ApiError ? err.message : String(err))
    } finally { setOfferBusy(false) }
  }

  async function addWaiverRule(tier: SbcTier) {
    if (!offer) return
    setWaiverBusy(tier); setWaiverErr(null)
    try {
      setOffer(await userApi.post<Offer>(`/offers/${offer.id}/rules`, { sbcTier: tier }))
    } catch (err) {
      setWaiverErr(err instanceof ApiError ? err.message : String(err))
    } finally { setWaiverBusy(null) }
  }

  async function removeWaiverRule(tier: SbcTier) {
    if (!offer) return
    setWaiverBusy(tier); setWaiverErr(null)
    try {
      setOffer(await userApi.del<Offer>(`/offers/${offer.id}/rules/${tier}`))
    } catch (err) {
      setWaiverErr(err instanceof ApiError ? err.message : String(err))
    } finally { setWaiverBusy(null) }
  }

  if (loading && !user) {
    return <div className="page page-narrow center"><p className="hint mono rise">Chargement…</p></div>
  }

  return (
    <div className="page page-narrow">
      {/* Nav */}
      <div className="profile-nav">
        <Link to="/catalog" className="topbrand mono"><span className="led led-red" /> SBC LIVE</Link>
        <Link to="/admin" className="btn btn-sm"><IconRadio /> Studio</Link>
      </div>

      {/* ── User card ───────────────────────────────────────── */}
      <div className="panel rise">
        <div className="panel-head"><IconUser /><h2>Mon profil</h2></div>
        {user && (
          <div className="profile-info">
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="profile-avatar" />}
            <div>
              <p className="profile-name">{user.displayName}</p>
              {user.email && <p className="hint">{user.email}</p>}
              <span className="chip mono">{user.role}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Offer ───────────────────────────────────────────── */}
      <div className="panel rise d1">
        <div className="panel-head"><IconTag /><h2>Mon offre</h2></div>

        {offerEligErr && (
          <div className="eligibility-box">
            <IconAlertTriangle style={{ color: 'var(--amber)', flex: 'none' }} />
            <div>
              <p className="hint">{offerEligErr}</p>
              <ul className="elig-list mono"><li>≥ 10 000 filleuls directs sur SBC requis</li></ul>
            </div>
          </div>
        )}

        {/* No offer yet */}
        {offer === null && !editingOffer && (
          <>
            <p className="hint">
              Pas encore d'offre. Créez-en une pour rendre vos lives payants
              <span className="mono"> (≥ 10 000 filleuls SBC requis)</span>.
            </p>
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setEditingOffer(true)}>
              Créer une offre
            </button>
          </>
        )}

        {/* Offer summary */}
        {offer && !editingOffer && (
          <>
            <div className="offer-row">
              <div>
                <p className="offer-price">
                  {formatFcfa(offer.monthlyPriceFcfa)}
                  <span className="hint">/mois</span>
                </p>
                <p className="hint mono">
                  {offer.accessMode === 'FILLEUL_ONLY' ? 'Filleuls uniquement' : 'Ouvert à tous'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span className={`chip mono ${offer.isActive ? '' : 'chip-inactive'}`}>
                  {offer.isActive ? 'ACTIF' : 'INACTIF'}
                </span>
                <button className="btn btn-sm" onClick={() => setEditingOffer(true)}>Modifier</button>
                <button className="btn btn-sm" onClick={toggleOfferActive} disabled={offerBusy}>
                  {offer.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </div>
            {offerErr && <p className="err mono">{offerErr}</p>}

            {/* ── Waiver rules ─────────────────────────────── */}
            <div className="waiver-section">
              <div className="waiver-header">
                <IconShield style={{ width: 13, height: 13 }} />
                <span className="mono">GRATUITÉ PAR PALIER SBC</span>
              </div>
              <p className="hint">Les membres de ces paliers accèdent à vos lives sans payer.</p>

              {waiverErr && <p className="err mono">{waiverErr}</p>}

              <div className="waiver-grid">
                {VIEWER_TIERS.map(({ tier, label, desc }) => {
                  const active = offer.accessRules.some((r) => r.sbcTier === tier)
                  const busy = waiverBusy === tier
                  return (
                    <div key={tier} className={`waiver-card ${active ? 'waiver-card-on' : ''}`}>
                      <div className="waiver-card-body">
                        <span className="mono waiver-tier">{label}</span>
                        <span className="hint waiver-desc">{desc}</span>
                      </div>
                      {active ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => removeWaiverRule(tier)}
                          disabled={busy}
                          title="Supprimer cette règle de gratuité"
                        >
                          <IconX /> Retirer
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-ok"
                          onClick={() => addWaiverRule(tier)}
                          disabled={busy}
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Offer edit/create form */}
        {editingOffer && (
          <form onSubmit={saveOffer} style={{ marginTop: 16 }}>
            <label className="field">
              <span className="mono">Prix mensuel (FCFA)</span>
              <input type="number" min="1" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="ex. 3000" autoFocus />
            </label>
            <label className="field">
              <span className="mono">Mode d'accès</span>
              <select className="field-select" value={offerMode} onChange={(e) => setOfferMode(e.target.value as OfferAccessMode)}>
                <option value="OPEN_TO_ALL">Ouvert à tous (qui paient)</option>
                <option value="FILLEUL_ONLY">Mes filleuls uniquement</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-red" disabled={offerBusy}>
                {offerBusy ? 'Enregistrement…' : offer ? 'Mettre à jour' : 'Créer'}
              </button>
              <button className="btn btn-sm" type="button" onClick={() => { setEditingOffer(false); setOfferErr(null); setOfferEligErr(null) }}>
                Annuler
              </button>
            </div>
            {offerErr && <p className="err mono">{offerErr}</p>}
          </form>
        )}
      </div>

      {/* ── Lives list ──────────────────────────────────────── */}
      <div className="panel rise d2">
        <div className="panel-head"><IconRadio /><h2>Mes lives</h2></div>
        {lives.length === 0 && !loading && <p className="hint">Aucun live créé pour le moment.</p>}
        <ul className="plain-list">
          {lives.map((l) => (
            <li key={l.id} className="row">
              <div>
                <strong>{l.title}</strong>
                <span className={`chip mono ${l.status === 'LIVE' ? 'chip-live' : l.status === 'SCHEDULED' ? 'chip-scheduled' : ''}`}>
                  {statusLabel(l.status)}
                </span>
                {l.offerId && <span className="chip mono chip-paid">PAYANT</span>}
              </div>
              {(l.status === 'LIVE' || l.status === 'SCHEDULED') && (
                <Link to="/admin" className="btn btn-sm">Studio →</Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
