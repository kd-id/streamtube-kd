import './StatCard.css';

export default function StatCard({ icon: Icon, label, value, trend, trendUp, color = 'blue' }) {
  return (
    <div className={`stat-card glass-card`}>
      <div className={`stat-icon stat-icon-${color}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
      {trend !== undefined && (
        <span className={`stat-trend ${trendUp ? 'up' : 'down'}`}>
          {trendUp ? '↑' : '↓'} {trend}%
        </span>
      )}
    </div>
  );
}
