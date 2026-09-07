type MobileNavProps = {
  activePage: string
  onNavigate: (page: string) => void
}

const items = [
  { id: 'dashboard', label: 'Accueil', icon: '⌂' },
  { id: 'photos', label: 'Photos', icon: '▧' },
  { id: 'albums', label: 'Albums', icon: '◇' },
  { id: 'timeline', label: 'Timeline', icon: '◷' },
  { id: 'groups', label: 'Groupes', icon: '♧' },
]

export function MobileNav({
  activePage,
  onNavigate,
}: MobileNavProps) {
  return (
    <nav className="mobile-nav glass">
      {items.map((item) => {
        const active = activePage === item.id

        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-item ${
              active ? 'active' : ''
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="mobile-nav-icon">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
