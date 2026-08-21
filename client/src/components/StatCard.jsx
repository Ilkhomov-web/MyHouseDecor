export default function StatCard({ icon: Icon, label, value, delta, deltaType }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div className="stat-label">{label}</div>
        {Icon && (
          <div className="stat-icon">
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {delta && <div className={`stat-delta ${deltaType || ''}`}>{delta}</div>}
    </div>
  );
}
