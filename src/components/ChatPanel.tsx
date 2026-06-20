import { useEffect, useRef, type FormEvent } from 'react'
import type { ChatMessage } from '../lib/livekit'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  disabled?: boolean
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ChatPanel({ messages, onSend, disabled }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = inputRef.current
    if (!input) return
    const text = input.value.trim()
    if (!text) return
    onSend(text)
    input.value = ''
  }

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <span className="mono">CHAT</span>
        <span className="chat-count mono">{messages.length}</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty hint mono">Soyez le premier à écrire…</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.isLocal ? 'chat-msg-local' : ''}`}>
            <div className="chat-msg-meta">
              <span className="chat-sender">{msg.senderName}</span>
              <span className="chat-time mono">{fmt(msg.ts)}</span>
            </div>
            <p className="chat-text">{msg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="chat-input"
          placeholder={disabled ? 'Connectez-vous pour écrire…' : 'Votre message…'}
          disabled={disabled}
          maxLength={400}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-sm btn-red chat-send" disabled={disabled}>
          ↵
        </button>
      </form>
    </div>
  )
}
