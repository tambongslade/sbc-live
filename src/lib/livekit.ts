import { createLocalTracks, Room, RoomEvent, VideoPresets, type LocalTrack } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  senderName: string
  text: string
  ts: number
  isLocal: boolean
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function useChat(room: Room, localName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    function onData(payload: Uint8Array, participant?: { identity: string; name?: string | null }) {
      try {
        const { type, text, name } = JSON.parse(decoder.decode(payload)) as {
          type: string; text: string; name: string
        }
        if (type !== 'chat' || !text?.trim()) return
        setMessages((prev) => [
          ...prev,
          {
            id: `r-${Date.now()}-${idRef.current++}`,
            senderName: name || participant?.identity || 'Anonyme',
            text: text.trim(),
            ts: Date.now(),
            isLocal: false,
          },
        ])
      } catch { /* ignore malformed packets */ }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => { room.off(RoomEvent.DataReceived, onData) }
  }, [room])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || room.state !== 'connected') return
    const payload = encoder.encode(JSON.stringify({ type: 'chat', text: trimmed, name: localName }))
    await room.localParticipant.publishData(payload, { reliable: true })
    setMessages((prev) => [
      ...prev,
      { id: `l-${Date.now()}-${idRef.current++}`, senderName: localName, text: trimmed, ts: Date.now(), isLocal: true },
    ])
  }, [room, localName])

  return { messages, send }
}

/** Actionable French message for a getUserMedia/device failure, or the raw message otherwise. */
export function mediaErrorMessage(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return "Accès caméra/micro refusé. Autorisez la caméra et le micro dans les réglages du site (icône cadenas de la barre d'adresse), puis réessayez. Si vous avez ouvert ce lien depuis WhatsApp, Facebook ou Instagram, ouvrez-le plutôt dans Chrome ou Safari."
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Aucune caméra ou aucun micro détecté sur cet appareil.'
    case 'NotReadableError':
    case 'TrackStartError':
      return "Caméra/micro inaccessibles : ils sont peut-être déjà utilisés par une autre application. Fermez-la puis réessayez."
    default:
      return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Capture camera + mic BEFORE any server-side state change, so a permission
 * refusal can't leave a live started with no host video. Throws an Error whose
 * message is already user-presentable (French).
 */
export async function acquireCamMic(): Promise<LocalTrack[]> {
  if (!window.isSecureContext) {
    throw new Error('Le direct nécessite une connexion sécurisée (HTTPS).')
  }
  try {
    return await createLocalTracks({
      audio: true,
      video: { resolution: VideoPresets.h720.resolution },
    })
  } catch (e) {
    throw new Error(mediaErrorMessage(e))
  }
}

/** Host / speaker room — publishes at 720p max (server capacity is tuned for this). */
export function createHostRoom() {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  })
}

/** Audience room — receive-only until promoted; same publish defaults if promoted. */
export function createViewerRoom() {
  return new Room({
    adaptiveStream: true,
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  })
}

const TICK_EVENTS = [
  RoomEvent.ConnectionStateChanged,
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ParticipantPermissionsChanged,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.AudioPlaybackStatusChanged,
] as const

/** Re-render the component on any room activity (tracks, participants, permissions…). */
export function useRoomTick(room: Room) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    for (const e of TICK_EVENTS) room.on(e, bump)
    return () => {
      for (const e of TICK_EVENTS) room.off(e, bump)
    }
  }, [room])
}

/** mm:ss elapsed since `since` (ms epoch), ticking every second. */
export function useElapsed(since: number | null): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!since) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [since])
  if (!since) return '00:00'
  const s = Math.max(0, Math.floor((now - since) / 1000))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
