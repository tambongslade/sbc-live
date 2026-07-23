/* Chat de live — transport serveur (socket.io, persistant, réponses +
   mentions) avec repli automatique sur le canal de données LiveKit tant
   que le serveur n'a pas répondu. */
import type { Room } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE, GUEST_NAME_KEY, GUEST_TOKEN_KEY, USER_KEY, USER_TOKEN_KEY } from './api'
import { useChat } from './livekit'

/** Origine du socket : celle de l'API (le proxy /api du dev ne porte pas le WS). */
const SOCKET_URL = API_BASE.startsWith('http')
  ? new URL(API_BASE).origin
  : 'https://api.live.sbcprecom.com'

export interface ChatSender {
  id: string
  displayName: string
  avatarUrl?: string | null
}

export interface LiveChatMessage {
  id: string
  senderName: string
  senderId?: string
  text: string
  ts: number
  isLocal: boolean
  replyTo?: { id: string; senderName: string; text: string; deleted: boolean } | null
  mentionsMe?: boolean
}

interface ServerMessage {
  id: string
  content: string
  createdAt: string
  user?: ChatSender | null
  replyTo?: { id: string; content: string; deletedAt: string | null; user?: ChatSender | null } | null
  mentions?: ChatSender[]
}

function myIdentity(): { id: string | null; name: string | null } {
  const stored = localStorage.getItem(USER_KEY)
  if (stored) {
    try {
      const u = JSON.parse(stored) as { id?: string; displayName?: string }
      return { id: u.id ?? null, name: u.displayName ?? null }
    } catch { /* ignore */ }
  }
  return { id: null, name: localStorage.getItem(GUEST_NAME_KEY) }
}

/** Simple présence de « @pseudo » dans un texte (repli LiveKit, sans serveur). */
function textMentions(text: string, name: string | null): boolean {
  if (!name) return false
  const handle = name.split(/\s+/)[0]?.toLowerCase()
  return !!handle && text.toLowerCase().includes(`@${handle}`)
}

/**
 * Chat d'un live : socket serveur dès qu'il répond (historique persistant,
 * réponses, mentions résolues), sinon canal LiveKit comme avant.
 */
export function useLiveChat(room: Room, liveId: string | undefined, localName: string) {
  const lk = useChat(room, localName)
  const [serverMsgs, setServerMsgs] = useState<LiveChatMessage[]>([])
  const [serverOk, setServerOk] = useState(false)
  const sockRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!liveId) return
    const token = localStorage.getItem(USER_TOKEN_KEY) ?? localStorage.getItem(GUEST_TOKEN_KEY)
    const me = myIdentity()

    const toMessage = (m: ServerMessage): LiveChatMessage => ({
      id: m.id,
      senderName: m.user?.displayName ?? 'Anonyme',
      senderId: m.user?.id,
      text: m.content,
      ts: Date.parse(m.createdAt) || Date.now(),
      isLocal: !!m.user && (m.user.id === me.id || (!me.id && m.user.displayName === me.name)),
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            senderName: m.replyTo.user?.displayName ?? 'Anonyme',
            text: m.replyTo.content,
            deleted: !!m.replyTo.deletedAt,
          }
        : null,
      mentionsMe: !!m.mentions?.some(
        (u) => (me.id && u.id === me.id) || (!!me.name && u.displayName === me.name),
      ),
    })

    const socket = io(SOCKET_URL, {
      auth: token ? { token } : undefined,
      query: { liveId },
    })
    sockRef.current = socket

    socket.on('connect', () => {
      socket.emit('chat:join', { liveId })
    })
    socket.on('chat:history', (list: unknown) => {
      if (!Array.isArray(list)) return
      setServerOk(true)
      setServerMsgs((list as ServerMessage[]).map(toMessage))
    })
    socket.on('chat:message', (m: ServerMessage) => {
      if (!m?.id) return
      setServerOk(true)
      setServerMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, toMessage(m)]))
    })

    return () => {
      socket.disconnect()
      sockRef.current = null
    }
  }, [liveId])

  const send = useCallback(
    (text: string, replyToId?: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const socket = sockRef.current
      if (socket?.connected) {
        socket.emit('chat:send', { liveId, content: trimmed, replyToId })
        // tant que le serveur n'a rien renvoyé, on double sur LiveKit pour
        // que les clients restés en repli voient aussi le message
        if (!serverOk) lk.send(trimmed)
      } else {
        lk.send(trimmed)
      }
    },
    [liveId, serverOk, lk],
  )

  if (serverOk) {
    return { messages: serverMsgs, send, serverChat: true }
  }
  const me = myIdentity()
  const fallback: LiveChatMessage[] = lk.messages.map((m) => ({
    ...m,
    mentionsMe: !m.isLocal && textMentions(m.text, me.name ?? localName),
  }))
  return { messages: fallback, send, serverChat: false }
}
