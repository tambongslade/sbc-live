import { ConnectionState } from 'livekit-client'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChatPanel } from '../components/ChatPanel'
import { VideoTile } from '../components/VideoTile'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
import { useChat } from '../lib/livekit'
import {
  IconAlertTriangle,
  IconCalendar,
  IconCam,
  IconCamOff,
  IconCheck,
  IconCopy,
  IconEdit,
  IconHand,
  IconMic,
  IconMicOff,
  IconShield,
  IconTag,
  IconTrash,
  IconUsers,
  IconX,
} from '../lib/icons'
import { createHostRoom, useElapsed, useRoomTick } from '../lib/livekit'
import {
  formatFcfa,
  normHand,
  normParticipant,
  type CreatorLevel,
  type Hand,
  type Live,
  type LiveHost,
  type Offer,
  type OfferOptions,
  type ParticipantRow,
  type SbcTier,
  type StartResponse,
  type TokenResponse,
} from '../lib/types'

const ACCESS_TIERS: { value: SbcTier | ''; label: string }[] = [
  { value: '', label: 'Accès libre (tous les membres)' },
  { value: 'CLASSIQUE', label: 'Classique — 2 150 FCFA/mois' },
  { value: 'CIBLE', label: 'Cible — 5 000 FCFA/mois' },
  { value: 'TIER_15K_TBD', label: 'Tier 15 000 FCFA/mois' },
]

type Phase = 'setup' | 'ready' | 'live' | 'ended'
type SidebarTab = 'chat' | 'hands' | 'parts' | 'mods'

interface EligibilityError {
  status: 403 | 503
  message: string
}

function fmtSchedule(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function CardPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '24px 20px',
      position: 'relative',
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function AdminLive() {
  const nav = useNavigate()
  const token = localStorage.getItem(USER_TOKEN_KEY)
  useEffect(() => { if (!token) nav('/') }, [token, nav])

  const [room] = useState(createHostRoom)
  useRoomTick(room)

  const [phase, setPhase] = useState<Phase>('setup')
  const [live, setLive] = useState<Live | null>(null)
  const [myLives, setMyLives] = useState<Live[]>([])
  const [myOffer, setMyOffer] = useState<Offer | null | undefined>(undefined)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledEndAt, setScheduledEndAt] = useState('')
  const [requiredTier, setRequiredTier] = useState<SbcTier | ''>('')
  const [creatorLevel, setCreatorLevel] = useState<CreatorLevel | null>(null)

  const [flyerFile, setFlyerFile] = useState<File | null>(null)
  const [flyerBusy, setFlyerBusy] = useState(false)
  const [flyerErr, setFlyerErr] = useState<string | null>(null)

  const [editingLive, setEditingLive] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const [tab, setTab] = useState<SidebarTab>('chat')
  const [hands, setHands] = useState<Hand[]>([])
  const [parts, setParts] = useState<ParticipantRow[]>([])
  const [moderators, setModerators] = useState<LiveHost[]>([])

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [eligibilityError, setEligibilityError] = useState<EligibilityError | null>(null)
  const [copied, setCopied] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const elapsed = useElapsed(startedAt)

  useEffect(() => { return () => { room.disconnect() } }, [room])

  useEffect(() => {
    userApi.get<unknown[]>('/lives/mine')
      .then((ls) => setMyLives((Array.isArray(ls) ? ls : []) as Live[]))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem(USER_TOKEN_KEY)
          nav('/')
        }
      })
    userApi.get<OfferOptions>('/offers/options')
      .then((opts) => {
        if (!opts.creatorLevels?.length) return
        const stored = localStorage.getItem(USER_KEY)
        if (!stored) { setCreatorLevel(opts.creatorLevels[opts.creatorLevels.length - 1]); return }
        setCreatorLevel(opts.creatorLevels[0])
      })
      .catch(() => {})
  }, [nav])

  const fail = (e: unknown) =>
    setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { fail(e) } finally { setBusy(false) }
  }

  async function createLive(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setEligibilityError(null)
    try {
      let l: Live
      if (flyerFile) {
        const fd = new FormData()
        fd.append('title', title.trim() || 'Live SBC')
        if (description.trim()) fd.append('description', description.trim())
        if (scheduledAt) {
          fd.append('scheduledAt', new Date(scheduledAt).toISOString())
          if (scheduledEndAt) fd.append('scheduledEndAt', new Date(scheduledEndAt).toISOString())
        }
        if (requiredTier) fd.append('requiredSbcTier', requiredTier)
        fd.append('file', flyerFile)
        l = await userApi.postForm<Live>('/lives', fd)
        setFlyerFile(null)
      } else {
        const body: Record<string, string> = { title: title.trim() || 'Live SBC' }
        if (description.trim()) body.description = description.trim()
        if (scheduledAt) {
          body.scheduledAt = new Date(scheduledAt).toISOString()
          if (scheduledEndAt) body.scheduledEndAt = new Date(scheduledEndAt).toISOString()
        }
        if (requiredTier) body.requiredSbcTier = requiredTier
        l = await userApi.post<Live>('/lives', body)
      }
      setLive(l)
      setPhase('ready')
      userApi.get<Offer | null>('/offers/mine').then(setMyOffer).catch(() => setMyOffer(null))
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 503)) {
        setEligibilityError({ status: e.status as 403 | 503, message: e.message })
      } else {
        fail(e)
      }
    } finally {
      setBusy(false)
    }
  }

  async function uploadFlyer() {
    if (!live || !flyerFile) return
    setFlyerBusy(true); setFlyerErr(null)
    try {
      const updated = await userApi.upload<Live>(`/lives/${live.id}/flyer`, flyerFile)
      setLive(updated)
      setFlyerFile(null)
    } catch (e) {
      setFlyerErr(e instanceof ApiError ? e.message : String(e))
    } finally { setFlyerBusy(false) }
  }

  const cancelSetupLive = (l: Live) => run(async () => {
    if (!confirm(`Annuler définitivement « ${l.title} » ?`)) return
    await userApi.post(`/lives/${l.id}/cancel`)
    setMyLives((prev) => prev.filter((x) => x.id !== l.id))
  })

  function startEditLive() {
    setEditTitle(live?.title ?? '')
    setEditDesc(live?.description ?? '')
    setEditingLive(true)
  }

  const saveLiveEdit = () => run(async () => {
    if (!live) return
    const body: Record<string, string> = { title: editTitle.trim() || live.title }
    body.description = editDesc.trim()
    const updated = await userApi.patch<Live>(`/lives/${live.id}`, body)
    setLive(updated)
    setEditingLive(false)
  })

  const cancelReadyLive = () => run(async () => {
    if (!live || !confirm(`Annuler définitivement « ${live.title} » ?`)) return
    await userApi.post(`/lives/${live.id}/cancel`)
    setPhase('setup')
    setLive(null)
  })

  const attachOffer = () => run(async () => {
    if (!live || !myOffer) return
    const updated = await userApi.patch<Live>(`/lives/${live.id}/access`, { offerId: myOffer.id })
    setLive(updated)
  })

  const detachOffer = () => run(async () => {
    if (!live) return
    const updated = await userApi.patch<Live>(`/lives/${live.id}/access`, { offerId: null })
    setLive(updated)
  })

  const goLive = () => run(async () => {
    if (!live) return
    const started = await userApi.post<StartResponse>(`/lives/${live.id}/start`)
    if (started.live) setLive(started.live)
    await room.connect(started.url, started.token)
    await room.localParticipant.enableCameraAndMicrophone()
    setStartedAt(Date.now())
    setPhase('live')
  })

  const resumeLive = (l: Live) => run(async () => {
    const { token: lkToken, url } = await userApi.post<TokenResponse>(`/lives/${l.id}/token`)
    await room.connect(url, lkToken)
    await room.localParticipant.enableCameraAndMicrophone()
    setLive(l)
    setStartedAt(Date.now())
    setPhase('live')
  })

  const liveId = phase === 'live' ? live?.id : undefined

  const poll = useCallback(async () => {
    if (!liveId) return
    try {
      const [h, p, m] = await Promise.all([
        userApi.get<unknown[]>(`/lives/${liveId}/hands`),
        userApi.get<unknown[]>(`/lives/${liveId}/participants`),
        userApi.get<unknown[]>(`/lives/${liveId}/moderators`),
      ])
      setHands((Array.isArray(h) ? h : []).map(normHand))
      setParts((Array.isArray(p) ? p : []).map(normParticipant))
      setModerators((Array.isArray(m) ? m : []) as LiveHost[])
    } catch { /* transient */ }
  }, [liveId])

  useEffect(() => {
    if (!liveId) return
    const t = setTimeout(poll, 0)
    const i = setInterval(poll, 3000)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [liveId, poll])

  const handAction = (identity: string, action: 'accept' | 'reject') => run(async () => {
    await userApi.post(`/lives/${live!.id}/hands/${identity}/${action}`)
    setHands((hs) => hs.filter((h) => h.identity !== identity))
  })

  const partAction = (identity: string, action: 'promote' | 'demote' | 'kick' | 'mute') =>
    run(async () => {
      if (action === 'kick') await userApi.del(`/lives/${live!.id}/participants/${identity}`)
      else if (action === 'mute')
        await userApi.post(`/lives/${live!.id}/participants/${identity}/mute`, { audio: true })
      else await userApi.post(`/lives/${live!.id}/participants/${identity}/${action}`)
      poll()
    })

  const appointMod = (userId: string) => run(async () => {
    await userApi.post(`/lives/${live!.id}/moderators`, { userId })
    poll()
  })

  const removeMod = (userId: string) => run(async () => {
    await userApi.del(`/lives/${live!.id}/moderators/${userId}`)
    poll()
  })

  const muteAll = () => run(() => userApi.post(`/lives/${live!.id}/mute-all`).then(() => poll()))

  const endLive = () => run(async () => {
    if (!live || !confirm("Terminer l'émission pour tout le monde ?")) return
    await userApi.post(`/lives/${live.id}/end`)
    await room.disconnect()
    setPhase('ended')
  })

  const toggleMic = () => run(async () => {
    await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
  })
  const toggleCam = () => run(async () => {
    await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
  })

  async function copyShare() {
    if (!live?.shareUrl) return
    await navigator.clipboard.writeText(live.shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  /* ── stored user ─────────────────────────────────────────── */
  const storedUser = localStorage.getItem(USER_KEY)
  const hostName = storedUser ? (JSON.parse(storedUser) as { displayName: string }).displayName : ''

  /* ── eligibility error ───────────────────────────────────── */
  if (eligibilityError) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', padding: '0 0 80px' }}>
        <StudioTopbar hostName={hostName} />
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <CardPanel>
            <div className="elig-header">
              <IconAlertTriangle style={{ width: 28, height: 28, color: 'var(--amber)', flex: 'none' }} />
              <h2 style={{ fontWeight: 800, fontSize: 22, color: 'var(--txt)' }}>
                {eligibilityError.status === 503 ? 'Service indisponible' : 'Pas encore éligible'}
              </h2>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>{eligibilityError.message}</p>
            {eligibilityError.status === 403 && (
              <div className="elig-req-box">
                <p style={{ color: 'var(--muted)', marginBottom: 8, fontSize: 13 }}>Pour créer un live il vous faut :</p>
                <ul className="elig-list">
                  <li>≥ 25 filleuls directs sur SBC</li>
                  <li>ou l'abonnement VISIBILITE_MAX</li>
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              {eligibilityError.status === 503 && (
                <button className="btn btn-amber" onClick={() => { setEligibilityError(null); setErr(null) }}>
                  Réessayer
                </button>
              )}
              <Link to="/catalog" className="btn">Retour au catalogue</Link>
            </div>
          </CardPanel>
        </div>
      </div>
    )
  }

  /* ── setup ───────────────────────────────────────────────── */
  if (phase === 'setup') {
    const resumable = myLives.filter((l) => l.status === 'LIVE' || l.status === 'SCHEDULED')
    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', padding: '0 0 80px' }}>
        <StudioTopbar hostName={hostName} />
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <CardPanel>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--txt)', marginBottom: 16 }}>Nouvelle émission</h2>
            <form onSubmit={createLive}>
              <div className="field">
                <label>Titre</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ma conférence" autoFocus />
              </div>
              <div className="field">
                <label>Description (optionnel)</label>
                <textarea
                  className="field-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brève description visible dans le catalogue…"
                  rows={3}
                />
              </div>

              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCalendar style={{ width: 13, height: 13 }} /> Programmation (optionnel)
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ flex: 1 }}>
                    <span style={{ display: 'block', color: 'var(--muted)', marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DÉBUT</span>
                    <input
                      type="datetime-local"
                      className="field-datetime"
                      value={scheduledAt}
                      onChange={(e) => { setScheduledAt(e.target.value); if (!scheduledEndAt) setScheduledEndAt(e.target.value) }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span style={{ display: 'block', color: 'var(--muted)', marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      FIN {scheduledAt ? <span style={{ color: 'var(--live)' }}>*</span> : '(optionnel)'}
                    </span>
                    <input
                      type="datetime-local"
                      className="field-datetime"
                      value={scheduledEndAt}
                      onChange={(e) => setScheduledEndAt(e.target.value)}
                      min={scheduledAt || undefined}
                    />
                  </label>
                </div>
                {scheduledAt && (
                  <span className="field-hint">
                    {fmtSchedule(new Date(scheduledAt).toISOString())}
                    {scheduledEndAt ? ` → ${fmtSchedule(new Date(scheduledEndAt).toISOString())}` : ''}
                  </span>
                )}
              </div>

              {creatorLevel && (
                <div className="creator-limits-box">
                  <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Limites actuelles</span>
                  <div className="creator-limits-row">
                    <span className="creator-limit-item">
                      <strong>{Math.floor(creatorLevel.maxDurationMinutes / 60)}h{creatorLevel.maxDurationMinutes % 60 ? `${creatorLevel.maxDurationMinutes % 60}` : ''}</strong>
                      <span className="hint">durée max</span>
                    </span>
                    <span className="creator-limit-item">
                      <strong>{creatorLevel.maxParticipants}</strong>
                      <span className="hint">participants</span>
                    </span>
                    <span className="creator-limit-item">
                      <strong>≥{creatorLevel.minFilleuls}</strong>
                      <span className="hint">filleuls requis</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconTag style={{ width: 13, height: 13 }} /> Accès requis
                </label>
                <select
                  className="field-select"
                  value={requiredTier}
                  onChange={(e) => setRequiredTier(e.target.value as SbcTier | '')}
                >
                  {ACCESS_TIERS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Image / Flyer (optionnel)</label>
                <div
                  className="flyer-drop-zone"
                  onClick={() => document.getElementById('setup-flyer-input')?.click()}
                >
                  {flyerFile ? (
                    <img src={URL.createObjectURL(flyerFile)} alt="Aperçu" className="flyer-drop-preview" />
                  ) : (
                    <div className="flyer-drop-placeholder">
                      <span className="flyer-drop-icon">🖼</span>
                      <span style={{ fontSize: 13 }}>Cliquez pour choisir une image</span>
                      <span className="hint" style={{ fontSize: 11, marginTop: 4 }}>Portrait · 1080×1350 recommandé · max 5 Mo</span>
                    </div>
                  )}
                  <input
                    id="setup-flyer-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={(e) => { setFlyerFile(e.target.files?.[0] ?? null); setFlyerErr(null) }}
                  />
                </div>
                {flyerFile && (
                  <p className="hint" style={{ marginTop: 6, fontSize: 11 }}>
                    {flyerFile.name} · {(flyerFile.size / 1024 / 1024).toFixed(1)} Mo
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      style={{ marginLeft: 10, padding: '3px 10px' }}
                      onClick={() => setFlyerFile(null)}
                    >✕</button>
                  </p>
                )}
                {flyerErr && <p className="err" style={{ marginTop: 6 }}>{flyerErr}</p>}
              </div>

              <button className="btn btn-primary btn-xl" style={{ marginTop: 8 }} disabled={busy}>
                {busy ? (flyerBusy ? 'Envoi du flyer…' : 'Création…') : 'Créer le live'}
              </button>
              {err && <p className="err">{err}</p>}
            </form>
          </CardPanel>

          {resumable.length > 0 && (
            <CardPanel>
              <h2 style={{ fontWeight: 700, fontSize: 17, color: 'var(--txt)', marginBottom: 12 }}>Mes lives en cours</h2>
              <ul className="plain-list">
                {resumable.map((l) => (
                  <li key={l.id} className="row">
                    <div className="row-info">
                      <strong style={{ color: 'var(--txt)' }}>{l.title}</strong>
                      <span className={`chip ${l.status === 'LIVE' ? 'chip-live' : 'chip-scheduled'}`}>
                        {l.status === 'LIVE' ? 'EN DIRECT' : 'PROGRAMMÉ'}
                      </span>
                      {l.scheduledAt && l.status === 'SCHEDULED' && (
                        <span className="hint row-date">{fmtSchedule(l.scheduledAt)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => resumeLive(l)}>
                        Rejoindre
                      </button>
                      {l.status === 'SCHEDULED' && (
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={busy}
                          onClick={() => cancelSetupLive(l)}
                          title="Annuler ce live"
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardPanel>
          )}
        </div>
      </div>
    )
  }

  /* ── ready ───────────────────────────────────────────────── */
  if (phase === 'ready' && live) {
    const hasOffer = !!live.offerId
    const offerLoaded = myOffer !== undefined

    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', padding: '0 0 80px' }}>
        <StudioTopbar hostName={hostName} />
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <CardPanel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--txt)' }}>{live.title}</h2>
                <span className="chip chip-scheduled">PRÊT</span>
              </div>
              {!editingLive && (
                <button className="btn btn-sm" onClick={startEditLive} title="Modifier">
                  <IconEdit /> Modifier
                </button>
              )}
            </div>

            {live.description && !editingLive && (
              <p className="hint" style={{ marginBottom: 8 }}>{live.description}</p>
            )}
            {live.scheduledAt && !editingLive && (
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCalendar style={{ width: 12, height: 12 }} /> {fmtSchedule(live.scheduledAt)}
              </p>
            )}

            {editingLive && (
              <div className="edit-form">
                <div className="field">
                  <label>Titre</label>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    className="field-textarea"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveLiveEdit} disabled={busy}>
                    <IconCheck /> Enregistrer
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditingLive(false)}>Annuler</button>
                </div>
              </div>
            )}

            {!editingLive && (
              <>
                <p className="hint" style={{ marginTop: 14 }}>Partagez ce lien avec votre audience :</p>
                <div className="share-row">
                  <code>{live.shareUrl ?? live.shareCode ?? live.id}</code>
                  <button className="btn btn-sm" onClick={copyShare} type="button">
                    {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
                <button className="btn btn-primary btn-xl" onClick={goLive} disabled={busy} style={{ marginTop: 16 }}>
                  <span className="live-dot" style={{ width: 7, height: 7 }} /> Passer à l'antenne
                </button>
                <p className="hint" style={{ fontSize: 12, marginTop: 8 }}>Caméra + micro seront activés (720p max).</p>
              </>
            )}

            {err && <p className="err">{err}</p>}

            {!editingLive && (
              <div className="danger-zone">
                <button className="btn btn-sm btn-danger" onClick={cancelReadyLive} disabled={busy}>
                  <IconTrash /> Annuler ce live
                </button>
              </div>
            )}
          </CardPanel>

          <CardPanel>
            <h2 style={{ fontWeight: 700, fontSize: 17, color: 'var(--txt)', marginBottom: 12 }}>Flyer promotionnel</h2>
            {live.flyerUrl && (
              <div className="flyer-preview-wrap">
                <img src={live.flyerUrl} alt="Flyer" className="flyer-preview" />
              </div>
            )}
            <p className="hint" style={{ marginBottom: 12 }}>
              {live.flyerUrl ? 'Remplacez le flyer (JPEG / PNG / WebP, max 5 Mo).' : 'Ajoutez un flyer pour donner envie (JPEG / PNG / WebP, max 5 Mo).'}
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                Choisir un fichier
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={(e) => setFlyerFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {flyerFile && (
                <>
                  <span className="hint" style={{ fontSize: 12 }}>{flyerFile.name}</span>
                  <button className="btn btn-amber btn-sm" onClick={uploadFlyer} disabled={flyerBusy}>
                    {flyerBusy ? 'Envoi…' : 'Envoyer'}
                  </button>
                </>
              )}
            </div>
            {flyerErr && <p className="err">{flyerErr}</p>}
          </CardPanel>

          <CardPanel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <IconTag style={{ width: 16, height: 16, color: 'var(--muted)' }} />
              <h2 style={{ fontWeight: 700, fontSize: 17, color: 'var(--txt)' }}>Accès au live</h2>
            </div>

            {hasOffer && myOffer ? (
              <>
                <div className="offer-status">
                  <span className="chip chip-paid">PAYANT</span>
                  <span className="hint">
                    {myOffer.monthlyPriceFcfa ? `${formatFcfa(myOffer.monthlyPriceFcfa)}/mois` : myOffer.weeklyPriceFcfa ? `${formatFcfa(myOffer.weeklyPriceFcfa)}/sem` : ''}
                    {myOffer.accessMode === 'FILLEUL_ONLY' && ' · filleuls uniquement'}
                  </span>
                </div>
                <p className="hint">Les spectateurs devront s'abonner pour rejoindre ce live.</p>
                <button className="btn btn-sm" onClick={detachOffer} disabled={busy} style={{ marginTop: 10 }}>
                  Rendre ce live gratuit
                </button>
              </>
            ) : myOffer ? (
              <>
                <p className="hint">Ce live est <strong style={{ color: 'var(--txt)' }}>libre (gratuit)</strong>. Attachez votre offre pour le rendre payant.</p>
                <div className="offer-status" style={{ marginTop: 10 }}>
                  <span className="chip">VOTRE OFFRE</span>
                  <span className="hint">{myOffer.monthlyPriceFcfa ? `${formatFcfa(myOffer.monthlyPriceFcfa)}/mois` : myOffer.weeklyPriceFcfa ? `${formatFcfa(myOffer.weeklyPriceFcfa)}/sem` : ''}</span>
                </div>
                <button className="btn btn-amber" onClick={attachOffer} disabled={busy || !offerLoaded} style={{ marginTop: 10 }}>
                  Rendre payant · {myOffer.monthlyPriceFcfa ? `${formatFcfa(myOffer.monthlyPriceFcfa)}/mois` : myOffer.weeklyPriceFcfa ? `${formatFcfa(myOffer.weeklyPriceFcfa)}/sem` : 'offre'}
                </button>
              </>
            ) : offerLoaded ? (
              <>
                <p className="hint">
                  Ce live est <strong style={{ color: 'var(--txt)' }}>libre (gratuit)</strong>. Pour créer une offre payante, gérez votre offre depuis votre profil (≥ 10 000 filleuls SBC).
                </p>
                <Link to="/profile" className="btn btn-sm" style={{ marginTop: 10 }}>Gérer mon offre →</Link>
              </>
            ) : (
              <p className="hint">Chargement de l'offre…</p>
            )}
          </CardPanel>
        </div>
      </div>
    )
  }

  /* ── ended ───────────────────────────────────────────────── */
  if (phase === 'ended') {
    return (
      <div className="tw-center-page">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '40px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>Émission terminée</h2>
          <p className="hint">Durée : {elapsed}</p>
          <Link to="/catalog" className="btn btn-primary">Retour au catalogue</Link>
        </div>
      </div>
    )
  }

  /* ── live console ────────────────────────────────────────── */
  const { messages: chatMessages, send: sendChat } = useChat(room, hostName || 'Hôte')

  const remotes = Array.from(room.remoteParticipants.values())
  const onStage = remotes.filter(
    (p) => p.trackPublications.size > 0 || p.permissions?.canPublish === true,
  )
  const viewers = Math.max(parts.length, remotes.length + 1)
  const micOn = room.localParticipant.isMicrophoneEnabled
  const camOn = room.localParticipant.isCameraEnabled
  const modIds = new Set(moderators.map((m) => m.id))

  return (
    <div className="console-shell">
      <header className="console-topbar">
        <span className="onair-pill">
          <span className="live-dot" style={{ width: 7, height: 7 }} /> ON AIR
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'monospace', flexShrink: 0 }}>{elapsed}</span>
        <h1 style={{
          fontSize: 15, fontWeight: 700, color: 'var(--txt)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {live?.title}
        </h1>
        <span style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <IconUsers /> {viewers}
        </span>
        <button className={`btn btn-icon btn-sm ${micOn ? '' : 'btn-danger'}`} onClick={toggleMic} title="Micro">
          {micOn ? <IconMic /> : <IconMicOff />}
        </button>
        <button className={`btn btn-icon btn-sm ${camOn ? '' : 'btn-danger'}`} onClick={toggleCam} title="Caméra">
          {camOn ? <IconCam /> : <IconCamOff />}
        </button>
        <button className="btn btn-sm" onClick={muteAll} disabled={busy} title="Couper tous les micros">
          <IconMicOff /> <span className="btn-label">Silence</span>
        </button>
        <button className="btn btn-sm btn-danger" onClick={endLive} disabled={busy}>Terminer</button>
      </header>

      <div className="console-body">
        <div className="console-stage">
          {room.state !== ConnectionState.Connected && (
            <p className="hint" style={{ padding: '12px 16px' }}>Connexion au serveur vidéo…</p>
          )}
          <div className={`tiles ${onStage.length === 0 ? 'tiles-solo' : ''}`} style={{ flex: 1 }}>
            <VideoTile participant={room.localParticipant} big={onStage.length === 0} />
            {onStage.map((p) => <VideoTile key={p.sid} participant={p} />)}
          </div>
          {err && <p className="err" style={{ padding: '8px 16px' }}>{err}</p>}
        </div>

        <aside className="console-sidebar">
          <div className="console-tabs">
            <button className={`console-tab${tab === 'chat' ? ' active' : ''}`} onClick={() => setTab('chat')}>
              Chat{chatMessages.length > 0 && <b className="count">{chatMessages.length}</b>}
            </button>
            <button className={`console-tab${tab === 'hands' ? ' active' : ''}`} onClick={() => setTab('hands')}>
              <IconHand /> Mains{hands.length > 0 && <b className="count">{hands.length}</b>}
            </button>
            <button className={`console-tab${tab === 'parts' ? ' active' : ''}`} onClick={() => setTab('parts')}>
              Public
            </button>
            <button className={`console-tab${tab === 'mods' ? ' active' : ''}`} onClick={() => setTab('mods')}>
              <IconShield /> Mods{moderators.length > 0 && <b className="count">{moderators.length}</b>}
            </button>
          </div>

          <div className="console-panel">
            {tab === 'chat' && (
              <ChatPanel messages={chatMessages} onSend={sendChat} />
            )}

            {tab === 'hands' && (
              <ul className="plain-list queue">
                {hands.length === 0 && <li className="empty">aucune main levée</li>}
                {hands.map((h) => (
                  <li key={h.identity} className="queue-item">
                    <span className="qname"><IconHand /> {h.name}</span>
                    <span className="qactions">
                      <button className="btn btn-sm btn-ok" onClick={() => handAction(h.identity, 'accept')} title="Donner la parole">
                        <IconCheck />
                      </button>
                      <button className="btn btn-sm" onClick={() => handAction(h.identity, 'reject')} title="Refuser">
                        <IconX />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'parts' && (
              <ul className="plain-list queue">
                {parts.length === 0 && <li className="empty">personne pour l'instant</li>}
                {parts.map((p) => {
                  const isMod = modIds.has(p.identity)
                  return (
                    <li key={p.identity} className="queue-item">
                      <span className="qname">
                        {p.name}
                        {p.isPublisher && <span className="chip" style={{ fontSize: 10, marginLeft: 6 }}>scène</span>}
                        {isMod && <span className="mod-badge"><IconShield /> mod</span>}
                        {p.handRaised && <IconHand className="ic-amber" />}
                      </span>
                      <span className="qactions">
                        <button className="btn btn-sm" onClick={() => partAction(p.identity, 'mute')} title="Couper micro">
                          <IconMicOff />
                        </button>
                        {p.isPublisher
                          ? <button className="btn btn-sm" onClick={() => partAction(p.identity, 'demote')} title="Renvoyer au public">↓</button>
                          : <button className="btn btn-sm btn-ok" onClick={() => partAction(p.identity, 'promote')} title="Inviter sur scène">↑</button>
                        }
                        <button
                          className={`btn btn-sm ${isMod ? 'btn-amber' : ''}`}
                          onClick={() => isMod ? removeMod(p.identity) : appointMod(p.identity)}
                          title={isMod ? 'Retirer modérateur' : 'Nommer modérateur'}
                        >
                          <IconShield />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => partAction(p.identity, 'kick')} title="Exclure">
                          <IconX />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            {tab === 'mods' && (
              <div className="queue">
                <p className="hint" style={{ padding: '12px 16px', borderBottom: '1px dashed var(--border)', fontSize: 12 }}>
                  Les modérateurs peuvent gérer les mains et les participants.
                </p>
                <ul className="plain-list" style={{ marginTop: 8 }}>
                  {moderators.length === 0 && <li className="empty">aucun modérateur désigné</li>}
                  {moderators.map((m) => (
                    <li key={m.id} className="queue-item queue-item-mod">
                      <span className="qname">
                        {m.avatarUrl && <img src={m.avatarUrl} alt="" className="mod-avatar" />}
                        <IconShield className="ic-amber" style={{ flex: 'none' }} />
                        {m.displayName}
                      </span>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeMod(m.id)}
                        disabled={busy}
                        title="Retirer les droits de modération"
                      >
                        <IconX />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="hint" style={{ padding: '12px 16px', fontSize: 11 }}>
                  Pour nommer un modérateur, allez dans l'onglet Participants et cliquez sur <IconShield style={{ width: 11, height: 11 }} />.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function StudioTopbar({ hostName }: { hostName: string }) {
  return (
    <header className="tw-topbar" style={{ position: 'sticky' }}>
      <Link to="/catalog" className="tw-logo">
        <img src="/logo/IMG_0477.PNG" alt="SBC Live" />
      </Link>
      <span style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          className="live-dot"
          style={{ animationPlayState: 'paused', background: 'var(--muted)', boxShadow: 'none' }}
        />
        RÉGIE{hostName ? ` · ${hostName}` : ''}
      </span>
    </header>
  )
}
