import { useState, useEffect, useRef } from 'react';
import { Users, Eye, Clock, Video, Radio, ArrowUp, ArrowDown, Activity, Wifi, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/shared/StatCard';
import { useStream } from '../hooks/useStreamStore';
import { useYouTube } from '../hooks/useYouTubeStore';
import './Dashboard.css';

// Real network monitoring using Navigator API
function useNetworkMonitor() {
  const [stats, setStats] = useState({
    upload: 0, download: 0, ping: 0, quality: 'checking', online: navigator.onLine, type: 'unknown'
  });
  const [sysInfo, setSysInfo] = useState({ ramTotal: 0, ramPercent: 0, cpuCount: 0, cpuPercent: 0, storageTotal: 0, storageFree: 0, storageUsedPercent: 0 });
  const [history, setHistory] = useState([]);
  const prevBytes = useRef({ down: 0, up: 0, time: Date.now() });

  useEffect(() => {
    const measure = async () => {
      const online = navigator.onLine;
      if (!online) {
        setStats(s => ({ ...s, online: false, quality: 'offline' }));
        return;
      }

      // Fetch real bandwidth from backend system stats
      let dl = 0, ul = 0, cc = 0, rt = 0, rp = 0, cp = 0;
      try {
        const sysRes = await fetch('/api/system/stats', { cache: 'no-store' });
        if (sysRes.ok) {
          const data = await sysRes.json();
          dl = parseFloat(data.networkDown || '0');
          ul = parseFloat(data.networkUp || '0');
          cc = data.cpuCount || 0;
          rt = data.ramTotal || 0;
          rp = parseFloat(data.ramPercent || '0');
          cp = parseFloat(data.cpuPercent || '0');
        }
      } catch { }

      // Fetch storage info (only occasionally, but we'll do it here for simplicity)
      let stg = { t: 0, f: 0 };
      try {
        const stgRes = await fetch('/api/storage/info', { cache: 'no-store' });
        if (stgRes.ok) {
          const sdata = await stgRes.json();
          stg.t = parseFloat(sdata.totalGB || '0');
          stg.f = parseFloat(sdata.freeGB || '0');
        }
      } catch { }

      // Measure ping by fetching a small resource
      let ping = 0;
      try {
        const t0 = performance.now();
        await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        ping = Math.round(performance.now() - t0);
      } catch { ping = 0; }

      // Quality assessment
      let quality = 'poor';
      if (ul > 5 && ping < 50) quality = 'excellent';
      else if (ul > 2 && ping < 100) quality = 'good';
      else if (ul > 0.5) quality = 'fair';

      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const type = conn ? conn.effectiveType : 'unknown';

      setStats({ upload: +ul.toFixed(1), download: +dl.toFixed(1), ping, quality, online: true, type });
      setSysInfo({ 
        ramTotal: rt, ramPercent: rp, 
        cpuCount: cc, cpuPercent: cp, 
        storageTotal: stg.t, storageFree: stg.f, 
        storageUsedPercent: stg.t > 0 ? ((stg.t - stg.f) / stg.t * 100) : 0 
      });
      setHistory(prev => {
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const next = [...prev, { time: now, dl: +dl.toFixed(1), ul: +ul.toFixed(1), ping }];
        return next.slice(-20);
      });
    };

    measure();
    const iv = setInterval(measure, 5000);

    const onOnline = () => setStats(s => ({ ...s, online: true }));
    const onOffline = () => setStats(s => ({ ...s, online: false, quality: 'offline' }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => { clearInterval(iv); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  return { stats, history, sysInfo };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isLive, savedStreams } = useStream();
  const { defaultChannel, channels } = useYouTube();
  const { stats: net, history: netHistory, sysInfo } = useNetworkMonitor();
  
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState(null);

  const runSpeedtest = async () => {
    setSpeedTestRunning(true);
    try {
      const res = await fetch('/api/system/speedtest');
      const data = await res.json();
      if (data.success) {
        setSpeedTestResult(data);
      } else {
        alert('Speedtest error: ' + data.error);
      }
    } catch(err) {
      alert('Failed to run speedtest: ' + err.message);
    } finally {
      setSpeedTestRunning(false);
    }
  };

  const formatNum = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n?.toString() || '0';
  };

  const subs = defaultChannel?.subscribers || 0;
  const recentList = savedStreams.slice(-5).reverse();
  const liveStreams = savedStreams.filter(s => s.status === 'live');

  const qualityColor = { excellent: '#2dd4a8', good: '#4d8eff', fair: '#f59e0b', poor: '#ef4444', offline: '#6b7280', checking: '#6b7280' };
  const qualityLabel = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', offline: 'Offline', checking: '...' };

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Overview channel & streaming kamu</p>

      {/* Stat Cards Row */}
      <div className="grid-4 dash-stats">
        <StatCard icon={Users} label="Subscribers" value={formatNum(subs)} color="purple" />
        <StatCard icon={Eye} label="Total Streams" value={savedStreams.length} color="blue" />
        <StatCard icon={Video} label="Channels" value={channels.length} color="green" />
        <StatCard icon={Clock} label="Status" value={isLive ? 'LIVE' : 'Offline'} color={isLive ? 'red' : 'yellow'} />
      </div>

      {/* Main Grid: 2 columns */}
      <div className="dash-grid">
        <div className="dash-main">
          {/* Network Monitor Mini */}
          <div className="glass-card dash-section net-mini">
            <div className="section-header">
              <h2 className="section-title"><Wifi size={16} style={{ marginRight: 6 }} />Network Monitor</h2>
              <span className={`net-quality-badge ${net.quality}`} style={{ '--qc': qualityColor[net.quality] }}>
                {net.online
                  ? <><CheckCircle size={12} /> {qualityLabel[net.quality]} {net.type && net.type !== 'unknown' ? `(${net.type.toUpperCase()})` : ''}</>
                  : <><AlertTriangle size={12} /> Offline</>
                }
              </span>
            </div>

            <div className="net-mini-stats">
              <div className="nms-item">
                <div className="nms-icon upload"><ArrowUp size={14} /></div>
                <div className="nms-data">
                  <span className="nms-value">{net.upload}<small> Mbps</small></span>
                  <span className="nms-label">Upload</span>
                </div>
              </div>
              <div className="nms-item">
                <div className="nms-icon download"><ArrowDown size={14} /></div>
                <div className="nms-data">
                  <span className="nms-value">{net.download}<small> Mbps</small></span>
                  <span className="nms-label">Download</span>
                </div>
              </div>
              <div className="nms-item">
                <div className="nms-icon ping"><Activity size={14} /></div>
                <div className="nms-data">
                  <span className="nms-value">{net.ping}<small> ms</small></span>
                  <span className="nms-label">Latency</span>
                </div>
              </div>
            </div>

            {/* Speetest Section */}
            <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#aaa' }}>Speedtest Server VPS</span>
                <button 
                  className={`btn btn-${speedTestRunning ? 'secondary' : 'blue'} btn-sm`} 
                  onClick={runSpeedtest} 
                  disabled={speedTestRunning}
                >
                  {speedTestRunning ? 'Mengecek...' : 'Run Test'}
                </button>
              </div>
              {speedTestResult && (
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '13px' }}>
                  <div style={{flex: 1}}><ArrowDown size={12} color="#2dd4a8" style={{marginRight:4}}/> <strong>{speedTestResult.download}</strong> Mbps</div>
                  <div style={{flex: 1}}><ArrowUp size={12} color="#4d8eff" style={{marginRight:4}}/> <strong>{speedTestResult.upload}</strong> Mbps</div>
                  <div style={{flex: 1}}><Activity size={12} color="#f59e0b" style={{marginRight:4}}/> <strong>{speedTestResult.ping}</strong> ms</div>
                </div>
              )}
            </div>

            {/* Mini bandwidth chart */}
            {netHistory.length > 1 && (
              <div className="net-mini-chart">
                <svg viewBox={`0 0 ${netHistory.length * 20} 40`} preserveAspectRatio="none" className="net-spark">
                  <polyline
                    fill="none" stroke="#4d8eff" strokeWidth="1.5"
                    points={netHistory.map((p, i) => `${i * 20},${40 - Math.min(40, p.dl * 2)}`).join(' ')}
                  />
                  <polyline
                    fill="none" stroke="#2dd4a8" strokeWidth="1.5"
                    points={netHistory.map((p, i) => `${i * 20},${40 - Math.min(40, p.ul * 4)}`).join(' ')}
                  />
                </svg>
                <div className="net-spark-legend">
                  <span><span className="legend-dot" style={{ background: '#4d8eff' }} /> DL</span>
                  <span><span className="legend-dot" style={{ background: '#2dd4a8' }} /> UL</span>
                </div>
              </div>
            )}

            {/* Stream readiness indicators */}
            <div className="net-readiness">
              {[
                { label: '720p', min: 2.5 },
                { label: '1080p', min: 4.5 },
                { label: '1440p', min: 9 },
                { label: '4K', min: 20 },
              ].map(r => (
                <span key={r.label} className={`nr-tag ${net.upload >= r.min ? 'ok' : 'no'}`}>
                  {net.upload >= r.min ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          {/* VPS Specs Notification (Auto Detect) */}
          <div className="glass-card dash-section" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
             <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                 <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888' }}>RAM ({sysInfo.ramTotal > 0 ? sysInfo.ramTotal + ' GB' : '...'})</span>
                 <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{sysInfo.ramPercent}%</span>
               </div>
               <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{ height: '100%', width: `${sysInfo.ramPercent}%`, background: sysInfo.ramPercent > 85 ? '#ef4444' : sysInfo.ramPercent > 60 ? '#f59e0b' : '#2dd4a8', transition: 'width 0.5s ease' }} />
               </div>
             </div>
             
             <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                 <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888' }}>CPU ({sysInfo.cpuCount > 0 ? sysInfo.cpuCount + ' Cores' : '...'})</span>
                 <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{sysInfo.cpuPercent}%</span>
               </div>
               <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{ height: '100%', width: `${sysInfo.cpuPercent}%`, background: sysInfo.cpuPercent > 85 ? '#ef4444' : sysInfo.cpuPercent > 60 ? '#f59e0b' : '#4d8eff', transition: 'width 0.5s ease' }} />
               </div>
             </div>

             <div style={{ flex: 1 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                 <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888' }}>Storage ({sysInfo.storageTotal > 0 ? sysInfo.storageTotal + ' GB' : '...'})</span>
                 <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{sysInfo.storageUsedPercent.toFixed(1)}%</span>
               </div>
               <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{ height: '100%', width: `${sysInfo.storageUsedPercent}%`, background: sysInfo.storageUsedPercent > 85 ? '#ef4444' : sysInfo.storageUsedPercent > 60 ? '#f59e0b' : '#a855f7', transition: 'width 0.5s ease' }} />
               </div>
             </div>
          </div>

          {/* Recent Streams */}
          <div className="glass-card dash-section">
            <div className="section-header">
              <h2 className="section-title">Stream Terakhir</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/streams')}>Kelola</button>
            </div>
            {recentList.length === 0 ? (
              <div className="dash-empty-state">
                <Radio size={32} strokeWidth={1} />
                <p>Belum ada stream. Klik "Go Live" untuk memulai!</p>
              </div>
            ) : (
              <div className="stream-list">
                {recentList.map(stream => (
                  <div key={stream.id} className="stream-item">
                    <div className="stream-thumb">
                      {stream.selectedMedia?.serverFilename
                        ? <img src={`/api/video/thumbnail/${encodeURIComponent(stream.selectedMedia.serverFilename)}`} alt="" onError={e => e.target.style.display='none'} />
                        : <Video size={16} />
                      }
                    </div>
                    <div className="stream-info">
                      <span className="stream-title">{stream.title}</span>
                      <span className="stream-meta">
                        {stream.createdAt ? new Date(stream.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
                        {stream.platform && ` • ${stream.platform}`}
                      </span>
                    </div>
                    <span className={`badge badge-${stream.status}`}>
                      {stream.status === 'live' ? 'Live' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Channel Info + Quick Actions */}
        <div className="dash-side">
          {/* Connected Channels */}
          <div className="glass-card dash-section">
            <h2 className="section-title"><Radio size={16} style={{ marginRight: 6, color: '#ff0000' }} />Channel Terhubung</h2>
            {channels.length === 0 ? (
              <div className="dash-no-channel">
                <p>Belum ada channel terhubung</p>
                <button className="btn btn-blue btn-sm" onClick={() => navigate('/settings')}>
                  Hubungkan Channel
                </button>
              </div>
            ) : (
              <div className="dash-channels-list">
                {channels.map(ch => (
                  <div key={ch.id} className="dash-ch-card">
                    <div className="dash-ch-avatar">
                      {ch.avatarUrl
                        ? <img src={ch.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        : <span>{(ch.name || 'C')[0]}</span>
                      }
                    </div>
                    <div className="dash-ch-info">
                      <span className="dash-ch-name">{ch.name}</span>
                      <span className="dash-ch-handle">{ch.handle || ch.email || ''}</span>
                    </div>
                    {ch.handle && (
                      <a href={`https://youtube.com/${ch.handle}`} target="_blank" rel="noreferrer" className="dash-ch-link" title="Buka YouTube">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card dash-section">
            <h2 className="section-title">Aksi Cepat</h2>
            <div className="action-grid">
              <button className="action-btn action-live" onClick={() => navigate('/streams')}>
                <Radio size={18} />
                <span>{isLive ? 'Lihat Stream' : 'Go Live'}</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/media')}>
                <Video size={18} />
                <span>Media</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/playlist')}>
                <Eye size={18} />
                <span>Playlist</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/settings')}>
                <Users size={18} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
