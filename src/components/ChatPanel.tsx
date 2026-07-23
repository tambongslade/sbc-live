import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { LiveChatMessage } from '../lib/chat'
import { IconX } from '../lib/icons'

interface Props {
  messages: LiveChatMessage[]
  onSend: (text: string, replyToId?: string) => void
  disabled?: boolean
}

/** Met en évidence les @mentions dans le texte d'un message. */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(@[\p{L}\p{N}_.-]+)/u)
  return (
    <span className="chat-text">
      {parts.map((part, i) =>
        part.startsWith('@') ? <b key={i} className="chat-mention">{part}</b> : part,
      )}
    </span>
  )
}

export function ChatPanel({ messages, onSend, disabled }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [replyTo, setReplyTo] = useState<LiveChatMessage | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = inputRef.current
    if (!input) return
    const text = input.value.trim()
    if (!text) return
    onSend(text, replyTo?.id)
    input.value = ''
    setReplyTo(null)
  }

  function startReply(msg: LiveChatMessage) {
    setReplyTo(msg)
    inputRef.current?.focus()
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
          <div key={msg.id} className={`chat-msg${msg.mentionsMe ? ' chat-msg-mention' : ''}`}>
            {msg.replyTo && (
              <div className="chat-reply-quote">
                <span className="chat-reply-quote-sender">{msg.replyTo.senderName}</span>
                {msg.replyTo.deleted ? <i>Message supprimé</i> : msg.replyTo.text}
              </div>
            )}
            <span className={`chat-sender${msg.isLocal ? ' chat-sender-local' : ''}`}>
              {msg.senderName}
            </span>
            {' '}
            <MessageText text={msg.text} />
            {!disabled && (
              <button
                type="button"
                className="chat-reply-btn"
                title="Répondre"
                onClick={() => startReply(msg)}
              >
                ↩
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="chat-reply-banner">
          <div className="chat-reply-banner-body">
            <span className="chat-reply-quote-sender">Réponse à {replyTo.senderName}</span>
            <span className="chat-reply-banner-text">{replyTo.text}</span>
          </div>
          <button
            type="button"
            className="chat-reply-cancel"
            title="Annuler la réponse"
            onClick={() => setReplyTo(null)}
          >
            <IconX />
          </button>
        </div>
      )}

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
