import type { ReactNode } from 'react'

type NavItem = {
  label: string
  icon: ReactNode
  id: string
}

type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
  user?: {
    username?: string
    email?: string
    display_name?: string
  }
}


const mainItems: NavItem[] = [
  { id: 'dashboard', label: 'Accueil', icon: <span>⌂</span> },
  { id: 'photos', label: 'Photos', icon: <span>▧</span> },
  { id: 'videos', label: 'Vidéos', icon: <span>▶</span> },
  { id: 'albums', label: 'Albums', icon: <span>◇</span> },
  { id: 'timeline', label: 'Timeline', icon: <span>◷</span> },
  { id: 'favorites', label: 'Favoris', icon: <span>♡</span> },
]


const secondaryItems: NavItem[] = [
  { id: 'groups', label: 'Groupes', icon: <span>♧</span> },
  { id: 'shares', label: 'Partages', icon: <span>↗</span> },
]


export function Sidebar({
  activePage,
  onNavigate,
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
          {item.icon}
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
    'Kevin'


  return (

    <aside className="sidebar glass">


      <button
        type="button"
        className="brand"
        onClick={() =>
          onNavigate('dashboard')
        }
      >

        <span className="brand-mark">
          M
        </span>


        <span className="brand-name">
          Media<span>Hub</span>
        </span>

      </button>



      <div className="sidebar-section">

        <p className="sidebar-title">
          Bibliothèque
        </p>


        <nav className="sidebar-nav">
          {mainItems.map(renderItem)}
        </nav>

      </div>



      <div className="sidebar-section">

        <p className="sidebar-title">
          Partage
        </p>


        <nav className="sidebar-nav">
          {secondaryItems.map(renderItem)}
        </nav>

      </div>



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
          ⚙
        </span>

        <span>
          Paramètres
        </span>

      </button>




      <div className="sidebar-profile">


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
            Mon espace
          </span>

        </div>



        <button
          type="button"
          className="profile-menu"
          aria-label="Menu profil"
        >
          •••
        </button>


      </div>


    </aside>

  )
}
