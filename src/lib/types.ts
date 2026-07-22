// ── Enums ────────────────────────────────────────────────────

export type UserRole = 'VIEWER' | 'CREATOR' | 'MODERATOR' | 'ADMIN'
export type LiveStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
export type OfferAccessMode = 'OPEN_TO_ALL' | 'FILLEUL_ONLY'
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
export type BillingCycle = 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type LiveRole = 'host' | 'moderator' | 'speaker' | 'viewer'
export type SbcTier = 'CLASSIQUE' | 'CIBLE' | 'RELANCE' | 'VISIBILITE_MAX' | 'TIER_15K_TBD'

export type AccessReason =
  | 'admin_free'
  | 'public'
  | 'host'
  | 'subscribed'
  | 'filleul'
  | 'filleul_tier_waiver'
  | 'tier_member'
  | 'subscription_required'
  | 'tier_required'
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
  scheduledEndAt: string | null
  startedAt: string | null
  endedAt: string | null
  hlsUrl: string | null
  recordingKey: string | null
  flyerUrl: string | null
  requiredSbcTier: SbcTier | null
  maxParticipants: number | null
  hostId: string
  host: LiveHost
  createdAt: string
  updatedAt: string
  shareUrl?: string
}

export interface BillingCycleOption {
  cycle: BillingCycle
  priceFcfa: number
  label: string
}

export interface Paywall {
  offerId: string
  monthlyPriceFcfa: number
  weeklyPriceFcfa: number | null
  annualPriceFcfa: number | null
  billingCycles: BillingCycleOption[]
  accessMode: OfferAccessMode
  waiverTiers: SbcTier[]
  canPurchase: boolean
  message: string
}

export interface AccessDecision {
  granted: boolean
  reason: AccessReason
  requiredTier?: SbcTier
  paywall?: Paywall
}

export interface CatalogLive extends Live {
  access: AccessDecision
}

export interface HomeResponse {
  ongoing: CatalogLive[]
  scheduled: CatalogLive[]
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

export interface CreatorLevel {
  level: number
  minFilleuls: number
  maxDurationMinutes: number
  maxParticipants: number
  label: string
}

export interface Offer {
  id: string
  creatorId: string
  title: string | null
  weeklyPriceFcfa: number | null
  monthlyPriceFcfa: number | null
  annualPriceFcfa: number | null
  accessMode: OfferAccessMode
  flyerUrl: string | null
  scheduledDates: string[]
  frequencyPerWeek: number | null
  weekdays: Weekday[]
  liveStartTime: string | null
  liveEndTime: string | null
  timezone: string | null
  isActive: boolean
  accessRules: AccessRule[]
  createdAt: string
  updatedAt: string
}

/** Offre listée publiquement dans la rubrique « Formation live » du catalogue. */
export interface CatalogOffer extends Offer {
  creator: { id: string; displayName: string; avatarUrl: string | null }
}

export interface OfferOptions {
  billingCycles: { value: BillingCycle; label: string }[]
  tiers: { value: string; label: string; priceFcfa: number }[]
  weekdays: { value: Weekday; label: string }[]
  minFrequency: number
  maxFrequency: number
  startTimeMin: string
  startTimeMax: string
  flyer: { recommendedWidth: number; recommendedHeight: number; minWidth: number; minHeight: number }
  creatorLevels: CreatorLevel[]
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
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

export const WEEKDAY_LABELS: Record<string, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
}

export const ALL_WEEKDAYS: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export const TIER_LABELS: Record<string, string> = {
  CLASSIQUE: 'Classique · 2 150 FCFA',
  CIBLE: 'Cible · 5 000 FCFA',
  TIER_15K_TBD: 'Tier 15 000 FCFA',
  RELANCE: 'Relance',
  VISIBILITE_MAX: 'Visibilité Max · 50 000 FCFA',
}

export const TIER_PRICES: Record<string, string> = {
  CLASSIQUE: '2 150',
  CIBLE: '5 000',
  TIER_15K_TBD: '15 000',
}
