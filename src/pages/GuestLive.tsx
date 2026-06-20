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
import { createViewerRoom, useChat, useRoomTick } from '../lib/livekit'
import { formatFcfa, type GuestEntry, type Live, type Paywall, type SubscriptionResponse, type TokenResponse } from '../lib/types'

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

  // Resolve the share code. Use userApi if authenticated so the JWT is sent
  // (needed for /lives/catalog-level access later), but the endpoint is public.
  useEffect(() => {
    let gone = false
    const api = isAuthenticated ? userApi : guestApi
    api
      .get<Live>(`/lives/code/${shareCode}`)
      .then((l) => {
        if (gone) return
        setLive(l)
        // If authenticated, skip name entry
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

  // Authenticated viewer: POST /lives/:id/token
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
        // Live not yet running → waiting
        setPhase('waiting')
      } else {
        setErr(e instanceof ApiError ? e.message : String(e))
        setPhase('notfound')
      }
    } finally {
      connecting.current = false
    }
  }

  // Guest entry: POST /lives/code/:shareCode/guest
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

  // While waiting, retry every 5s
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

  async function subscribe() {
    if (!paywall) return
    setSubscribing(true)
    try {
      const { checkoutUrl } = await userApi.post<SubscriptionResponse>('/subscriptions', {
        offerId: paywall.offerId,
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
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleMic = () =>
    room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
  const toggleCam = () =>
    room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)

  /* ── renders ─────────────────────────────────────────────── */

  if (phase === 'loading') {
    return (
      <div className="page page-narrow center">
        <p className="hint mono rise">recherche du live…</p>
      </div>
    )
  }

  if (phase === 'notfound') {
    return (
      <div className="page page-narrow center">
        <div className="panel rise center-panel">
          <h2 className="display">LIVE INTROUVABLE</h2>
          {err && <p className="err mono">{err}</p>}
          <Link to="/" className="btn">
            Accueil
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'paywall') {
    return (
      <div className="page page-narrow center">
        <div className="panel rise center-panel">
          <span className="mono kicker">
            <span className="led led-amber" /> ACCÈS RESTREINT
          </span>
          <h2 className="display">{live?.title ?? 'LIVE PAYANT'}</h2>
          {paywall ? (
            <>
              <p className="hint">{paywall.message}</p>
              {paywall.canPurchase ? (
                <>
                  <button
                    className="btn btn-amber btn-xl"
                    disabled={subscribing}
                    onClick={subscribe}
                  >
                    {subscribing
                      ? 'Redirection…'
                      : `S'abonner · ${formatFcfa(paywall.monthlyPriceFcfa)}/mois`}
                  </button>
                  {err && <p className="err mono">{err}</p>}
                </>
              ) : (
                <p className="hint mono">{paywall.message}</p>
              )}
            </>
          ) : (
            <p className="hint">Connectez-vous avec votre compte SBC pour vous abonner.</p>
          )}
          <Link to="/" className="btn">
            Accueil
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'name') {
    return (
      <div className="page page-narrow center">
        <form className="panel rise center-panel" onSubmit={submitName}>
          <span className="mono kicker">
            <span className="led led-red" /> VOUS REJOIGNEZ
          </span>
          <h2 className="display">{live?.title ?? 'LIVE SBC'}</h2>
          <label className="field">
            <span className="mono">Votre nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Jean"
              autoFocus
            />
          </label>
          <button className="btn btn-red" disabled={busy || !name.trim()}>
            Entrer
          </button>
          {err && <p className="err mono">{err}</p>}
        </form>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className="page page-narrow center">
        <div className="panel rise center-panel">
          <span className="mono kicker pulse">
            <span className="led led-amber" /> EN ATTENTE DE L'ANIMATEUR
          </span>
          <h2 className="display">{live?.title}</h2>
          <p className="hint">Le direct n'a pas encore commencé — vous entrerez automatiquement.</p>
        </div>
      </div>
    )
  }

  if (phase === 'ended') {
    return (
      <div className="page page-narrow center">
        <div className="panel rise center-panel">
          <h2 className="display">LIVE TERMINÉ</h2>
          <p className="hint">L'animateur a mis fin au direct. Merci d'avoir participé !</p>
          <Link to="/" className="btn">
            Accueil
          </Link>
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
    <div className="guest">
      <header className="console-bar">
        <div className="bar-left">
          <span className="onair">
            <span className="led led-white" /> EN DIRECT
          </span>
          <h1 className="bar-title">{live?.title}</h1>
        </div>
        <div className="bar-right">
          <span className="mono stat">
            <IconUsers /> {audienceCount}
          </span>
          {!room.canPlaybackAudio && (
            <button className="btn btn-amber" onClick={() => room.startAudio()}>
              <IconVolume /> Activer le son
            </button>
          )}
        </div>
      </header>

      {canPublish && !publishing && (
        <div className="banner rise">
          <strong>Vous avez la parole !</strong>
          <button className="btn btn-red btn-sm" onClick={goOnStage} disabled={busy}>
            <IconMic /> Activer micro & caméra
          </button>
        </div>
      )}

      <div className="guest-body">
        <main className="stage">
          <div className={`tiles ${onStage.length <= 1 && !publishing ? 'tiles-solo' : ''}`}>
            {onStage.length === 0 && !publishing && (
              <div className="tile tile-big tile-wait">
                <div className="tile-void">
                  <span className="mono">l'animateur arrive…</span>
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
          {err && <p className="err mono">{err}</p>}
        </main>

        <ChatPanel messages={chatMessages} onSend={sendChat} />
      </div>

      <footer className="guest-bar">
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
            <span className="mono hint">vous êtes sur scène</span>
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
      </footer>
    </div>
  )
}
