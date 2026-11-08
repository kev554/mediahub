import { useEffect, useState } from 'react'
import {
  Ellipsis,
  Copy,
  Camera,
  FolderOpen,
  Heart,
  Home,
  Images,
  Share2,
  Settings2,
  Sparkles,
  Trash2,
  UsersRound,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { t } from '../../lib/i18n'

type MobileNavProps = {
  activePage: string
  onNavigate: (page: string) => void
}

type NavItem = {
  id: string
  label: string
  english: string
  icon: LucideIcon
}

const primaryItems: NavItem[] = [
  { id: 'dashboard', label: 'Accueil', english: 'Home', icon: Home },
  { id: 'photos', label: 'Photos', english: 'Photos', icon: Images },
  { id: 'camera', label: 'Caméra', english: 'Camera', icon: Camera },
  { id: 'albums', label: 'Albums', english: 'Albums', icon: FolderOpen },
  { id: 'favorites', label: 'Favoris', english: 'Favorites', icon: Heart },
]

const moreItems: NavItem[] = [
  { id: 'videos', label: 'Vidéos', english: 'Videos', icon: Video },
  { id: 'smart-albums', label: 'Albums intelligents', english: 'Smart albums', icon: Sparkles },
  { id: 'groups', label: 'Groupes', english: 'Groups', icon: UsersRound },
  { id: 'shares', label: 'Partagés', english: 'Shared', icon: Share2 },
  { id: 'trash', label: 'Corbeille', english: 'Trash', icon: Trash2 },
  { id: 'duplicates', label: 'Doublons', english: 'Duplicates', icon: Copy },
  { id: 'settings', label: 'Paramètres', english: 'Settings', icon: Settings2 },
]

export function MobileNav({
  activePage,
  onNavigate,
}: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const moreActive = moreItems.some((item) => item.id === activePage)

  useEffect(() => {
    let previousScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDifference = currentScrollY - previousScrollY

      if (currentScrollY <= 0 || scrollDifference < -2) {
        setScrolling(false)
      } else if (scrollDifference > 2) {
        setScrolling(true)
      }

      previousScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  if (activePage === 'camera') {
    return null
  }

  const navigate = (page: string) => {
    setMoreOpen(false)
    onNavigate(page)
  }

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const active = activePage === item.id

    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={`mobile-nav-item ${active ? 'active' : ''}`}
        onClick={() => navigate(item.id)}
      >
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        <span>{t(item.label, item.english)}</span>
      </button>
    )
  }

  return (
    <nav
      className={`mobile-nav glass ${scrolling ? 'is-scrolling' : ''}`}
      aria-label={t('Navigation principale', 'Main navigation')}
      aria-hidden={scrolling}
      inert={scrolling}
    >
      {primaryItems.map((item) => {
        const Icon = item.icon
        const active = activePage === item.id

        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.id)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            <span>{t(item.label, item.english)}</span>
          </button>
        )
      })}

      <div className="mobile-nav-more-wrap">
        <button
          type="button"
          className={`mobile-nav-item ${moreActive ? 'active' : ''}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          aria-label={t('Plus de destinations', 'More destinations')}
        >
          <Ellipsis size={19} strokeWidth={1.8} aria-hidden="true" />
          <span>{t('Plus', 'More')}</span>
        </button>

        {moreOpen && (
          <div className="mobile-nav-more-menu glass" role="menu">
            {moreItems.map(renderItem)}
          </div>
        )}
      </div>
    </nav>
  )
}
