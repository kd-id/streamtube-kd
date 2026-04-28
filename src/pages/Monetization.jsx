import { DollarSign, Crown, Tv, TrendingUp } from 'lucide-react';
import StatCard from '../components/shared/StatCard';
import { monetizationData } from '../data/mockData';
import './Monetization.css';

export default function Monetization() {
  const { superChats, memberJoins, todayRevenue, monthRevenue } = monetizationData;

  return (
    <div className="page">
      <h1 className="page-title">Monetization</h1>
      <p className="page-subtitle">Kelola pendapatan dan interaksi monetisasi</p>

      <div className="grid-3 monet-stats">
        <StatCard icon={DollarSign} label="Revenue Hari Ini" value={`$${todayRevenue.toFixed(2)}`} color="green" />
        <StatCard icon={TrendingUp} label="Revenue Bulan Ini" value={`$${monthRevenue.toFixed(2)}`} color="blue" />
        <StatCard icon={Crown} label="New Members" value={memberJoins.length} color="purple" />
      </div>

      <div className="monet-grid">
        <div className="glass-card monet-section">
          <h2 className="section-title">🎉 Super Chat Feed</h2>
          <div className="sc-list">
            {superChats.map(sc => (
              <div key={sc.id} className="sc-item" style={{ borderLeftColor: sc.color }}>
                <div className="sc-header">
                  <span className="sc-user">{sc.user}</span>
                  <span className="sc-amount-tag" style={{ background: sc.color + '22', color: sc.color }}>
                    ${sc.amount.toFixed(2)}
                  </span>
                  <span className="sc-time">{sc.time}</span>
                </div>
                <p className="sc-message">{sc.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="monet-side">
          <div className="glass-card monet-section">
            <h2 className="section-title">👑 Member Baru</h2>
            <div className="member-list">
              {memberJoins.map(m => (
                <div key={m.id} className="member-item">
                  <div className="member-avatar"><Crown size={14} /></div>
                  <div className="member-info">
                    <span className="member-name">{m.user}</span>
                    <span className="member-tier">{m.tier}</span>
                  </div>
                  <span className="member-time">{m.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card monet-section">
            <h2 className="section-title">📺 Ad Break</h2>
            <p className="ad-desc">Jalankan mid-roll ad break selama live stream</p>
            <button className="btn btn-blue ad-btn">
              <Tv size={16} /> Jalankan Ad Break
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
