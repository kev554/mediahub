type QuickActionsProps = {
  onNavigate: (page: string) => void
}

const actions = [
  {
    id: 'photos',
    icon: '▧',
    title: 'Mes photos',
    description: 'Parcourir ma galerie',
  },
  {
    id: 'videos',
    icon: '▶',
    title: 'Mes vidéos',
    description: 'Voir mes vidéos',
  },
  {
    id: 'groups',
    icon: '♧',
    title: 'Mes groupes',
    description: 'Partager avec mes proches',
  },
  {
    id: 'favorites',
    icon: '♡',
    title: 'Mes favoris',
    description: 'Mes médias préférés',
  },
]

export function QuickActions({
  onNavigate,
}: QuickActionsProps) {
  return (
    <article className="glass dashboard-panel">

      <div className="dashboard-panel-header">
        <div>
          <span className="dashboard-eyebrow">
            ORGANISATION
          </span>

          <h2>Accès rapide</h2>
        </div>
      </div>

      <div className="quick-actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="quick-action"
            onClick={() => onNavigate(action.id)}
          >
            <span className="quick-action-icon">
              {action.icon}
            </span>

            <span className="quick-action-content">
              <strong>{action.title}</strong>
              <small>{action.description}</small>
            </span>

            <span className="quick-action-arrow">
              ›
            </span>
          </button>
        ))}
      </div>

    </article>
  )
}
