import { ConnectionState } from 'livekit-client'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChatPanel } from '../components/ChatPanel'
import { VideoTile } from '../components/VideoTile'
import { ApiError, GUEST_NAME_KEY, GUEST_TOKEN_KEY, PaywallApiError, USER_KEY, USER_TOKEN_KEY, guestApi, userApi } from '../lib/api'
import {
  IconCam,
  IconCamOff,
  IconHand,
  IconMic,
  IconMicOff,
  IconUsers,
  IconVolume,
} from '../lib/icons'
import { createViewerRoom, mediaErrorMessage, useChat, useRoomTick } from '../lib/livekit'
import { formatFcfa, type BillingCycle, type GuestEntry, type Live, type Paywall, type SubscriptionResponse, type TokenResponse } from '../lib/types'

type Phase = 'loading' | 'notfound' | 'name' | 'waiting' | 'live' | 'ended' | 'paywall'

export default function GuestLive() {
  const { shareCode = '' } = useParams()
  const [room] = useState(createViewerRoom)
  useRoomTick(room)

  const isAuthenticated = !!localStorage.getItem(USER_TOKEN_KEY)

  const [phase, setPhase] = useState<Phase>('loading')
  const [live, setLive] = useState<Live | null>(null)
  const [name, setName] = useState(localStorage.getItem(GUEST_NAME_KEY) ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [paywall, setPaywall] = useState<Paywall | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY')
  const connecting = useRef(false)

  useEffect(() => {
    return () => {
      room.disconnect()
    }
  }, [room])

  useEffect(() => {
    const onDisconnected = () => setPhase((p) => (p === 'live' ? 'ended' : p))
    room.on('disconnected', onDisconnected)
    return () => {
      room.off('disconnected', onDisconnected)
    }
  }, [room])

  useEffect(() => {
    let gone = false
    const api = isAuthenticated ? userApi : guestApi
    api
      .get<Live>(`/lives/code/${shareCode}`)
      .then((l) => {
        if (gone) return
        setLive(l)
        if (isAuthenticated) {
          joinAuthenticated(l)
        } else {
          setPhase('name')
        }
      })
      .catch((e: unknown) => {
        if (gone) return
        setErr(e instanceof ApiError ? e.message : String(e))
        setPhase('notfound')
      })
    return () => {
      gone = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode])

  async function joinAuthenticated(l: Live) {
    if (connecting.current || room.state === ConnectionState.Connected) return
    connecting.current = true
    try {
      const { token: lkToken, url } = await userApi.post<TokenResponse>(`/lives/${l.id}/token`)
      await room.connect(url, lkToken)
      setPhase('live')
    } catch (e) {
      if (e instanceof PaywallApiError) {
        setPaywall(e.paywall)
        setPhase('paywall')
      } else if (e instanceof ApiError && e.status === 409) {
        setPhase('waiting')
      } else {
        setErr(e instanceof ApiError ? e.message : String(e))
        setPhase('notfound')
      }
    } finally {
      connecting.current = false
    }
  }

  const enterGuest = useCallback(
    async (displayName: string) => {
      const entry = await guestApi.post<GuestEntry>(`/lives/code/${shareCode}/guest`, {
        displayName,
      })
      if (entry.accessToken) localStorage.setItem(GUEST_TOKEN_KEY, entry.accessToken)
      localStorage.setItem(GUEST_NAME_KEY, displayName)

      if (!entry.token) {
        setPhase('waiting')
        return
      }
      if (connecting.current || room.state === ConnectionState.Connected) return
      connecting.current = true
      try {
        await room.connect(entry.url, entry.token)
        setPhase('live')
      } finally {
        connecting.current = false
      }
    },
    [room, shareCode],
  )

  function submitName(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setErr(null)
    enterGuest(n)
      .catch((er: unknown) => {
        if (er instanceof PaywallApiError) {
          setPaywall(er.paywall)
          setPhase('paywall')
        } else {
          setErr(er instanceof ApiError ? er.message : String(er))
        }
      })
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    if (phase !== 'waiting') return
    const i = setInterval(() => {
      if (isAuthenticated && live) {
        joinAuthenticated(live)
      } else {
        enterGuest(localStorage.getItem(GUEST_NAME_KEY) ?? 'Invité').catch(() => {})
      }
    }, 5000)
    return () => clearInterval(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, live, isAuthenticated])

  async function subscribe(cycle: BillingCycle = billingCycle) {
    if (!paywall) return
    setSubscribing(true)
    try {
      const { checkoutUrl } = await userApi.post<SubscriptionResponse>('/subscriptions', {
        offerId: paywall.offerId,
        billingCycle: cycle,
      })
      window.location.href = checkoutUrl
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e))
      setSubscribing(false)
    }
  }

  const raiseHand = async () => {
    if (!live) return
    setBusy(true)
    setErr(null)
    try {
      const api = isAuthenticated ? userApi : guestApi
      await api.post(`/lives/${live.id}/hand`)
      setHandRaised(true)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const goOnStage = async () => {
    setBusy(true)
    setErr(null)
    try {
      await room.localParticipant.enableCameraAndMicrophone()
      setHandRaised(false)
    } catch (e) {
      setErr(mediaErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleMic = () =>
    room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
      .catch((e: unknown) => setErr(mediaErrorMessage(e)))
  const toggleCam = () =>
    room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
      .catch((e: unknown) => setErr(mediaErrorMessage(e)))

  /* ── renders ─────────────────────────────────────────────── */

  if (phase === 'loading') {
    return (
      <div className="tw-center-page">
        <p className="hint">Recherche du live…</p>
      </div>
    )
  }

  if (phase === 'notfound') {
    return (
      <div className="tw-center-page">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '40px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>Live introuvable</h2>
          {err && <p className="err">{err}</p>}
          <Link to="/" className="btn btn-primary">Accueil</Link>
        </div>
      </div>
    )
  }

  if (phase === 'paywall') {
    return (
      <div className="tw-center-page">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '40px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Accès restreint
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>{live?.title ?? 'Live payant'}</h2>
          {paywall ? (
            <>
              <p className="hint">{paywall.message}</p>
              {paywall.canPurchase ? (
                <>
                  {paywall.billingCycles?.length > 1 ? (
                    <div className="cycle-picker" style={{ width: '100%' }}>
                      {paywall.billingCycles.map(opt => (
                        <button
                          key={opt.cycle}
                          type="button"
                          className={`cycle-btn${billingCycle === opt.cycle ? ' cycle-btn-on' : ''}`}
                          onClick={() => setBillingCycle(opt.cycle)}
                        >
                          <span className="cycle-btn-label">{opt.label}</span>
                          <span className="cycle-btn-price">{formatFcfa(opt.priceFcfa)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button
                    className="btn btn-amber btn-xl"
                    disabled={subscribing}
                    onClick={() => subscribe(billingCycle)}
                  >
                    {subscribing ? 'Redirection…' : `S'abonner · ${formatFcfa(
                      paywall.billingCycles?.find(c => c.cycle === billingCycle)?.priceFcfa
                      ?? paywall.monthlyPriceFcfa
                    )}`}
                  </button>
                  {err && <p className="err">{err}</p>}
                </>
              ) : (
                <p className="hint">{paywall.message}</p>
              )}
            </>
          ) : (
            <p className="hint">Connectez-vous avec votre compte SBC pour vous abonner.</p>
          )}
          <Link to="/" className="btn">Accueil</Link>
        </div>
      </div>
    )
  }

  if (phase === 'name') {
    return (
      <div className="tw-center-page">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '40px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Vous rejoignez
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>{live?.title ?? 'Live SBC'}</h2>
          <form onSubmit={submitName} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Votre nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Jean"
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-xl" style={{ marginTop: 0 }} disabled={busy || !name.trim()}>
              Entrer
            </button>
            {err && <p className="err">{err}</p>}
          </form>
        </div>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className="tw-center-page">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '40px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--amber)',
            textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8,
          }} className="pulse">
            <span className="live-dot" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />
            En attente de l'animateur
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>{live?.title}</h2>
          <p className="hint">Le direct n'a pas encore commencé — vous entrerez automatiquement.</p>
        </div>
      </div>
    )
  }

  if (phase === 'ended') {
    return (
      <div className="tw-center-page">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '40px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>Live terminé</h2>
          <p className="hint">L'animateur a mis fin au direct. Merci d'avoir participé !</p>
          <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  // phase === 'live'
  const storedUser = localStorage.getItem(USER_KEY)
  const viewerName = storedUser
    ? (JSON.parse(storedUser) as { displayName: string }).displayName
    : (localStorage.getItem(GUEST_NAME_KEY) ?? 'Spectateur')
  const { messages: chatMessages, send: sendChat } = useChat(room, viewerName)

  const lp = room.localParticipant
  const canPublish = lp.permissions?.canPublish === true
  const publishing = lp.isMicrophoneEnabled || lp.isCameraEnabled
  const remotes = Array.from(room.remoteParticipants.values())
  const onStage = remotes.filter((p) => p.trackPublications.size > 0)
  const audienceCount = remotes.length + 1

  return (
    <div className="player-shell">
      <header className="player-topbar">
        <Link to="/catalog" className="btn btn-sm btn-icon" style={{ flexShrink: 0 }}>←</Link>
        <span className="onair-pill">
          <span className="live-dot" style={{ width: 7, height: 7 }} /> EN DIRECT
        </span>
        <h1 style={{
          fontSize: 15, fontWeight: 700, color: 'var(--txt)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {live?.title}
        </h1>
        <span style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <IconUsers /> {audienceCount}
        </span>
        {!room.canPlaybackAudio && (
          <button className="btn btn-sm btn-amber" onClick={() => room.startAudio()}>
            <IconVolume /> Son
          </button>
        )}
      </header>

      <div className="player-body">
        <div className="player-stage">
          {canPublish && !publishing && (
            <div style={{
              background: 'rgba(24,98,240,0.15)',
              borderBottom: '1px solid rgba(24,98,240,0.3)',
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
              <strong style={{ color: 'var(--txt)', fontSize: 14 }}>Vous avez la parole !</strong>
              <button className="btn btn-primary btn-sm" onClick={goOnStage} disabled={busy}>
                <IconMic /> Activer micro & caméra
              </button>
            </div>
          )}

          <div className="player-video-wrap">
            <div className={`tiles ${onStage.length <= 1 && !publishing ? 'tiles-solo' : ''}`}>
              {onStage.length === 0 && !publishing && (
                <div className="tile tile-big tile-wait">
                  <div className="tile-void">
                    <span style={{ fontSize: 14, fontWeight: 500 }}>l'animateur arrive…</span>
                  </div>
                </div>
              )}
              {onStage.map((p, i) => (
                <VideoTile
                  key={p.sid}
                  participant={p}
                  big={i === 0 && onStage.length === 1 && !publishing}
                />
              ))}
              {publishing && <VideoTile participant={lp} />}
            </div>
          </div>

          <div className="player-info-bar">
            <div className="player-host-info">
              <div className="player-stream-title">{live?.title}</div>
              <div className="player-host-name">{(live as Live & { host?: { displayName: string } })?.host?.displayName ?? 'SBC Live'}</div>
            </div>
          </div>

          <footer className="player-footer">
            {publishing ? (
              <>
                <button
                  className={`btn btn-icon ${lp.isMicrophoneEnabled ? '' : 'btn-danger'}`}
                  onClick={toggleMic}
                  title="Micro"
                >
                  {lp.isMicrophoneEnabled ? <IconMic /> : <IconMicOff />}
                </button>
                <button
                  className={`btn btn-icon ${lp.isCameraEnabled ? '' : 'btn-danger'}`}
                  onClick={toggleCam}
                  title="Caméra"
                >
                  {lp.isCameraEnabled ? <IconCam /> : <IconCamOff />}
                </button>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>vous êtes sur scène</span>
              </>
            ) : (
              <button
                className={`btn ${handRaised ? 'btn-amber' : ''}`}
                onClick={raiseHand}
                disabled={busy || handRaised}
              >
                <IconHand /> {handRaised ? 'Main levée — patientez' : 'Lever la main'}
              </button>
            )}
            {err && <span className="err" style={{ marginLeft: 'auto' }}>{err}</span>}
          </footer>
        </div>

        <div className="player-chat-wrap">
          <ChatPanel messages={chatMessages} onSend={sendChat} />
        </div>
      </div>
    </div>
  )
}
