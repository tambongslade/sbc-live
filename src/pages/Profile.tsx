import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
import { IconAlertTriangle, IconRadio, IconShield, IconTag, IconTrash, IconUser, IconUsers, IconX } from '../lib/icons'
import { ALL_WEEKDAYS, WEEKDAY_LABELS, formatFcfa, type AuthUser, type Live, type Offer, type OfferAccessMode, type SbcTier, type Weekday } from '../lib/types'


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
  const [offerTitle, setOfferTitle] = useState('')
  const [offerWeeklyPrice, setOfferWeeklyPrice] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerAnnualPrice, setOfferAnnualPrice] = useState('')
  const [offerMode, setOfferMode] = useState<OfferAccessMode>('OPEN_TO_ALL')
  const [offerFreq, setOfferFreq] = useState<string>('1')
  const [offerWeekdays, setOfferWeekdays] = useState<Weekday[]>([])
  const [offerTime, setOfferTime] = useState('10:00')
  const [offerEndTime, setOfferEndTime] = useState('11:00')
  const [offerTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [offerBusy, setOfferBusy] = useState(false)
  const [offerErr, setOfferErr] = useState<string | null>(null)
  const [offerEligErr, setOfferEligErr] = useState<string | null>(null)

  // Offer flyer
  const [flyerFile, setFlyerFile] = useState<File | null>(null)
  const [flyerBusy, setFlyerBusy] = useState(false)
  const [flyerErr, setFlyerErr] = useState<string | null>(null)

  // Waiver rules
  const [waiverBusy, setWaiverBusy] = useState<SbcTier | null>(null)
  const [waiverErr, setWaiverErr] = useState<string | null>(null)

  // Live cancel
  const [cancellingLiveId, setCancellingLiveId] = useState<string | null>(null)

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
        if (off) {
          setOfferTitle(off.title ?? '')
          setOfferWeeklyPrice(off.weeklyPriceFcfa ? String(off.weeklyPriceFcfa) : '')
          setOfferPrice(off.monthlyPriceFcfa ? String(off.monthlyPriceFcfa) : '')
          setOfferAnnualPrice(off.annualPriceFcfa ? String(off.annualPriceFcfa) : '')
          setOfferMode(off.accessMode)
          setOfferFreq(String(off.frequencyPerWeek ?? 1))
          setOfferWeekdays(off.weekdays ?? [])
          setOfferTime(off.liveStartTime ?? '10:00')
          setOfferEndTime(off.liveEndTime ?? '11:00')
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) { localStorage.removeItem(USER_TOKEN_KEY); nav('/') }
      })
      .finally(() => setLoading(false))
  }, [nav])

  async function saveOffer(e: FormEvent) {
    e.preventDefault()
    const weekly = offerWeeklyPrice.trim() ? parseInt(offerWeeklyPrice, 10) : null
    const monthly = offerPrice.trim() ? parseInt(offerPrice, 10) : null
    const annual = offerAnnualPrice.trim() ? parseInt(offerAnnualPrice, 10) : null
    if (!weekly && !monthly && !annual) { setOfferErr('Indiquez au moins un tarif (hebdo, mensuel ou annuel).'); return }
    if (weekly && weekly < 1) { setOfferErr('Prix hebdomadaire invalide.'); return }
    if (monthly && monthly < 1) { setOfferErr('Prix mensuel invalide.'); return }
    if (annual && annual < 1) { setOfferErr('Prix annuel invalide.'); return }

    const freq = parseInt(offerFreq, 10)
    if (freq < 1 || freq > 7) { setOfferErr('La fréquence doit être entre 1 et 7 fois par semaine.'); return }
    if (offerWeekdays.length > 0 && offerWeekdays.length !== freq) {
      setOfferErr(`Vous avez sélectionné ${offerWeekdays.length} jour(s) mais déclaré ${freq} live(s)/semaine.`); return
    }
    const [hh] = offerTime.split(':').map(Number)
    if (hh < 6 || hh >= 23) { setOfferErr('L\'heure de début doit être entre 06:00 et 23:00.'); return }
    const [ehh, emm] = offerEndTime.split(':').map(Number)
    const [shh, smm] = offerTime.split(':').map(Number)
    if (ehh * 60 + emm <= shh * 60 + smm) { setOfferErr('L\'heure de fin doit être après l\'heure de début.'); return }

    setOfferBusy(true); setOfferErr(null); setOfferEligErr(null)
    try {
      const body: Record<string, unknown> = {
        accessMode: offerMode,
        frequencyPerWeek: freq,
        liveStartTime: offerTime,
        liveEndTime: offerEndTime,
        timezone: offerTimezone,
      }
      if (offerTitle.trim()) body.title = offerTitle.trim()
      if (weekly) body.weeklyPriceFcfa = weekly
      if (monthly) body.monthlyPriceFcfa = monthly
      if (annual) body.annualPriceFcfa = annual
      if (offerWeekdays.length > 0) body.weekdays = offerWeekdays
      let saved = offer
        ? await userApi.patch<Offer>(`/offers/${offer.id}`, body)
        : await userApi.post<Offer>('/offers', body)

      // Auto-upload flyer if one was picked
      if (flyerFile) {
        setFlyerBusy(true)
        try {
          saved = await userApi.upload<Offer>(`/offers/${saved.id}/flyer`, flyerFile)
          setFlyerFile(null)
        } catch (flyerE) {
          setFlyerErr(flyerE instanceof ApiError ? flyerE.message : String(flyerE))
        } finally {
          setFlyerBusy(false)
        }
      }

      setOffer(saved)
      setOfferTitle(saved.title ?? '')
      setOfferWeeklyPrice(saved.weeklyPriceFcfa ? String(saved.weeklyPriceFcfa) : '')
      setOfferPrice(saved.monthlyPriceFcfa ? String(saved.monthlyPriceFcfa) : '')
      setOfferAnnualPrice(saved.annualPriceFcfa ? String(saved.annualPriceFcfa) : '')
      setOfferMode(saved.accessMode)
      setOfferFreq(String(saved.frequencyPerWeek ?? 1))
      setOfferWeekdays(saved.weekdays ?? [])
      setOfferTime(saved.liveStartTime ?? '10:00')
      setOfferEndTime(saved.liveEndTime ?? '11:00')
      setEditingOffer(false)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 503)) {
        setOfferEligErr(err.message)
      } else {
        setOfferErr(err instanceof ApiError ? err.message : String(err))
      }
    } finally { setOfferBusy(false) }
  }

  function toggleWeekday(day: Weekday) {
    setOfferWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
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

  const cancelLive = async (l: Live) => {
    if (!confirm(`Annuler définitivement « ${l.title} » ?`)) return
    setCancellingLiveId(l.id)
    try {
      await userApi.post(`/lives/${l.id}/cancel`)
      setLives((prev) => prev.filter((x) => x.id !== l.id))
    } finally {
      setCancellingLiveId(null)
    }
  }

  if (loading && !user) {
    return <div className="page page-narrow center"><p className="hint mono rise">Chargement…</p></div>
  }

  return (
    <div className="page page-narrow">
      {/* Nav */}
      <div className="profile-nav">
        <Link to="/catalog"><img src="/logo/IMG_0477.PNG" alt="SBC Live" className="app-logo" /></Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/filleuls" className="btn btn-sm"><IconUsers /> Filleuls</Link>
          <Link to="/admin" className="btn btn-sm"><IconRadio /> Studio</Link>
        </div>
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
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  {offer.weeklyPriceFcfa && <span className="offer-price">{formatFcfa(offer.weeklyPriceFcfa)}<span className="hint">/sem</span></span>}
                  {offer.monthlyPriceFcfa && <span className="offer-price">{formatFcfa(offer.monthlyPriceFcfa)}<span className="hint">/mois</span></span>}
                  {offer.annualPriceFcfa && <span className="offer-price">{formatFcfa(offer.annualPriceFcfa)}<span className="hint">/an</span></span>}
                </div>
                <p className="hint mono">
                  {offer.accessMode === 'FILLEUL_ONLY' ? 'Filleuls uniquement' : 'Ouvert à tous'}
                </p>
                {offer.frequencyPerWeek && (
                  <p className="hint" style={{ marginTop: 4, fontSize: 12 }}>
                    {offer.frequencyPerWeek}×/sem
                    {offer.liveStartTime ? ` · ${offer.liveStartTime}` : ''}
                    {offer.weekdays?.length ? ` · ${offer.weekdays.map(d => WEEKDAY_LABELS[d].slice(0, 3)).join(', ')}` : ''}
                  </p>
                )}
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

        {/* Flyer quick-replace (summary view) */}
        {offer && !editingOffer && offer.flyerUrl && (
          <div className="waiver-section" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <img src={offer.flyerUrl} alt="Flyer" style={{ width: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <p className="hint mono" style={{ marginBottom: 6 }}>FLYER</p>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                {flyerBusy ? 'Envoi…' : 'Remplacer'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f || !offer) return
                    setFlyerBusy(true); setFlyerErr(null)
                    try { setOffer(await userApi.upload<Offer>(`/offers/${offer.id}/flyer`, f)) }
                    catch (err) { setFlyerErr(err instanceof ApiError ? err.message : String(err)) }
                    finally { setFlyerBusy(false) }
                  }}
                  disabled={flyerBusy}
                />
              </label>
              {flyerErr && <p className="err mono" style={{ marginTop: 6 }}>{flyerErr}</p>}
            </div>
          </div>
        )}

        {/* Offer edit/create form */}
        {editingOffer && (
          <form onSubmit={saveOffer} style={{ marginTop: 16 }}>

            {/* ── Identité ─────────────────────────────────── */}
            <p className="offer-section-label mono">IDENTITÉ</p>
            <label className="field">
              <span className="mono">Nom de l'offre (optionnel)</span>
              <input value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} placeholder="ex. Lives trading du soir" autoFocus />
            </label>

            {/* ── Tarification ─────────────────────────────── */}
            <p className="offer-section-label mono">TARIFICATION <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— au moins un tarif requis</span></p>
            <div className="billing-cycle-grid">
              <label className="billing-cycle-card">
                <span className="mono billing-cycle-label">Hebdomadaire</span>
                <div className="billing-cycle-input-row">
                  <input type="number" min="1" value={offerWeeklyPrice} onChange={(e) => setOfferWeeklyPrice(e.target.value)} placeholder="—" />
                  <span className="billing-cycle-unit hint">FCFA/sem</span>
                </div>
              </label>
              <label className="billing-cycle-card billing-cycle-featured">
                <span className="mono billing-cycle-label">Mensuel</span>
                <div className="billing-cycle-input-row">
                  <input type="number" min="1" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="—" />
                  <span className="billing-cycle-unit hint">FCFA/mois</span>
                </div>
              </label>
              <label className="billing-cycle-card">
                <span className="mono billing-cycle-label">Annuel</span>
                <div className="billing-cycle-input-row">
                  <input type="number" min="1" value={offerAnnualPrice} onChange={(e) => setOfferAnnualPrice(e.target.value)} placeholder="—" />
                  <span className="billing-cycle-unit hint">FCFA/an</span>
                </div>
              </label>
            </div>
            <label className="field">
              <span className="mono">Mode d'accès</span>
              <select className="field-select" value={offerMode} onChange={(e) => setOfferMode(e.target.value as OfferAccessMode)}>
                <option value="OPEN_TO_ALL">Ouvert à tous (qui paient)</option>
                <option value="FILLEUL_ONLY">Mes filleuls uniquement</option>
              </select>
            </label>

            {/* ── Cadence hebdomadaire ─────────────────────── */}
            <p className="offer-section-label mono">CADENCE HEBDOMADAIRE</p>
            <div className="offer-price-row">
              <label className="field" style={{ flex: '0 0 160px' }}>
                <span className="mono">Lives / semaine (1–7)</span>
                <input type="number" min="1" max="7" value={offerFreq} onChange={(e) => setOfferFreq(e.target.value)} />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="mono">Début (06:00–23:00)</span>
                <input type="time" min="06:00" max="23:00" value={offerTime} onChange={(e) => setOfferTime(e.target.value)} className="field-datetime" />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="mono">Fin</span>
                <input type="time" min="06:00" max="23:59" value={offerEndTime} onChange={(e) => setOfferEndTime(e.target.value)} className="field-datetime" />
              </label>
            </div>
            <div className="field">
              <span className="mono" style={{ display: 'block', marginBottom: 10 }}>Jours de diffusion</span>
              <div className="weekday-grid">
                {ALL_WEEKDAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    className={`weekday-btn${offerWeekdays.includes(day) ? ' weekday-btn-on' : ''}`}
                    onClick={() => toggleWeekday(day)}
                  >
                    {WEEKDAY_LABELS[day].slice(0, 3)}
                  </button>
                ))}
              </div>
              {offerWeekdays.length > 0 && offerWeekdays.length !== parseInt(offerFreq, 10) && (
                <p className="field-hint">
                  {offerWeekdays.length} jour(s) sélectionné(s) — doit correspondre à la fréquence ({offerFreq}/sem)
                </p>
              )}
              <p className="hint" style={{ marginTop: 6, fontSize: 12 }}>
                Fuseau : {offerTimezone}
              </p>
            </div>

            {/* ── Flyer ────────────────────────────────────── */}
            <p className="offer-section-label mono">FLYER</p>
            <div className="flyer-drop-zone" onClick={() => document.getElementById('offer-flyer-input')?.click()}>
              {flyerFile ? (
                <img src={URL.createObjectURL(flyerFile)} alt="Aperçu" className="flyer-drop-preview" />
              ) : offer?.flyerUrl ? (
                <img src={offer.flyerUrl} alt="Flyer actuel" className="flyer-drop-preview" />
              ) : (
                <div className="flyer-drop-placeholder">
                  <span className="flyer-drop-icon">🖼</span>
                  <span className="mono">Cliquez pour choisir une image</span>
                  <span className="hint" style={{ fontSize: 11, marginTop: 4 }}>Portrait · 1080×1350 recommandé · max 5 Mo</span>
                </div>
              )}
              <input
                id="offer-flyer-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { setFlyerFile(e.target.files?.[0] ?? null); setFlyerErr(null) }}
              />
            </div>
            {flyerFile && (
              <p className="hint mono" style={{ marginTop: 6, fontSize: 11 }}>
                {flyerFile.name} · {(flyerFile.size / 1024 / 1024).toFixed(1)} Mo
                <button type="button" className="btn btn-sm btn-danger" style={{ marginLeft: 10, padding: '3px 10px' }} onClick={() => setFlyerFile(null)}>✕</button>
              </p>
            )}
            {flyerErr && <p className="err mono" style={{ marginTop: 6 }}>{flyerErr}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn btn-red" disabled={offerBusy}>
                {offerBusy ? (flyerBusy ? 'Envoi du flyer…' : 'Enregistrement…') : offer ? 'Mettre à jour' : 'Créer l\'offre'}
              </button>
              <button className="btn btn-sm" type="button" onClick={() => { setEditingOffer(false); setOfferErr(null); setOfferEligErr(null); setFlyerFile(null); setFlyerErr(null) }}>
                Annuler
              </button>
            </div>
            {offerErr && <p className="err mono" style={{ marginTop: 10 }}>{offerErr}</p>}
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(l.status === 'LIVE' || l.status === 'SCHEDULED') && (
                  <Link to="/admin" className="btn btn-sm">Studio →</Link>
                )}
                {(l.status === 'SCHEDULED' || l.status === 'LIVE') && (
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={cancellingLiveId === l.id}
                    onClick={() => cancelLive(l)}
                    title="Annuler ce live"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <BottomNav active="profile" />
    </div>
  )
}
