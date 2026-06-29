import { useEffect, useRef, type FormEvent } from 'react'
import type { ChatMessage } from '../lib/livekit'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  disabled?: boolean
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
      <div className="chat-header">
        <span className="chat-header-title">Chat</span>
        {messages.length > 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{messages.length}</span>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p style={{ padding: '16px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
            Soyez le premier à écrire…
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="chat-msg">
            <span className={`chat-sender${msg.isLocal ? ' chat-sender-local' : ''}`}>
              {msg.senderName}
            </span>
            {' '}
            <span className="chat-text">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="chat-input"
          placeholder={disabled ? 'Connectez-vous pour écrire…' : 'Envoyer un message'}
          disabled={disabled}
          maxLength={400}
          autoComplete="off"
        />
        <button type="submit" className="chat-send-btn" disabled={disabled}>
          Envoyer
        </button>
      </form>
    </div>
  )
}
