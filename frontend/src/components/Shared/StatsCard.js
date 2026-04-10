// frontend/src/components/Shared/StatsCard.js
export default function StatsCard({ label, value, icon, color = 'blue', onClick }) {
  return (
    <div 
      className={`stats-card stats-card-${color}`} 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stats-icon">{icon}</div>
      <div className="stats-body">
        <p className="stats-value">{value}</p>
        <p className="stats-label">{label}</p>
      </div>
    </div>
  );
}
