import { Link } from 'react-router-dom'
import { USER_KEY } from '../lib/api'
import { IconHome, IconRadio, IconUser, IconUsers } from '../lib/icons'
import type { AuthUser } from '../lib/types'

type Tab = 'home' | 'filleuls' | 'profile' | 'studio'

/** Mobile floating dock — shown on every main page, hidden on desktop. */
export function BottomNav({ active }: { active: Tab }) {
  const stored = localStorage.getItem(USER_KEY)
  let user: AuthUser | null = null
  if (stored) { try { user = JSON.parse(stored) as AuthUser } catch { /* ignore */ } }
  const canHost = user?.role === 'CREATOR' || user?.role === 'ADMIN'

  const item = (tab: Tab, to: string, label: string, icon: React.ReactNode) => (
    <Link to={to} className={`mob-nav-item${active === tab ? ' active' : ''}`}>
      {icon}
      <span>{label}</span>
    </Link>
  )

  return (
    <nav className="mob-bottom-nav">
      {item('home', '/catalog', 'Accueil', <IconHome />)}
      {item('filleuls', '/filleuls', 'Filleuls', <IconUsers />)}
      {item('profile', '/profile', 'Profil', <IconUser />)}
      {canHost && item('studio', '/admin', 'Studio', <IconRadio />)}
    </nav>
  )
}
