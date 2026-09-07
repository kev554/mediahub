type StatCardProps = {
  icon: string
  value: string | number
  label: string
  onClick?: () => void
}

export function StatCard({
  icon,
  value,
  label,
  onClick,
}: StatCardProps) {
  return (
    <button
      type="button"
      className="glass dashboard-stat"
      onClick={onClick}
    >
      <span className="dashboard-stat-icon">
        {icon}
      </span>

      <span className="dashboard-stat-content">
        <strong>{value}</strong>
        <span>{label}</span>
      </span>

      <span className="dashboard-stat-arrow">
        ›
      </span>
    </button>
  )
}
