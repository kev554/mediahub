import {
  Aperture,
  Camera,
  Copy,
  Sparkles,
  FolderOpen,
  Heart,
  Home,
  Images,
  Settings2,
  Share2,
  Trash2,
  Upload,
  UsersRound,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { t } from '../../lib/i18n'

type NavItem = {
  label: string
  icon: LucideIcon
  id: string
}

type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
  onUpload: () => void
  user?: {
    username?: string
    email?: string
    display_name?: string
  }
}


const mainItems: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'photos', label: 'Photos', icon: Images },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'albums', label: 'Albums', icon: FolderOpen },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'smart-albums', label: 'Smart albums', icon: Sparkles },
]


const secondaryItems: NavItem[] = [
  { id: 'groups', label: 'Groups', icon: UsersRound },
  { id: 'shares', label: 'Shared', icon: Share2 },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
]


export function Sidebar({
  activePage,
  onNavigate,
  onUpload,
  user,
}: SidebarProps) {


  const renderItem = (item: NavItem) => {

    const active =
      activePage === item.id


    return (
      <button
        key={item.id}
        type="button"
        className={`sidebar-item ${
          active ? 'active' : ''
        }`}
        onClick={() =>
          onNavigate(item.id)
        }
      >

        <span className="sidebar-icon">
          <item.icon size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>

        <span>
          {item.label}
        </span>

      </button>
    )
  }


  const displayName =
    user?.display_name ??
    user?.username ??
    t('Mon compte', 'Account')


  return (

    <aside className="sidebar glass" aria-label="Navigation principale">


      <button
        type="button"
        className="brand"
        onClick={() =>
          onNavigate('dashboard')
        }
      >

        <span className="brand-mark">
          <Aperture size={20} strokeWidth={2.3} aria-hidden="true" />
        </span>


        <span className="brand-name">
          MediaHub
        </span>

      </button>



      <div className="sidebar-section">

        <p className="sidebar-title">
          {t('Bibliothèque', 'Library')}
        </p>


        <nav className="sidebar-nav">
          {mainItems.map((item) =>
            renderItem({
              ...item,
              label: t(
                ({
                  dashboard: 'Accueil',
                  photos: 'Photos',
                  videos: 'Vidéos',
                  camera: 'Appareil photo',
                  albums: 'Albums',
                  favorites: 'Favoris',
                  'smart-albums': 'Albums intelligents',
                } as Record<string, string>)[item.id] ?? item.label,
                item.label,
              ),
            }),
          )}
        </nav>

      </div>



      <div className="sidebar-section">

        <p className="sidebar-title">
          {t('Espace de travail', 'Workspace')}
        </p>


        <nav className="sidebar-nav">
          {secondaryItems.map((item) =>
            renderItem({
              ...item,
              label: t(
                ({
                  groups: 'Groupes',
                  shares: 'Partagés',
                  trash: 'Corbeille',
                  duplicates: 'Doublons',
                } as Record<string, string>)[item.id] ?? item.label,
                item.label,
              ),
            }),
          )}
        </nav>

      </div>

      <button
        type="button"
        className="sidebar-item"
        onClick={onUpload}
      >
        <span className="sidebar-icon">
          <Upload size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span>{t('Importer', 'Upload')}</span>
      </button>


      <div className="sidebar-spacer" />



      <button
        type="button"
        className={`sidebar-item ${
          activePage === 'settings'
            ? 'active'
            : ''
        }`}
        onClick={() =>
          onNavigate('settings')
        }
      >

        <span className="sidebar-icon">
          <Settings2 size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>

        <span>
          {t('Paramètres', 'Settings')}
        </span>

      </button>




      <button
        type="button"
        className="sidebar-profile"
        onClick={() => onNavigate('settings')}
        aria-label={t('Ouvrir les paramètres du compte', 'Open account settings')}
      >


        <div className="avatar">

          {
            displayName
              .charAt(0)
              .toUpperCase()
          }

        </div>



        <div className="profile-info">

          <strong>
            {displayName}
          </strong>


          <span>
            {t('Mon espace', 'My space')}
          </span>

        </div>

      </button>


    </aside>

  )
}
