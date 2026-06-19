// ── Enums ────────────────────────────────────────────────────

export type UserRole = 'VIEWER' | 'CREATOR' | 'MODERATOR' | 'ADMIN'
export type LiveStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
export type OfferAccessMode = 'OPEN_TO_ALL' | 'FILLEUL_ONLY'
export type LiveRole = 'host' | 'moderator' | 'speaker' | 'viewer'
export type SbcTier = 'CLASSIQUE' | 'CIBLE' | 'RELANCE' | 'VISIBILITE_MAX'

export type AccessReason =
  | 'admin_free'
  | 'public'
  | 'host'
  | 'subscribed'
  | 'filleul'
  | 'filleul_tier_waiver'
  | 'subscription_required'
  | 'filleuls_only'
  | 'offer_inactive'

// ── Core models ──────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  role: UserRole
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}

export interface SsoAuthorizeResponse {
  url: string
  state: string
}

export interface LiveHost {
  id: string
  displayName: string
  avatarUrl: string | null
}

export interface Live {
  id: string
  title: string
  description: string | null
  status: LiveStatus
  shareCode: string
  isAdminFree: boolean
  offerId: string | null
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  hlsUrl: string | null
  recordingKey: string | null
  hostId: string
  host: LiveHost
  createdAt: string
  updatedAt: string
  shareUrl?: string
}

export interface Paywall {
  offerId: string
  monthlyPriceFcfa: number
  accessMode: OfferAccessMode
  waiverTiers: SbcTier[]
  canPurchase: boolean
  message: string
}

export interface AccessDecision {
  granted: boolean
  reason: AccessReason
  paywall?: Paywall
}

export interface CatalogLive extends Live {
  access: AccessDecision
}

export interface StartResponse {
  live: Live
  token: string
  url: string
}

export interface TokenResponse {
  token: string
  url: string
  role: LiveRole
}

export interface GuestEntry {
  guest: { id: string; displayName: string }
  accessToken: string
  live: Live
  token: string | null
  url: string
  role: 'viewer'
}

export interface AccessRule {
  id: string
  offerId: string
  sbcTier: SbcTier
  createdAt: string
}

export interface Offer {
  id: string
  creatorId: string
  monthlyPriceFcfa: number
  accessMode: OfferAccessMode
  isActive: boolean
  accessRules: AccessRule[]
  createdAt: string
  updatedAt: string
}

export interface SubscriptionResponse {
  subscriptionId: string
  paymentId: string
  checkoutUrl: string
}

export interface Hand {
  identity: string
  name: string
}

export interface ParticipantRow {
  identity: string
  name: string
  isPublisher: boolean
  handRaised: boolean
}

// ── Utilities ────────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const rec = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}

export function normHand(raw: unknown): Hand {
  const h = rec(raw)
  const identity = str(h.identity) ?? str(h.id) ?? str(h.userId) ?? ''
  return { identity, name: str(h.name) ?? str(h.displayName) ?? identity }
}

export function normParticipant(raw: unknown): ParticipantRow {
  const p = rec(raw)
  const identity = str(p.identity) ?? str(p.id) ?? str(p.userId) ?? ''
  return {
    identity,
    name: str(p.name) ?? str(p.displayName) ?? identity,
    isPublisher: p.isPublisher === true,
    handRaised: p.handRaised === true,
  }
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  )
}

export function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}
