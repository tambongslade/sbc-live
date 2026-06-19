import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, userApi } from '../lib/api'
import type { CatalogLive } from '../lib/types'

const POLL_INTERVAL = 3000
const MAX_POLLS = 10 // 30s

export default function SubscriptionReturn() {
  const { subscriptionId } = useParams()
  const nav = useNavigate()
  const [polls, setPolls] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (polls >= MAX_POLLS || confirmed) return
    const t = setTimeout(async () => {
      try {
        const lives = await userApi.get<CatalogLive[]>('/lives/catalog')
        const anyGranted = lives.some((l) => l.access.granted && l.offerId)
        if (anyGranted) {
          setConfirmed(true)
          setTimeout(() => nav('/catalog'), 1500)
          return
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          nav('/')
          return
        }
      }
      setPolls((n) => n + 1)
    }, POLL_INTERVAL)
    return () => clearTimeout(t)
  }, [polls, confirmed, nav])

  const timeLeft = Math.max(0, MAX_POLLS - polls) * (POLL_INTERVAL / 1000)

  return (
    <div className="page page-narrow center">
      <div className="panel rise center-panel">
        {confirmed ? (
          <>
            <span className="led" style={{ width: 16, height: 16 }} />
            <h2 className="display">ACCÈS ACTIVÉ</h2>
            <p className="hint">Votre abonnement est actif. Redirection…</p>
          </>
        ) : polls < MAX_POLLS ? (
          <>
            <span className="led led-amber" style={{ width: 16, height: 16 }} />
            <h2 className="display">PAIEMENT REÇU</h2>
            <p className="hint">
              Confirmation de l'abonnement en cours — cela peut prendre quelques secondes.
            </p>
            <p className="mono hint">
              Vérification automatique… ({timeLeft}s restantes)
            </p>
            <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
              {subscriptionId}
            </span>
          </>
        ) : (
          <>
            <span className="led" style={{ width: 16, height: 16 }} />
            <h2 className="display">PAIEMENT REÇU</h2>
            <p className="hint">
              Votre paiement a été transmis à SBC. L'activation peut prendre quelques instants
              supplémentaires — revenez au catalogue et rafraîchissez si l'accès n'est pas encore
              disponible.
            </p>
          </>
        )}

        <Link to="/catalog" className="btn btn-red">
          Retour au catalogue
        </Link>
      </div>
    </div>
  )
}
