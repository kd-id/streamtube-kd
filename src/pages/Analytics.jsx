import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Users, Clock, TrendingUp, Activity, BarChart3, Radio, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/shared/StatCard';
import './Analytics.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="tooltip-label">{label}</span>
      <span className="tooltip-value">{payload[0].value.toLocaleString()}</span>
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState({ sessions: [], stats: { totalSessions: 0, liveSessions: 0, errorSessions: 0, totalFrames: 0 } });
  const [loading, setLoading] = useState(true);
  const [liveStreams, setLiveStreams] = useState([]);
  const [liveData, setLiveData] = useState({});

  const { token } = useAuth();

  // Fetch analytics from server
  useEffect(() => {
    if (!token) return;
    fetch('/api/analytics/streams', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!d.error) { setData(d); } setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  // Poll active streams for live data
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/analytics/streams', { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json();
        if (d.error) return;
        const active = (d.sessions || []).filter(s => s.status === 'started');
        setLiveStreams(active.map(s => ({ streamId: s.stream_id, status: 'live' })));

        for (const s of active) {
          const lr = await fetch(`/api/analytics/live/${s.stream_id}`);
          const ld = await lr.json();
          setLiveData(prev => ({
            ...prev,
            [s.stream_id]: {
              ...ld,
              history: [...(prev[s.stream_id]?.history || []).slice(-30), {
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                fps: ld.progress?.fps || 0,
                bitrate: parseFloat(ld.progress?.bitrate) || 0,
              }]
            }
          }));
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const { stats } = data;
  const hasData = stats.totalSessions > 0;
  const activeLive = liveStreams.filter(s => s.status === 'live' || s.status === 'starting');

  return (
    <div className="page">
      <h1 className="page-title">Analytics</h1>
      <p className="page-subtitle">Performa dan statistik stream real-time</p>

      <div className="grid-3 analytics-stats">
        <StatCard icon={Radio} label="Total Streams" value={stats.totalSessions} color="blue" />
        <StatCard icon={Activity} label="Live Now" value={stats.liveSessions} color="green" />
        <StatCard icon={AlertTriangle} label="Errors" value={stats.errorSessions} color="red" />
        <StatCard icon={Zap} label="Total Frames" value={stats.totalFrames.toLocaleString()} color="purple" />
      </div>

      {/* Live Stream Health */}
      {activeLive.length > 0 && (
        <div className="charts-grid">
          {activeLive.map(s => {
            const ld = liveData[s.streamId];
            return (
              <div key={s.streamId} className="glass-card chart-card">
                <h3 className="chart-title">
                  <span className="live-indicator" /> Live — {s.streamId}
                </h3>
                {ld?.progress && (
                  <div className="live-metrics">
                    <div className="live-metric"><span className="lm-label">FPS</span><span className="lm-value">{ld.progress.fps}</span></div>
                    <div className="live-metric"><span className="lm-label">Bitrate</span><span className="lm-value">{ld.progress.bitrate}</span></div>
                    <div className="live-metric"><span className="lm-label">Frames</span><span className="lm-value">{ld.progress.frame?.toLocaleString()}</span></div>
                    <div className="live-metric"><span className="lm-label">Time</span><span className="lm-value">{ld.progress.time}</span></div>
                  </div>
                )}
                {ld?.history?.length > 2 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={ld.history}>
                      <defs>
                        <linearGradient id={`fpsGrad-${s.streamId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4a8" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#2dd4a8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" tick={{ fill: '#5c5c75', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#5c5c75', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="fps" stroke="#2dd4a8" strokeWidth={2} fill={`url(#fpsGrad-${s.streamId})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stream History */}
      {hasData ? (
        <div className="glass-card" style={{ marginTop: 16 }}>
          <h3 className="chart-title">Stream History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Stream ID</th>
                  <th>Platform</th>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Frames</th>
                  <th>Peak FPS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{s.stream_id}</td>
                    <td>{s.platform || 'youtube'}</td>
                    <td>{s.started_at ? new Date(s.started_at).toLocaleString() : '-'}</td>
                    <td>{s.ended_at ? new Date(s.ended_at).toLocaleString() : <span style={{ color: 'var(--accent-green)' }}>Live</span>}</td>
                    <td>{(s.total_frames || 0).toLocaleString()}</td>
                    <td>{s.peak_fps || 0}</td>
                    <td>
                      <span className={`analytics-status ${s.status}`}>
                        {s.status === 'started' ? <><Activity size={11} /> Live</> :
                         s.status === 'ended' ? <><CheckCircle size={11} /> Ended</> :
                         <><AlertTriangle size={11} /> Error</>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card analytics-empty">
          <BarChart3 size={48} strokeWidth={1} />
          <h3>Belum Ada Data Analytics</h3>
          <p>Data analytics akan muncul setelah kamu melakukan live streaming.</p>
        </div>
      )}
    </div>
  );
}
