import { ConnectionState } from 'livekit-client'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { VideoTile } from '../components/VideoTile'
import { ApiError, USER_KEY, USER_TOKEN_KEY, userApi } from '../lib/api'
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
  type Hand,
  type Live,
  type LiveHost,
  type Offer,
  type ParticipantRow,
  type StartResponse,
  type TokenResponse,
} from '../lib/types'

type Phase = 'setup' | 'ready' | 'live' | 'ended'
type SidebarTab = 'hands' | 'parts' | 'mods'

interface EligibilityError {
  status: 403 | 503
  message: string
}

function fmtSchedule(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminLive() {
  const nav = useNavigate()
  const token = localStorage.getItem(USER_TOKEN_KEY)
  useEffect(() => { if (!token) nav('/') }, [token, nav])

  const [room] = useState(createHostRoom)
  useRoomTick(room)

  // ── phase & live ──────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup')
  const [live, setLive] = useState<Live | null>(null)
  const [myLives, setMyLives] = useState<Live[]>([])
  const [myOffer, setMyOffer] = useState<Offer | null | undefined>(undefined)

  // ── setup form ────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // ── ready: inline edit ────────────────────────────────────
  const [editingLive, setEditingLive] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // ── live sidebar ──────────────────────────────────────────
  const [tab, setTab] = useState<SidebarTab>('hands')
  const [hands, setHands] = useState<Hand[]>([])
  const [parts, setParts] = useState<ParticipantRow[]>([])
  const [moderators, setModerators] = useState<LiveHost[]>([])

  // ── ui state ──────────────────────────────────────────────
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
  }, [nav])

  const fail = (e: unknown) =>
    setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { fail(e) } finally { setBusy(false) }
  }

  // ── setup actions ─────────────────────────────────────────

  async function createLive(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setEligibilityError(null)
    try {
      const body: Record<string, string> = { title: title.trim() || 'Live SBC' }
      if (description.trim()) body.description = description.trim()
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString()
      const l = await userApi.post<Live>('/lives', body)
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

  const cancelSetupLive = (l: Live) => run(async () => {
    if (!confirm(`Annuler définitivement « ${l.title} » ?`)) return
    await userApi.post(`/lives/${l.id}/cancel`)
    setMyLives((prev) => prev.filter((x) => x.id !== l.id))
  })

  // ── ready actions ─────────────────────────────────────────

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

  // ── live-phase actions ────────────────────────────────────

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

  /* ── renders ─────────────────────────────────────────────── */

  if (eligibilityError) {
    return (
      <div className="page page-narrow">
        <TopBrand />
        <div className="panel rise">
          <div className="elig-header">
            <IconAlertTriangle style={{ width: 28, height: 28, color: 'var(--amber)', flex: 'none' }} />
            <h2 className="display" style={{ fontSize: 'clamp(20px,3vw,28px)' }}>
              {eligibilityError.status === 503 ? 'SERVICE INDISPONIBLE' : 'PAS ENCORE ÉLIGIBLE'}
            </h2>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>{eligibilityError.message}</p>
          {eligibilityError.status === 403 && (
            <div className="elig-req-box">
              <p className="mono" style={{ color: 'var(--muted)', marginBottom: 8 }}>Pour créer un live il vous faut :</p>
              <ul className="elig-list mono">
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
        </div>
      </div>
    )
  }

  /* ── setup ───────────────────────────────────────────────── */
  if (phase === 'setup') {
    const resumable = myLives.filter((l) => l.status === 'LIVE' || l.status === 'SCHEDULED')
    return (
      <div className="page page-narrow">
        <TopBrand />

        {/* Create form */}
        <form className="panel rise" onSubmit={createLive}>
          <div className="panel-head">
            <h2>Nouvelle émission</h2>
          </div>
          <label className="field">
            <span className="mono">Titre</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ma conférence" autoFocus />
          </label>
          <label className="field">
            <span className="mono">Description (optionnel)</span>
            <textarea
              className="field-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brève description visible dans le catalogue…"
              rows={3}
            />
          </label>
          <label className="field">
            <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCalendar style={{ width: 13, height: 13 }} /> Date &amp; heure prévues (optionnel)
            </span>
            <input
              type="datetime-local"
              className="field-datetime"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            {scheduledAt && (
              <span className="mono field-hint">
                Programmé pour le {fmtSchedule(new Date(scheduledAt).toISOString())}
              </span>
            )}
          </label>
          <button className="btn btn-red" disabled={busy}>{busy ? 'Création…' : 'Créer le live'}</button>
          {err && <p className="err mono">{err}</p>}
        </form>

        {/* Resume / cancel existing lives */}
        {resumable.length > 0 && (
          <div className="panel rise d1">
            <div className="panel-head"><h2>Mes lives en cours</h2></div>
            <ul className="plain-list">
              {resumable.map((l) => (
                <li key={l.id} className="row">
                  <div className="row-info">
                    <strong>{l.title}</strong>
                    <span className={`chip mono ${l.status === 'LIVE' ? 'chip-live' : 'chip-scheduled'}`}>
                      {l.status === 'LIVE' ? 'EN DIRECT' : 'PROGRAMMÉ'}
                    </span>
                    {l.scheduledAt && l.status === 'SCHEDULED' && (
                      <span className="hint mono row-date">{fmtSchedule(l.scheduledAt)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm" disabled={busy} onClick={() => resumeLive(l)}>
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
          </div>
        )}
      </div>
    )
  }

  /* ── ready ───────────────────────────────────────────────── */
  if (phase === 'ready' && live) {
    const hasOffer = !!live.offerId
    const offerLoaded = myOffer !== undefined

    return (
      <div className="page page-narrow">
        <TopBrand />

        {/* Main live panel */}
        <div className="panel rise">
          {/* Header: title + edit toggle */}
          <div className="panel-head" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2>{live.title}</h2>
              <span className="chip mono chip-scheduled">PRÊT</span>
            </div>
            {!editingLive && (
              <button className="btn btn-sm" onClick={startEditLive} title="Modifier">
                <IconEdit /> Modifier
              </button>
            )}
          </div>
          {live.description && !editingLive && (
            <p className="hint" style={{ marginTop: 6 }}>{live.description}</p>
          )}
          {live.scheduledAt && !editingLive && (
            <p className="mono hint" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCalendar style={{ width: 12, height: 12 }} /> {fmtSchedule(live.scheduledAt)}
            </p>
          )}

          {/* Inline edit form */}
          {editingLive && (
            <div className="edit-form">
              <label className="field">
                <span className="mono">Titre</span>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
              </label>
              <label className="field">
                <span className="mono">Description</span>
                <textarea
                  className="field-textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-red btn-sm" onClick={saveLiveEdit} disabled={busy}>
                  <IconCheck /> Enregistrer
                </button>
                <button className="btn btn-sm" onClick={() => setEditingLive(false)}>Annuler</button>
              </div>
            </div>
          )}

          {/* Share link */}
          {!editingLive && (
            <>
              <p className="hint" style={{ marginTop: 14 }}>Partagez ce lien avec votre audience :</p>
              <div className="share-row">
                <code className="mono">{live.shareUrl ?? live.shareCode ?? live.id}</code>
                <button className="btn btn-sm" onClick={copyShare} type="button">
                  {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <button className="btn btn-red btn-xl" onClick={goLive} disabled={busy}>
                <span className="led led-white" /> Passer à l'antenne
              </button>
              <p className="hint mono">Caméra + micro seront activés (720p max).</p>
            </>
          )}

          {err && <p className="err mono">{err}</p>}

          {/* Cancel live — danger zone at the bottom */}
          {!editingLive && (
            <div className="danger-zone">
              <button className="btn btn-sm btn-danger" onClick={cancelReadyLive} disabled={busy}>
                <IconTrash /> Annuler ce live
              </button>
            </div>
          )}
        </div>

        {/* Offer / access gate */}
        <div className="panel rise d1">
          <div className="panel-head">
            <IconTag />
            <h2>Accès au live</h2>
          </div>

          {hasOffer && myOffer ? (
            <>
              <div className="offer-status">
                <span className="chip mono chip-paid">PAYANT</span>
                <span className="hint">
                  {formatFcfa(myOffer.monthlyPriceFcfa)}/mois
                  {myOffer.accessMode === 'FILLEUL_ONLY' && ' · filleuls uniquement'}
                </span>
              </div>
              <p className="hint">Les spectateurs devront s'abonner pour rejoindre ce live.</p>
              <button className="btn btn-sm" onClick={detachOffer} disabled={busy}>
                Rendre ce live gratuit
              </button>
            </>
          ) : myOffer ? (
            <>
              <p className="hint">
                Ce live est <strong>libre (gratuit)</strong>. Attachez votre offre pour le rendre payant.
              </p>
              <div className="offer-status">
                <span className="chip mono">VOTRE OFFRE</span>
                <span className="hint">{formatFcfa(myOffer.monthlyPriceFcfa)}/mois</span>
              </div>
              <button className="btn btn-amber" onClick={attachOffer} disabled={busy || !offerLoaded}>
                Rendre payant · {formatFcfa(myOffer.monthlyPriceFcfa)}/mois
              </button>
            </>
          ) : offerLoaded ? (
            <>
              <p className="hint">
                Ce live est <strong>libre (gratuit)</strong>. Pour créer une offre payante,
                gérez votre offre depuis votre profil (≥ 10 000 filleuls SBC).
              </p>
              <Link to="/profile" className="btn btn-sm">Gérer mon offre →</Link>
            </>
          ) : (
            <p className="hint mono">Chargement de l'offre…</p>
          )}
        </div>
      </div>
    )
  }

  /* ── ended ───────────────────────────────────────────────── */
  if (phase === 'ended') {
    return (
      <div className="page page-narrow center">
        <div className="panel rise center-panel">
          <h2 className="display">ÉMISSION TERMINÉE</h2>
          <p className="hint">Durée : {elapsed}</p>
          <Link to="/catalog" className="btn">Retour au catalogue</Link>
        </div>
      </div>
    )
  }

  /* ── live console ────────────────────────────────────────── */
  const remotes = Array.from(room.remoteParticipants.values())
  const onStage = remotes.filter(
    (p) => p.trackPublications.size > 0 || p.permissions?.canPublish === true,
  )
  const viewers = Math.max(parts.length, remotes.length + 1)
  const micOn = room.localParticipant.isMicrophoneEnabled
  const camOn = room.localParticipant.isCameraEnabled
  const modIds = new Set(moderators.map((m) => m.id))

  return (
    <div className="console">
      <header className="console-bar">
        <div className="bar-left">
          <span className="onair"><span className="led led-white" /> ON AIR</span>
          <span className="mono timer">{elapsed}</span>
          <h1 className="bar-title">{live?.title}</h1>
        </div>
        <div className="bar-right">
          <span className="mono stat"><IconUsers /> {viewers}</span>
          <button className={`btn btn-icon ${micOn ? '' : 'btn-danger'}`} onClick={toggleMic} title="Micro">
            {micOn ? <IconMic /> : <IconMicOff />}
          </button>
          <button className={`btn btn-icon ${camOn ? '' : 'btn-danger'}`} onClick={toggleCam} title="Caméra">
            {camOn ? <IconCam /> : <IconCamOff />}
          </button>
          <button className="btn" onClick={muteAll} disabled={busy} title="Couper tous les micros">
            <IconMicOff /> <span className="btn-label">Silence général</span>
          </button>
          <button className="btn btn-red" onClick={endLive} disabled={busy}>Terminer</button>
        </div>
      </header>

      <main className="stage">
        {room.state !== ConnectionState.Connected && (
          <p className="hint mono">connexion au serveur vidéo…</p>
        )}
        <div className={`tiles ${onStage.length === 0 ? 'tiles-solo' : ''}`}>
          <VideoTile participant={room.localParticipant} big={onStage.length === 0} />
          {onStage.map((p) => <VideoTile key={p.sid} participant={p} />)}
        </div>
        {err && <p className="err mono">{err}</p>}
      </main>

      <aside className="sidebar">
        <div className="tabs tabs-3">
          <button className={tab === 'hands' ? 'tab on' : 'tab'} onClick={() => setTab('hands')}>
            <IconHand /> Mains
            {hands.length > 0 && <b className="count">{hands.length}</b>}
          </button>
          <button className={tab === 'parts' ? 'tab on' : 'tab'} onClick={() => setTab('parts')}>
            <IconUsers /> Participants
          </button>
          <button className={tab === 'mods' ? 'tab on' : 'tab'} onClick={() => setTab('mods')}>
            <IconShield /> Modérateurs
            {moderators.length > 0 && <b className="count">{moderators.length}</b>}
          </button>
        </div>

        {/* Hands tab */}
        {tab === 'hands' && (
          <ul className="plain-list queue">
            {hands.length === 0 && <li className="hint mono empty">aucune main levée</li>}
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

        {/* Participants tab */}
        {tab === 'parts' && (
          <ul className="plain-list queue">
            {parts.length === 0 && <li className="hint mono empty">personne pour l'instant</li>}
            {parts.map((p) => {
              const isMod = modIds.has(p.identity)
              return (
                <li key={p.identity} className="queue-item">
                  <span className="qname">
                    {p.name}
                    {p.isPublisher && <span className="chip mono">scène</span>}
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

        {/* Moderators tab */}
        {tab === 'mods' && (
          <div className="queue">
            <p className="mono hint" style={{ padding: '8px 0 12px', borderBottom: '1px dashed var(--line)' }}>
              Les modérateurs peuvent gérer les mains et les participants.
            </p>
            <ul className="plain-list" style={{ marginTop: 8 }}>
              {moderators.length === 0 && <li className="hint mono empty">aucun modérateur désigné</li>}
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
            <p className="hint mono" style={{ marginTop: 16, fontSize: 10.5 }}>
              Pour nommer un modérateur, allez dans l'onglet Participants et cliquez sur <IconShield style={{ width: 11, height: 11 }} />.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}

function TopBrand() {
  let who = ''
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as { displayName?: string } | null
    who = u?.displayName ?? ''
  } catch { /* ignore */ }
  return (
    <Link to="/catalog" className="topbrand mono">
      <span className="led led-red" /> SBC LIVE · RÉGIE{who ? ` · ${who}` : ''}
    </Link>
  )
}
