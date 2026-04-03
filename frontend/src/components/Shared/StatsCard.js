// frontend/src/components/Shared/StatsCard.js
export default function StatsCard({ label, value, icon, color = 'blue' }) {
  return (
    <div className={`stats-card stats-card-${color}`}>
      <div className="stats-icon">{icon}</div>
      <div className="stats-body">
        <p className="stats-value">{value}</p>
        <p className="stats-label">{label}</p>
      </div>
    </div>
  );
}
