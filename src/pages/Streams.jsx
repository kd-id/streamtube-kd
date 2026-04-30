import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Play, Square, Edit2, Trash2, X, Radio,
  Wifi, Gauge, MonitorPlay, AlertTriangle, Users, ExternalLink,
  Image as ImageIcon, Clock, DollarSign, Tag, ChevronDown, Film,
  Music, ListMusic, Terminal, Link2, Key, Copy, Check, RefreshCw, RotateCcw,
  Smartphone, Monitor, Info, CheckCircle, XCircle, Share2, Upload, LayoutGrid, Bot, Wand2, Sparkles, Zap,
  Globe, Lock, Calendar
} from 'lucide-react';
import Modal from '../components/shared/Modal';
import ShareModal from '../components/ShareModal';
import { useStream } from '../hooks/useStreamStore';
import { useYouTube } from '../hooks/useYouTubeStore';
import { useMedia } from '../hooks/useMediaStore';
import { usePlaylist } from '../hooks/usePlaylistStore';
import { useOverlay } from '../hooks/useOverlayStore';
import { useAIStore } from '../hooks/useAIStore';
import { categories } from '../data/mockData';
import { streamApi } from '../services/streamApi';
import { logService, LOG_CATEGORIES } from '../services/logService';
import './Streams.css';

/* ─── Platform SVG Icons ─── */
const PlatformIcon = ({ id, size = 16 }) => {
  switch (id) {
    case 'youtube': return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="4" fill="#FF0000"/><path d="M10 8.5V16L16.5 12.25L10 8.5Z" fill="white"/></svg>
    );
    case 'facebook': return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#1877F2"/><path d="M16.5 15.5L17 12H13.5V10C13.5 9 14 8 15.5 8H17V5S15.5 4.5 14.2 4.5C11.4 4.5 9.5 6.2 9.5 9.3V12H6.5V15.5H9.5V23.8C10.3 23.9 11.1 24 12 24C12.9 24 13.7 23.9 14.5 23.8V15.5H16.5Z" fill="white"/></svg>
    );
    case 'tiktok': return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#010101"/><path d="M16.5 4.5C16.5 4.5 16.5 8 19.5 8.5V11C19.5 11 17.4 11 16.5 10V16C16.5 19 14 20.5 11.5 20.5C9 20.5 6.5 18.5 6.5 15.5C6.5 12.5 9 10.5 11.5 10.5V13.5C10.5 13.5 9.5 14.3 9.5 15.5C9.5 16.7 10.5 17.5 11.5 17.5C12.5 17.5 13.5 16.7 13.5 15.5V4.5H16.5Z" fill="white"/><path d="M16 4C16 4 16 7.5 19 8V10.5C19 10.5 17 10.5 16 9.5V15.5C16 18.5 13.5 20 11 20C8.5 20 6 18 6 15C6 12 8.5 10 11 10V12.5C10 12.5 8.5 13.3 8.5 15C8.5 16.7 10 17.5 11 17.5C12 17.5 13 16.7 13 15V4H16Z" fill="#25F4EE"/><path d="M16.8 4.3C16.8 4.3 16.8 7.8 19.8 8.3V10.8C19.8 10.8 17.8 10.8 16.8 9.8V15.8C16.8 18.8 14.3 20.3 11.8 20.3C9.3 20.3 6.8 18.3 6.8 15.3C6.8 12.3 9.3 10.3 11.8 10.3V12.8C10.8 12.8 9.3 13.6 9.3 15.3C9.3 17 10.8 17.8 11.8 17.8C12.8 17.8 13.8 17 13.8 15.3V4.3H16.8Z" fill="#FE2C55"/></svg>
    );
    case 'shopee': return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#EE4D2D"/><path d="M12 4C9.8 4 8 5.5 8 7.5V8H7C6.4 8 6 8.4 6 9V19C6 19.6 6.4 20 7 20H17C17.6 20 18 19.6 18 19V9C18 8.4 17.6 8 17 8H16V7.5C16 5.5 14.2 4 12 4ZM12 5.5C13.4 5.5 14.5 6.4 14.5 7.5V8H9.5V7.5C9.5 6.4 10.6 5.5 12 5.5ZM12 12C10.3 12 9 13.1 9 14.5C9 15.9 10.3 17 12 17C13.7 17 15 15.9 15 14.5C15 13.1 13.7 12 12 12Z" fill="white"/></svg>
    );
    case 'twitch': return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#9146FF"/><path d="M6 4L4.5 7.5V19H8.5V21H11L13 19H16L20 15V4H6ZM18 14L15.5 16.5H12L10 18.5V16.5H7V6H18V14ZM15.5 8.5V13H13.5V8.5H15.5ZM11.5 8.5V13H9.5V8.5H11.5Z" fill="white"/></svg>
    );
    default: return null;
  }
};

/* ─── Platform presets with real RTMP URLs ─── */
const PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',      color: '#ff0000', rtmp: 'rtmps://a.rtmp.youtube.com/live2' },
  { id: 'facebook',  label: 'Facebook',     color: '#1877f2', rtmp: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  { id: 'tiktok',    label: 'TikTok',       color: '#00f2ea', rtmp: 'rtmp://push-rtmp-f5-tt.tiktokcdn.com/live/' },
  { id: 'shopee',    label: 'Shopee Live',  color: '#ee4d2d', rtmp: 'rtmp://live-push.shopeelive.com/live/' },
  { id: 'twitch',    label: 'Twitch',       color: '#9146ff', rtmp: 'rtmp://live.twitch.tv/app/' },
];

/* ─── Resolution presets ─── */
const RESOLUTIONS = [
  { value: '1920x1080', label: '1080p Full HD', desc: '1920×1080 (1080p Full HD) — Butuh VPS 2+ core' },
  { value: '1280x720',  label: '720p HD ⭐',    desc: '1280×720 (720p HD) — Optimal untuk VPS 1 core' },
  { value: '854x480',   label: '480p SD',       desc: '854×480 (480p SD) — Ringan, cocok untuk audio stream' },
  { value: '640x360',   label: '360p',          desc: '640×360 (360p) — Paling ringan' },
];

/* ─── YouTube recommended bitrate per resolution ─── */
const RECOMMENDED_BITRATE = {
  '1920x1080': '4500',
  '1280x720':  '2500',
  '854x480':   '1000',
  '640x360':   '600',
};

const BITRATES = [
  { value: '6000', label: '6000 kbps (1080p60)' },
  { value: '4500', label: '4500 kbps (1080p30)' },
  { value: '4000', label: '4000 kbps (720p60)' },
  { value: '2500', label: '2500 kbps (720p30) ⭐' },
  { value: '1500', label: '1500 kbps (480p)' },
  { value: '1000', label: '1000 kbps (480p ringan)' },
  { value: '600',  label: '600 kbps (360p)' },
];

const FPS_OPTIONS = [
  { value: '60', label: '60 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '24', label: '24 FPS' },
];

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

export default function Streams() {
  const { savedStreams, createStream, updateStream, deleteStream, startStream, stopStream, tick } = useStream();
  const { channels, defaultChannel, credentials, updateChannel } = useYouTube();
  const { scenes } = useOverlay();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [healthId, setHealthId] = useState(null);
  const [streamError, setStreamError] = useState('');
  const timerRef = useRef(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ online: false, ffmpeg: false, checking: true });
  const [realStreamStatus, setRealStreamStatus] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const statusPollRef = useRef(null);
  const streamsRef = useRef(savedStreams);

  useEffect(() => {
    streamsRef.current = savedStreams;
  }, [savedStreams]);

  // Check FFmpeg availability on mount (integrated — no separate backend)
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await streamApi.checkHealth();
        setBackendStatus({ online: res.backendOnline, ffmpeg: !!res.ffmpegVersion, checking: false });
      } catch {
        setBackendStatus({ online: false, ffmpeg: false, checking: false });
      }
    };
    checkBackend();
  }, []);

  const hasLive = savedStreams.some(s => s.status === 'live');
  useEffect(() => {
    if (hasLive) { timerRef.current = setInterval(tick, 1000); }
    return () => clearInterval(timerRef.current);
  }, [hasLive, tick]);

  // Poll real stream status from backend
  useEffect(() => {
    if (healthId && backendStatus.online) {
      const poll = async () => {
        const result = await streamApi.getStreamStatus(healthId);
        setRealStreamStatus(result);

        const currentStream = streamsRef.current.find(s => s.id === healthId);
        if (currentStream && currentStream.status === 'starting' && result.status === 'live') {
          updateStream(healthId, { status: 'live', startedAt: new Date().toISOString() });
        }

        if (result.error && result.error !== window.lastStreamError) {
          logService.error(LOG_CATEGORIES.FFMPEG, `Stream Error: ${result.error}`);
          window.lastStreamError = result.error;
        }
        if (result.lastLogs?.length > 0) {
          const logText = result.lastLogs.join('\n');
          if (logText !== window.lastStreamLogs) {
            logService.debug(LOG_CATEGORIES.FFMPEG, `FFmpeg Output:\n${logText}`);
            window.lastStreamLogs = logText;
          }
        }
        try {
          const sysRes = await fetch('/api/system/stats');
          if (sysRes.ok) {
            const sysData = await sysRes.json();
            setSystemStats(sysData);
          }
        } catch { }
      };
      poll();
      statusPollRef.current = setInterval(poll, 2000);
      return () => clearInterval(statusPollRef.current);
    } else {
      setRealStreamStatus(null);
      setSystemStats(null);
    }
  }, [healthId, backendStatus.online]);

  const filtered = savedStreams.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleStart = async (id) => {
    // First validate locally
    const result = startStream(id);
    if (result && !result.success) {
      setStreamError(result.error);
      logService.warn(LOG_CATEGORIES.STREAM, `Stream validation failed: ${result.error}`);
      setTimeout(() => setStreamError(''), 4000);
      return;
    }

    setHealthId(id);
    setStreamError('');

    let stream = savedStreams.find(s => s.id === id);
    if (!stream) return;

    // YouTube API mode: refresh token + create fresh broadcast
    if (stream.mode === 'api') {
      const ch = channels.find(c => c.id === stream.channelId);
      if (!ch) {
        setStreamError('Channel not found. Please reconnect in Settings.');
        setTimeout(() => setStreamError(''), 6000);
        return;
      }

      // Auto-refresh the OAuth token
      let accessToken = ch.accessToken;
      if (ch.refreshToken && credentials.clientId && credentials.clientSecret) {
        try {
          logService.debug(LOG_CATEGORIES.YOUTUBE, 'Refreshing YouTube access token...');
          const refreshRes = await fetch('/api/youtube/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refreshToken: ch.refreshToken,
              clientId: credentials.clientId,
              clientSecret: credentials.clientSecret,
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.accessToken) {
            accessToken = refreshData.accessToken;
            // Update channel store with fresh token
            updateChannel(ch.id, { accessToken });
            logService.info(LOG_CATEGORIES.YOUTUBE, 'Access token refreshed successfully');
          }
        } catch (err) {
          logService.warn(LOG_CATEGORIES.YOUTUBE, `Token refresh failed: ${err.message}, using existing token`);
        }
      }

      logService.info(LOG_CATEGORIES.YOUTUBE, `Creating fresh YouTube broadcast for: ${stream.title}`);
      try {
        const res = await fetch('/api/youtube/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            title: stream.title,
            description: stream.description || '',
            privacy: stream.privacy || 'unlisted',
            scheduledStartTime: new Date().toISOString(),
            category: stream.category,
            tags: stream.tags || [],
            thumbnailBase64: stream.thumbnailBase64 || null,
            streamResolution: stream.resolution || '1280x720',
            streamFps: stream.fps || '30',
          }),
        });
        const bcast = await res.json();
        if (!res.ok || !bcast.success) {
          setStreamError(bcast.error || 'Failed to create YouTube broadcast');
          logService.error(LOG_CATEGORIES.YOUTUBE, `Broadcast creation failed: ${bcast.error}`);
          setTimeout(() => setStreamError(''), 6000);
          return;
        }
        // Update local stream with new broadcast credentials
        updateStream(id, {
          broadcastId: bcast.broadcastId,
          rtmpUrl: bcast.rtmpUrl,
          streamKey: bcast.streamKey,
          dashboardUrl: bcast.dashboardUrl,
          videoUrl: bcast.videoUrl,
        });
        stream = { ...stream, rtmpUrl: bcast.rtmpUrl, streamKey: bcast.streamKey, broadcastId: bcast.broadcastId };
        logService.info(LOG_CATEGORIES.YOUTUBE, `New broadcast created: ${bcast.broadcastId}, key: ${bcast.streamKey}`);
      } catch (err) {
        setStreamError(`YouTube API error: ${err.message}`);
        logService.error(LOG_CATEGORIES.YOUTUBE, `Broadcast error: ${err.message}`);
        setTimeout(() => setStreamError(''), 6000);
        return;
      }
    }

    logService.info(LOG_CATEGORIES.STREAM, `Starting stream: ${stream.title}`, {
      platform: stream.platform, rtmpUrl: stream.rtmpUrl,
    });

    const sceneData = scenes.find(sc => sc.id === stream.selectedSceneId);

    const backendResult = await streamApi.startStream({
      streamId: id,
      filename: stream.selectedMedia?.serverFilename || null,
      filePath: stream.selectedMedia?.serverPath || null,
      playlistData: stream.selectedMedia?.type === 'playlist' ? stream.selectedMedia : null,
      rtmpUrl: stream.rtmpUrl,
      streamKey: stream.streamKey,
      bitrate: stream.bitrate || '2500',
      fps: stream.fps || '30',
      resolution: stream.resolution || '1280x720',
      loopVideo: stream.loopVideo || false,
      sceneData: sceneData ? sceneData.items : null,
      adaptiveEnabled: true,
    });

    if (backendResult && !backendResult.success) {
      setStreamError(backendResult.error || 'Failed to start stream');
      logService.error(LOG_CATEGORIES.STREAM, `Stream start failed: ${backendResult.error}`);
      setTimeout(() => setStreamError(''), 6000);
    }
  };

  const handleStop = async (id) => {
    const stream = savedStreams.find(s => s.id === id);
    if (stream && stream.mode === 'api' && stream.broadcastId) {
      const ch = channels.find(c => c.id === stream.channelId);
      if (ch?.accessToken) {
        try {
          await fetch('/api/youtube/broadcast/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: ch.accessToken, broadcastId: stream.broadcastId }),
          });
          logService.info(LOG_CATEGORIES.YOUTUBE, `Broadcast dihentikan: ${stream.title}`);
        } catch (err) {
          logService.error(LOG_CATEGORIES.YOUTUBE, `Failed to end broadcast: ${err.message}`);
        }
      }
    }

    if (backendStatus.online) {
      await streamApi.stopStream(id);
    }
    stopStream(id);
    if (healthId === id) {
      setHealthId(null);
      setRealStreamStatus(null);
    }
  };

  const handleDelete = async (id) => {
    if (savedStreams.find(s => s.id === id)?.status === 'live') {
      await handleStop(id);
    }
    deleteStream(id);
    if (healthId === id) setHealthId(null);
  };

  const handleCopyShare = (stream) => {
    setShareStream(stream);
  };

  const activeHealthStream = savedStreams.find(s => s.id === healthId && s.status === 'live');

  const copyFfmpegCmd = (cmd) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  // Helper to get channel info for a stream
  const getStreamChannel = (s) => {
    if (s.channelId) return channels.find(c => c.id === s.channelId) || null;
    return defaultChannel;
  };

  // Format schedule date
  const fmtSchedule = (s) => {
    if (!s.scheduledAt) return '--';
    try {
      const d = new Date(s.scheduledAt);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '--'; }
  };

  // Dashboard URL builder
  const getDashboardUrl = (s) => {
    // Use auto-generated URL from YouTube API broadcast
    if (s.dashboardUrl) return s.dashboardUrl;
    const p = s.platform || 'youtube';
    if (p === 'youtube') return 'https://studio.youtube.com';
    if (p === 'facebook') return 'https://www.facebook.com/live/producer';
    if (p === 'tiktok') return 'https://www.tiktok.com/studio';
    if (p === 'twitch') return 'https://dashboard.twitch.tv';
    if (p === 'shopee') return 'https://seller.shopee.co.id';
    return '#';
  };

  const getDashboardLabel = (s) => {
    const p = s.platform || 'youtube';
    if (p === 'youtube') return 'YT Studio';
    if (p === 'facebook') return 'FB Live';
    if (p === 'tiktok') return 'TikTok Studio';
    if (p === 'twitch') return 'Twitch Dashboard';
    if (p === 'shopee') return 'Shopee Seller';
    return 'Dashboard';
  };

  // Pagination
  const [activeTab, setActiveTab] = useState('all');
  const [shareStream, setShareStream] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page">
      <h1 className="page-title">Streaming Status</h1>
      <p className="page-subtitle">Kelola dan monitor semua live stream kamu</p>

      {/* Error Toast */}
      {streamError && (
        <div className="stream-error-toast">
          <AlertTriangle size={14} />
          <span>{streamError}</span>
          <button onClick={() => setStreamError('')}><X size={12} /></button>
        </div>
      )}

      {/* Health Panel */}
      {activeHealthStream && (
        <div className="glass-card health-panel-main">
          <div className="hpm-header">
            <div className="hpm-title">
              <Wifi size={16} />
              <span>Stream Health — {activeHealthStream.title}</span>
              {activeHealthStream.channelId && channels.find(c => c.id === activeHealthStream.channelId) && (
                <a href={`https://youtube.com/${channels.find(c => c.id === activeHealthStream.channelId).handle}`} target="_blank" rel="noreferrer" className="hpm-channel-link">
                  <ExternalLink size={12} style={{ marginRight: '4px' }}/> {channels.find(c => c.id === activeHealthStream.channelId).name}
                </a>
              )}
              {activeHealthStream.selectedSceneId && scenes.find(s => s.id === activeHealthStream.selectedSceneId) && (
                <span className="hpm-real-badge" style={{background: 'rgba(168,85,247,0.2)', color: '#d8b4fe', marginLeft: '8px'}}>Scene: {scenes.find(s => s.id === activeHealthStream.selectedSceneId).name}</span>
              )}
              {realStreamStatus && realStreamStatus.active && (
                <span className="hpm-real-badge" style={{marginLeft: '8px'}}>FFmpeg Active</span>
              )}
            </div>
            <button className="hpm-close" onClick={() => setHealthId(null)}><X size={14} /></button>
          </div>
          {realStreamStatus && realStreamStatus.progress && realStreamStatus.progress.frame > 0 && (
            <div className="hpm-real-progress">
              <div className="hpm-rp-item"><span className="hpm-rp-label">Frame</span><span className="hpm-rp-value">{realStreamStatus.progress.frame.toLocaleString()}</span></div>
              <div className="hpm-rp-item"><span className="hpm-rp-label">FPS</span><span className="hpm-rp-value">{realStreamStatus.progress.fps}</span></div>
              <div className="hpm-rp-item"><span className="hpm-rp-label">Size</span><span className="hpm-rp-value">{realStreamStatus.progress.size}</span></div>
              <div className="hpm-rp-item"><span className="hpm-rp-label">Time</span><span className="hpm-rp-value">{realStreamStatus.progress.time}</span></div>
              <div className="hpm-rp-item"><span className="hpm-rp-label">Bitrate</span><span className="hpm-rp-value">{realStreamStatus.progress.bitrate}</span></div>
            </div>
          )}
          {realStreamStatus && realStreamStatus.error && (
            <div className="stream-error-toast" style={{ marginBottom: '12px' }}>
              <AlertTriangle size={14} />
              <span>FFmpeg Error: {realStreamStatus.error}</span>
            </div>
          )}

          <div className="hpm-metrics">
            <div className="hpm-metric">
              <div className="hpm-metric-icon"><Gauge size={16} /></div>
              <div className="hpm-metric-info">
                <span className="hpm-metric-label">Bitrate</span>
                <span className="hpm-metric-value">{realStreamStatus?.progress?.bitrate || '0 kbps'}</span>
              </div>
              <div className="hpm-bar"><div className="hpm-bar-fill" style={{ width: `${Math.min(100, ((parseFloat(realStreamStatus?.progress?.bitrate) || 0) / 6000) * 100)}%` }} /></div>
            </div>
            <div className="hpm-metric">
              <div className="hpm-metric-icon fps"><MonitorPlay size={16} /></div>
              <div className="hpm-metric-info">
                <span className="hpm-metric-label">FPS</span>
                <span className="hpm-metric-value">{realStreamStatus?.progress?.fps || 0}</span>
              </div>
              <div className="hpm-bar"><div className="hpm-bar-fill fps" style={{ width: `${((parseFloat(realStreamStatus?.progress?.fps) || 0) / 60) * 100}%` }} /></div>
            </div>
            <div className="hpm-metric">
              <div className="hpm-metric-icon" style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}><Monitor size={16} /></div>
              <div className="hpm-metric-info">
                <span className="hpm-metric-label">RAM</span>
                <span className="hpm-metric-value">{systemStats?.ramUsed || '0'} / {systemStats?.ramTotal || '0'} GB</span>
              </div>
              <div className="hpm-bar"><div className="hpm-bar-fill" style={{ width: `${systemStats?.ramPercent || 0}%`, background: '#ec4899' }} /></div>
            </div>
            <div className="hpm-metric">
              <div className="hpm-metric-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}><Terminal size={16} /></div>
              <div className="hpm-metric-info">
                <span className="hpm-metric-label">CPU</span>
                <span className="hpm-metric-value">{systemStats?.cpuPercent || '0'}%</span>
              </div>
              <div className="hpm-bar"><div className="hpm-bar-fill" style={{ width: `${systemStats?.cpuPercent || 0}%`, background: '#a855f7' }} /></div>
            </div>
          </div>

          {/* Adaptive Quality Panel — always auto */}
          {realStreamStatus?.adaptive && (
            <div className="hpm-adaptive">
              <div className="hpm-adaptive-header">
                <div className="hpm-adaptive-title">
                  <Gauge size={14} />
                  <span>Adaptive Quality</span>
                  <span className="hpm-adaptive-mode auto">🤖 Auto</span>
                </div>
                <span className={`hpm-tier-badge tier-${realStreamStatus.adaptive.currentTier}`}>
                  Tier {realStreamStatus.adaptive.currentTier} — {realStreamStatus.adaptive.tierName}
                  {realStreamStatus.adaptive.tierBitrate && ` (${realStreamStatus.adaptive.tierBitrate}kbps)`}
                </span>
              </div>
              <div className="hpm-adaptive-speed">
                <span>Bitrate:</span>
                <span className={`hpm-speed-value ${realStreamStatus.adaptive.bitrateHealth === 'good' ? 'good' : realStreamStatus.adaptive.bitrateHealth === 'fair' ? 'warn' : 'bad'}`}>
                  {realStreamStatus.adaptive.actualBitrate ? `${Math.round(realStreamStatus.adaptive.actualBitrate)} kbps` : '--'}
                  {realStreamStatus.adaptive.bitrateHealth === 'good' ? ' ✅' : realStreamStatus.adaptive.bitrateHealth === 'fair' ? ' ⚠️' : realStreamStatus.adaptive.bitrateHealth === 'poor' ? ' 🔴' : ''}
                </span>
                <span style={{fontSize:'11px',color:'var(--text-muted)',marginLeft:'6px'}}>
                  / {realStreamStatus.adaptive.tierBitrate || '?'}kbps target
                </span>
                {realStreamStatus.adaptive.speed > 0 && (
                  <span style={{fontSize:'11px',color:'var(--text-muted)',marginLeft:'8px'}}>
                    Speed: {realStreamStatus.adaptive.speed.toFixed(2)}x
                  </span>
                )}
                <span style={{fontSize:'11px',color:'var(--text-muted)',marginLeft:'8px'}}>Max: Tier {realStreamStatus.adaptive.maxTier}</span>
                {realStreamStatus.adaptive.changing && <span className="hpm-tier-changing">⏳ Changing...</span>}
              </div>
              {realStreamStatus.adaptive.tierHistory?.length > 0 && (
                <div className="hpm-tier-history">
                  {realStreamStatus.adaptive.tierHistory.slice(-3).map((h, i) => (
                    <span key={i} className="hpm-tier-event">
                      {new Date(h.time).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} Tier {h.from}→{h.to} ({h.reason})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="hpm-ffmpeg">
            <div className="hpm-ffmpeg-label"><Terminal size={12} /> FFmpeg Command & Output — {realStreamStatus?.status || 'offline'}
              <button className="hpm-ffmpeg-copy" onClick={() => copyFfmpegCmd(`ffmpeg -re -i "${activeHealthStream.selectedMedia?.name || 'input.mp4'}" -c:v libx264 -preset veryfast -b:v ${activeHealthStream.bitrate || '4000'}k -c:a aac -b:a 128k -f flv "${activeHealthStream.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2'}/${activeHealthStream.streamKey || 'xxxx'}"`)}>
                {copiedCmd ? <Check size={11} /> : <Copy size={11} />}
                {copiedCmd ? 'Copied' : 'Copy Cmd'}
              </button>
            </div>
            <code className="hpm-ffmpeg-cmd" style={{ whiteSpace: 'pre-wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>&gt; ffmpeg -re -i "{activeHealthStream.selectedMedia?.name || 'input.mp4'}" -c:v libx264 ...</span>
              <br/><br/>
              {realStreamStatus?.lastLogs ? realStreamStatus.lastLogs.slice(-6).join('\n') : 'Waiting for logs...'}
            </code>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="streams-header">
        <div className="streams-search">
          <Search size={15} />
          <input type="text" placeholder="Search streams..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => { setEditId(null); setShowCreate(true); }}>
          <Plus size={15} /> New Stream
        </button>
      </div>

      {/* Stream Table — 7 columns */}
      {filtered.length === 0 ? (
        <div className="streams-empty">
          <Radio size={40} strokeWidth={1} />
          <h3>No Streams Yet</h3>
          <p>Click "+ New Stream" to create your first stream</p>
        </div>
      ) : (
        <>
          <div className="streams-table-wrap">
            <table className="streams-table">
              <thead>
                <tr>
                  <th>STREAM NAME</th>
                  <th>PRIVACY</th>
                  <th>STATUS</th>
                  <th>CHANNEL</th>
                  <th>DASHBOARD</th>
                  <th>PLATFORM</th>
                  <th>SHARE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(s => {
                  const ch = getStreamChannel(s);
                  const plat = PLATFORMS.find(p => p.id === s.platform) || PLATFORMS[0];
                  return (
                    <tr key={s.id} className={s.status === 'live' ? 'row-live' : ''}>
                      <td>
                        <div className="st-name-cell">
                          <div className="st-thumb">
                            {s.selectedMedia?.serverFilename ? (
                                <img src={`/api/video/thumbnail/${encodeURIComponent(s.selectedMedia.serverFilename)}`} alt="" onError={(e) => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} />
                              ) : s.thumbnailUrl && !s.thumbnailUrl.startsWith('blob:') ? (
                                <img src={s.thumbnailUrl} alt="" />
                              ) : s.thumbnailBase64 ? (
                                <img src={s.thumbnailBase64} alt="" />
                              ) : s.selectedMedia?.type === 'playlist' ? (
                                <div className="st-thumb-placeholder playlist"><ListMusic size={14} /></div>
                              ) : (
                                <div className="st-thumb-placeholder"><Radio size={14} /></div>
                              )
                            }
                          </div>
                          <div className="st-name-info">
                            <span className="st-title">{s.title}</span>
                            <span className="st-meta">
                              {s.selectedMedia?.type === 'playlist'
                                ? `Playlist • ${s.selectedMedia?.videos || 0} videos • ${s.selectedMedia?.playMode || 'Sequential'}`
                                : `${s.resolution || '1280x720'} • ${s.bitrate || '2500'} kbps • ${s.fps || '30'} FPS`
                              }
                            </span>
                            <span className="st-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.8, marginTop: '2px' }}>
                              <span>Dibuat: {s.createdAt ? new Date(s.createdAt).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}) : '--'}</span>
                            </span>
                            {s.scheduleChecked && s.scheduleTime && (
                              <span className="st-meta" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <Calendar size={10} /> Scheduled: {fmtSchedule(s)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="st-privacy" title={s.privacy || 'unlisted'} style={{ opacity: 0.7, display: 'flex', justifyContent: 'center' }}>
                          {s.privacy === 'public' ? <Globe size={15} /> : s.privacy === 'private' ? <Lock size={15} /> : <Link2 size={15} />}
                        </div>
                      </td>
                      <td>
                        <div className={`st-status ${s.status}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className={`status-dot ${s.status}`} />
                            {s.status === 'live' ? 'Live' : s.status === 'starting' ? 'Starting...' : 'Offline'}
                          </div>
                          {s.status === 'live' && (
                             <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9, paddingLeft: '12px' }}>
                               {formatTime(s.elapsedSeconds || 0)}
                             </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {ch ? (
                          <div className="st-channel">
                            {ch.avatarUrl ? (
                              <img src={ch.avatarUrl} alt="" className="st-ch-avatar" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                            ) : (
                              <div className="st-ch-avatar" style={{ background: ch.avatarColor || '#4d8eff' }}>{ch.avatar || ch.name?.[0] || '?'}</div>
                            )}
                            <span>{ch.name}</span>
                          </div>
                        ) : <span className="st-muted">--</span>}
                      </td>
                      <td>
                        <a href={getDashboardUrl(s)} target="_blank" rel="noopener noreferrer" className="st-dashboard-link">
                          <PlatformIcon id={s.platform || 'youtube'} size={14} />
                          <span>{getDashboardLabel(s)}</span>
                          <ExternalLink size={10} />
                        </a>
                      </td>
                      <td>
                        <div className="st-platform">
                          <PlatformIcon id={s.platform || 'youtube'} size={16} />
                          <span>{plat.label}</span>
                        </div>
                      </td>
                      <td>
                        <button className="icon-action-btn" onClick={() => handleCopyShare(s)} title="Share Stream">
                          <Share2 size={14} />
                        </button>
                      </td>
                      <td>
                        <div className="st-actions">
                          {s.status === 'live' || s.status === 'starting' ? (
                            <button className="btn-action stop" onClick={() => handleStop(s.id)}><Square size={12} /> Stop</button>
                          ) : (
                            <button className="btn-action start" onClick={() => handleStart(s.id)}><Play size={12} /> Start</button>
                          )}
                          {(s.status === 'live' || s.status === 'starting') && healthId !== s.id && (
                            <button className="icon-action-btn" onClick={() => setHealthId(s.id)} title="Health"><Wifi size={13} /></button>
                          )}
                          <button className="icon-action-btn" onClick={() => { setEditId(s.id); setShowCreate(true); }} title="Edit" disabled={s.status === 'live' || s.status === 'starting'}><Edit2 size={13} /></button>
                          <button className="icon-action-btn danger" onClick={() => handleDelete(s.id)} title="Delete" disabled={s.status === 'live' || s.status === 'starting'}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="streams-pagination">
            <span className="sp-info">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length} streams</span>
            <div className="sp-right">
              <select className="sp-per-page" value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </div>
          </div>
        </>
      )}

      <CreateStreamModal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditId(null); }} editId={editId} />
      <ShareModal isOpen={!!shareStream} onClose={() => setShareStream(null)} stream={shareStream} getDashboardUrl={getDashboardUrl} />
    </div>
  );
}

/* ─── Create / Edit Stream Modal ─── */
function CreateStreamModal({ isOpen, onClose, editId }) {
  const { savedStreams, createStream, updateStream } = useStream();
  const { channels, defaultChannel, credentials, updateChannel } = useYouTube();
  const { files: mediaFiles, addFiles } = useMedia();
  const { playlists } = usePlaylist();
  const { scenes } = useOverlay();

  const existing = editId ? savedStreams.find(s => s.id === editId) : null;

  const [tab, setTab] = useState('manual');
  
  const [formModes, setFormModes] = useState({
    manual: { title: '', description: '', privacy: 'unlisted', category: 'People & Blogs', tags: [], tagInput: '', autoStart: false, autoStop: false, dvr: true, video360: false, delay: 'none', closedCaptions: false, unlistReplay: false },
    api:    { title: '', description: '', privacy: 'unlisted', category: 'People & Blogs', tags: [], tagInput: '', autoStart: false, autoStop: false, dvr: true, video360: false, delay: 'none', closedCaptions: false, unlistReplay: false }
  });

  const { title, description, privacy, category, tags, tagInput, autoStart, autoStop, dvr, video360, delay, closedCaptions, unlistReplay } = formModes[tab];
  const [showAdditional, setShowAdditional] = useState(false);

  const updateForm = (field, value) => {
    setFormModes(prev => ({ ...prev, [tab]: { ...prev[tab], [field]: value } }));
  };

  const setTitle = (val) => updateForm('title', val);
  const setDescription = (val) => updateForm('description', val);
  const setPrivacy = (val) => updateForm('privacy', val);
  const setCategory = (val) => updateForm('category', val);
  const setTags = (val) => updateForm('tags', val);
  const setTagInput = (val) => updateForm('tagInput', val);
  const [channelId, setChannelId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [thumbnailServerUrl, setThumbnailServerUrl] = useState(null);
  const [thumbnailBase64, setThumbnailBase64] = useState(null);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [enableMonetization, setEnableMonetization] = useState(false);
  const [loopVideo, setLoopVideo] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState(false);
  const [resolution, setResolution] = useState('1280x720');
  const [bitrate, setBitrate] = useState('2500');
  const [fps, setFps] = useState('30');
  const [orientation, setOrientation] = useState('landscape');
  const [creatingBroadcast, setCreatingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState('');

  // Select Video — per tab so API and Manual don't interfere
  const [mediaPerTab, setMediaPerTab] = useState({ manual: null, api: null });
  const selectedMedia = mediaPerTab[tab];
  const setSelectedMedia = (media) => setMediaPerTab(prev => ({ ...prev, [tab]: media }));
  const [showVideoDropdown, setShowVideoDropdown] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');
  const videoDropRef = useRef(null);

  // Thumbnail Gallery
  const [showThumbGallery, setShowThumbGallery] = useState(false);
  const galleryImages = mediaFiles.filter(f => f.type === 'image');

  // RTMP multi-platform
  const [platform, setPlatform] = useState('youtube');
  const [rtmpUrl, setRtmpUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState('');
  
  const { config: aiConfig, generateText, generateAllMeta, getEffectiveKey, getRemainingRequests } = useAIStore();
  const [generatingField, setGeneratingField] = useState(null); // 'title'|'description'|'tags'|'all'
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiKeyword, setAiKeyword] = useState('');

  const handleGenerate = async (field) => {
    try {
      const effectiveKey = getEffectiveKey(aiConfig.provider);
      if (!effectiveKey) {
        alert('AI API Key is not set. Please configure it in Settings > AI Assistants.');
        return;
      }
      setGeneratingField(field);
      
      const context = existing?.selectedMedia?.name || (tab === 'manual' ? title : 'YouTube Live Stream');
      const keywordCtx = aiKeyword ? ` Focus on these keywords: "${aiKeyword}".` : '';
      const descContext = description ? ` Current description: "${description.substring(0, 200)}".` : '';
      let prompt = '';
      if (field === 'title') {
        prompt = `You are a viral YouTube title expert. Generate 5 DIFFERENT title options for a video/live stream about "${context}".${keywordCtx}

Write the titles in American English, but strictly follow this instruction:
Gabungan antara SEO + curiosity + emosi. Make it highly engaging, slightly clickbait but honest. Max 70 characters.

Separate each title ONLY with "|||". No numbering, no quotes, no extra text.`;
      } else if (field === 'description') {
        prompt = `You are a successful YouTuber writing a description for your video/live stream titled "${context}".${keywordCtx}

Write 3 DIFFERENT full-length YouTube descriptions (each 150-300 words).

Write the descriptions in American English, but strictly follow this instruction:
Deskripsi YouTube yang SEO + natural + sedikit clickbait (gak kaku, terasa manusia). Include a hook, bullet points for value, and a natural call-to-action. Include 4-6 emojis naturally and 6-8 hashtags at the end. Do NOT sound like ChatGPT.

IMPORTANT: Separate each description with "|||". No numbering.`;
      } else if (field === 'tags') {
        prompt = `Generate 5 DIFFERENT sets of YouTube tags for this video/live stream:
Title: "${context}"${descContext}${keywordCtx}

Strictly follow this instruction:
Generate tag sesuai judul + deskripsi maksimal 20 Tag per set. Make sure they are highly relevant search terms. Mix broad terms, long-tail phrases, and niche terms.

Write the tags in English. 

IMPORTANT: Separate each set with "|||". Within each set, separate tags with commas. No numbering.`;
      }

      const result = await generateText(prompt);
      
      // Robust parsing: try ||| split first, then numbered patterns, then treat as single result
      let options = result.split('|||').map(s => s.trim()).filter(s => s.length > 0);
      
      // If only 1 result from ||| split, try splitting by numbered patterns like "1." "2." "3."
      if (options.length <= 1) {
        const numberedSplit = result.split(/\n\s*(?:\d+[\.\)]\s+|\*\*\d+[\.\)]\*\*\s*)/).map(s => s.trim()).filter(s => s.length > 20);
        if (numberedSplit.length > 1) {
          options = numberedSplit;
        }
      }
      
      // If still only 1 option and it's long enough, show it as a single suggestion
      if (options.length === 0) {
        options = [result.trim()];
      }

      setAiSuggestion({ field, options });
    } catch (err) {
      alert(`Failed to generate ${field}: ${err.message}`);
    } finally {
      setGeneratingField(null);
    }
  };

  const handleGenerateAll = async () => {
    try {
      const effectiveKey = getEffectiveKey(aiConfig.provider);
      if (!effectiveKey) {
        alert('AI API Key is not set. Please configure it in Settings > AI Assistants.');
        return;
      }
      setGeneratingField('all');
      const context = existing?.selectedMedia?.name || (tab === 'manual' ? title : 'YouTube Live Stream');
      const { title: genTitle, description: genDesc, tags: genTags } = await generateAllMeta({
        context: context || 'YouTube Live Stream',
        keywords: aiKeyword,
      });
      // Apply all three at once
      if (genTitle) setTitle(genTitle);
      if (genDesc) setDescription(genDesc);
      if (genTags?.length) setTags(genTags);
    } catch (err) {
      alert(`Failed to generate metadata: ${err.message}`);
    } finally {
      setGeneratingField(null);
    }
  };

  const applyAiSuggestion = (field, result) => {
    if (field === 'title') setTitle(result.replace(/^["']|["']$/g, '').trim());
    else if (field === 'description') setDescription(result);
    else if (field === 'tags') {
      const newTags = result.split(',').map(t => t.trim()).filter(t => t);
      setTags(newTags.slice(0, 15));
    }
    setAiSuggestion(null);
  };

  const renderAiSuggestion = (fieldName) => {
    if (aiSuggestion?.field !== fieldName || !aiSuggestion.options) return null;
    return (
      <div className="ai-suggestion-box">
        <div className="ai-suggestion-header">
          <Sparkles size={13} style={{ color: '#a855f7' }} />
          <span>AI Suggestions</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate(fieldName)} disabled={generatingField === fieldName} title="Generate Lagi" style={{ padding: '4px' }}>
              <RefreshCw size={13} className={generatingField === fieldName ? 'spin' : ''} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAiSuggestion(null)} title="Tolak" style={{ padding: '4px', color: '#f87171' }}>
              <X size={13} />
            </button>
          </div>
        </div>
        <div className="ai-suggestion-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {aiSuggestion.options.map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px' }}>
              <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{opt}</div>
              <button className="btn btn-primary btn-sm" onClick={() => applyAiSuggestion(fieldName, opt)} title="Gunakan Ini" style={{ padding: '4px', flexShrink: 0 }}>
                <Check size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const platformDropRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (videoDropRef.current && !videoDropRef.current.contains(e.target)) setShowVideoDropdown(false);
      if (platformDropRef.current && !platformDropRef.current.contains(e.target)) setShowPlatformDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (existing) {
      const mode = existing.mode || 'manual';
      setTab(mode);
      setFormModes(prev => ({
        ...prev,
        [mode]: {
          title: existing.title || '',
          description: existing.description || '',
          privacy: existing.privacy || 'unlisted',
          category: existing.category || 'People & Blogs',
          tags: existing.tags || [],
          tagInput: ''
        }
      }));
      setChannelId(existing.channelId || '');
      setThumbnailUrl(existing.thumbnailUrl || null);
      setThumbnailServerUrl(existing.thumbnailUrl && existing.thumbnailUrl.startsWith('/uploads') ? existing.thumbnailUrl : null);
      // Restore thumbnailBase64 — if missing, fetch from thumbnailUrl
      if (existing.thumbnailBase64) {
        setThumbnailBase64(existing.thumbnailBase64);
      } else if (existing.thumbnailUrl && !existing.thumbnailUrl.startsWith('blob:')) {
        fetch(existing.thumbnailUrl).then(r => r.blob()).then(blob => {
          const reader = new FileReader();
          reader.onload = (ev) => setThumbnailBase64(ev.target.result);
          reader.readAsDataURL(blob);
        }).catch(() => setThumbnailBase64(null));
      } else {
        setThumbnailBase64(null);
      }
      setEnableSchedule(!!existing.scheduledAt);
      setScheduledAt(existing.scheduledAt || '');
      setEndAt(existing.endAt || '');
      setEnableMonetization(existing.enableMonetization || false);
      // Restore selectedMedia to the correct tab
      setMediaPerTab(prev => ({ ...prev, [mode]: existing.selectedMedia || null }));
      setPlatform(existing.platform || 'youtube');
      setRtmpUrl(existing.rtmpUrl || PLATFORMS[0].rtmp);
      setStreamKey(existing.streamKey || '');
      setLoopVideo(existing.loopVideo || false);
      setSelectedSceneId(existing.selectedSceneId || '');
      
      const hasAdvChanges = existing.resolution && (existing.resolution !== '1280x720' || existing.bitrate !== '2500' || existing.fps !== '30' || existing.orientation !== 'landscape');
      setAdvancedSettings(!!hasAdvChanges);
      if (existing.resolution) setResolution(existing.resolution);
      if (existing.bitrate) setBitrate(existing.bitrate);
      if (existing.fps) setFps(existing.fps);
      if (existing.orientation) setOrientation(existing.orientation);
    } else {
      resetForm();
    }
  }, [existing, isOpen]);

  const resetForm = () => {
    setTab('manual'); 
    setFormModes({
      manual: { title: '', description: '', privacy: 'unlisted', category: 'People & Blogs', tags: [], tagInput: '', autoStart: false, autoStop: false, dvr: true, video360: false, delay: 'none', closedCaptions: false, unlistReplay: false },
      api:    { title: '', description: '', privacy: 'unlisted', category: 'People & Blogs', tags: [], tagInput: '', autoStart: false, autoStop: false, dvr: true, video360: false, delay: 'none', closedCaptions: false, unlistReplay: false }
    });
    setChannelId(defaultChannel?.id || channels[0]?.id || ''); setThumbnailUrl(null);
    setThumbnailServerUrl(null); setThumbnailBase64(null); setShowThumbGallery(false);
    setEnableSchedule(false); setScheduledAt(''); setEndAt('');
    setEnableMonetization(false); setMediaPerTab({ manual: null, api: null });
    setPlatform('youtube'); setRtmpUrl(PLATFORMS[0].rtmp);
    setStreamKey(''); setLoopVideo(false); setAdvancedSettings(false);
    setVideoSearch(''); setOrientation('landscape'); setSelectedSceneId('');
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && tags.length < 500) { setTags([...tags, t]); setTagInput(''); }
  };

  const removeTag = (i) => setTags(tags.filter((_, idx) => idx !== i));

  const handleThumbnail = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailUrl(URL.createObjectURL(file));
      setThumbnailServerUrl(null); // Wait for upload

      // Auto-upload the thumbnail
      const formData = new FormData();
      formData.append('file', file);
      try {
        const token = localStorage.getItem('streamtube_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const upRes = await fetch('/api/upload', { method: 'POST', headers, body: formData });
        const upData = await upRes.json();
        if (upData.success && upData.file) {
          setThumbnailServerUrl(upData.file.url);
          // Add to media library so it shows in gallery
          addFiles([{
            id: upData.file.filename,
            name: upData.file.originalname || upData.file.filename,
            serverFilename: upData.file.filename,
            type: 'image',
            size: upData.file.size,
            url: upData.file.url,
            createdAt: new Date().toISOString(),
          }]);
        } else {
          throw new Error(upData.error || 'Failed to upload');
        }
      } catch (err) {
        console.error('Thumbnail upload failed', err);
        alert('Gagal upload thumbnail ke server: ' + err.message);
        setThumbnailUrl(null);
        setThumbnailServerUrl(null);
        setThumbnailBase64(null);
        if (e.target) e.target.value = ''; // Reset file input
        return; // Stop here, do not proceed with base64 reading
      }

      const reader = new FileReader();
      reader.onload = (ev) => setThumbnailBase64(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGallerySelect = async (imgFile) => {
    try {
      const url = imgFile.objectUrl || imgFile.url || `/uploads/${encodeURIComponent(imgFile.serverFilename || imgFile.name)}`;
      setThumbnailUrl(url);
      setThumbnailServerUrl(url);
      setShowThumbGallery(false);
      
      // Attempt to load as base64 for YouTube API broadcast creation
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (ev) => setThumbnailBase64(ev.target.result);
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load gallery image base64', err);
    }
  };
  
  const handleRemoveThumbnail = (e) => {
    e.stopPropagation();
    setThumbnailUrl(null);
    setThumbnailServerUrl(null);
    setThumbnailBase64(null);
  };

  const handleSelectPlatform = (p) => {
    setPlatform(p.id);
    setRtmpUrl(p.rtmp);
    setShowPlatformDropdown(false);
  };

  const handleSelectPlaylist = (pl) => {
    const videos = pl.items.filter(i => i.type === 'video').length;
    const audio = pl.items.filter(i => i.type === 'music').length;
    // Enrich playlist items with server data from media library
    const enrichedItems = pl.items.map(item => {
      // Try to find the media file in the gallery by mediaId or name
      const mediaFile = mediaFiles.find(f => f.id === item.mediaId) || mediaFiles.find(f => f.name === item.name);
      return {
        ...item,
        serverPath: item.serverPath || mediaFile?.serverPath || null,
        serverFilename: item.serverFilename || mediaFile?.serverFilename || null,
      };
    });
    setSelectedMedia({ type: 'playlist', id: pl.id, name: pl.name, videos, audio, items: enrichedItems, playMode: pl.playbackMode || 'Sequential' });
    setShowVideoDropdown(false);
  };

  const handleSelectVideo = (file) => {
    setSelectedMedia({
      type: 'video',
      id: file.id,
      name: file.name,
      serverFilename: file.serverFilename || null,
      serverPath: file.serverPath || null,
      objectUrl: file.objectUrl || null,
    });
    setShowVideoDropdown(false);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setBroadcastError('');

    // YouTube API mode: auto-create broadcast + stream key
    if (tab === 'api') {
      const ch = channels.find(c => c.id === channelId);
      if (!ch?.accessToken) {
        setBroadcastError('Channel has no access token. Please reconnect your channel in Settings.');
        return;
      }
      setCreatingBroadcast(true);
      
      let accessToken = ch.accessToken;
      if (ch.refreshToken && credentials?.clientId && credentials?.clientSecret) {
        try {
          const refreshRes = await fetch('/api/youtube/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refreshToken: ch.refreshToken,
              clientId: credentials.clientId,
              clientSecret: credentials.clientSecret,
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.accessToken) {
            accessToken = refreshData.accessToken;
            updateChannel(ch.id, { accessToken });
          }
        } catch (err) {
          console.warn('Silent token refresh failed', err);
        }
      }

      try {
        const res = await fetch('/api/youtube/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: accessToken,
            title: title.trim(),
            description,
            privacy,
            scheduledStartTime: enableSchedule && scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
            category,
            tags,
            thumbnailBase64,
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          setBroadcastError(result.error || 'Failed to create YouTube broadcast');
          setCreatingBroadcast(false);
          return;
        }
        // Save with auto-generated stream key + dashboard URL
        const data = {
          title: title.trim(), description, privacy, category, tags, channelId,
          autoStart, autoStop, dvr, video360, delay, closedCaptions, unlistReplay, 
          thumbnailUrl: thumbnailServerUrl || thumbnailUrl, thumbnailBase64,
          scheduledAt: enableSchedule ? scheduledAt : null, endAt: enableSchedule ? endAt : null,
          enableMonetization, mode: 'api', resolution, bitrate, fps, selectedMedia, adaptiveEnabled: true,
          platform: 'youtube',
          rtmpUrl: result.rtmpUrl,
          streamKey: result.streamKey,
          dashboardUrl: result.dashboardUrl,
          broadcastId: result.broadcastId,
          videoUrl: result.videoUrl,
          loopVideo, orientation, selectedSceneId,
        };
        if (editId) updateStream(editId, data);
        else createStream(data);
        setCreatingBroadcast(false);
        onClose();
      } catch (err) {
        setBroadcastError(`Error: ${err.message}`);
        setCreatingBroadcast(false);
      }
      return;
    }

    // Manual RTMP mode
    const data = {
      title: title.trim(), description, privacy, category, tags, channelId,
      autoStart, autoStop, dvr, video360, delay, closedCaptions, unlistReplay, 
      thumbnailUrl: thumbnailServerUrl || thumbnailUrl,
      scheduledAt: enableSchedule ? scheduledAt : null, endAt: enableSchedule ? endAt : null,
      enableMonetization, mode: tab, resolution, bitrate, fps, selectedMedia, adaptiveEnabled: true,
      platform, rtmpUrl, streamKey, loopVideo, orientation, selectedSceneId,
    };
    if (editId) updateStream(editId, data);
    else createStream(data);
    onClose();
  };

  const selectedChannel = channels.find(c => c.id === channelId);
  const currentPlatform = PLATFORMS.find(p => p.id === platform);

  const filteredPlaylists = playlists.filter(p => p.name.toLowerCase().includes(videoSearch.toLowerCase()));
  const filteredVideos = mediaFiles.filter(f => f.type === 'video' && f.name.toLowerCase().includes(videoSearch.toLowerCase()));

  const now = new Date();
  const serverTime = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Stream">
      <div className="csm-wrapper">
        {/* Tabs */}
        <div className="csm-top-bar">
          <div className="csm-tabs">
            <button 
              className={`csm-tab ${tab === 'manual' ? 'active manual' : ''}`} 
              onClick={() => !editId && setTab('manual')}
              style={editId && tab !== 'manual' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <Radio size={13} /> Manual (RTMP)
            </button>
            <button 
              className={`csm-tab ${tab === 'api' ? 'active api' : ''}`} 
              onClick={() => !editId && setTab('api')}
              style={editId && tab !== 'api' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <svg width="14" height="10" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="4" fill="#ff0000"/><path d="M11 6.5V14L18 10.25L11 6.5Z" fill="white"/></svg>
              YouTube API
            </button>
          </div>
        </div>

        <div className="csm-body">
          {/* Left Column */}
          <div className="csm-left">
            {/* Select Video */}
            <div className="form-group csm-video-group" ref={videoDropRef}>
              <label className="form-label">Select Video</label>
              <div className="csm-video-select" onClick={() => setShowVideoDropdown(!showVideoDropdown)}>
                <span className={selectedMedia ? 'csm-video-selected' : 'csm-video-placeholder'}>
                  {selectedMedia ? selectedMedia.name : 'Choose a video...'}
                </span>
                <ChevronDown size={14} className={`csm-video-chevron ${showVideoDropdown ? 'open' : ''}`} />
              </div>
              {showVideoDropdown && (
                <div className="csm-video-dropdown">
                  <div className="csm-video-search">
                    <Search size={13} />
                    <input type="text" placeholder="Search videos..." value={videoSearch} onChange={e => setVideoSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                  </div>
                  <div className="csm-video-list">
                    {filteredPlaylists.length > 0 && (
                      <>
                        <div className="csm-video-section-label">Playlists</div>
                        {filteredPlaylists.map(pl => {
                          const v = pl.items.filter(i => i.type === 'video').length;
                          const a = pl.items.filter(i => i.type === 'music').length;
                          return (
                            <div key={`pl-${pl.id}`} className={`csm-video-item ${selectedMedia?.type === 'playlist' && selectedMedia?.id === pl.id ? 'selected' : ''}`} onClick={e => { e.stopPropagation(); handleSelectPlaylist(pl); }}>
                              <div className="csm-video-item-icon playlist"><ListMusic size={14} /></div>
                              <div className="csm-video-item-info">
                                <span className="csm-video-item-name">{pl.name}</span>
                                <span className="csm-video-item-meta">{v} videos • {a} audio</span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {filteredVideos.length > 0 && (
                      <>
                        <div className="csm-video-section-label">Videos</div>
                        {filteredVideos.map(f => (
                          <div key={`vid-${f.id}`} className={`csm-video-item ${selectedMedia?.type === 'video' && selectedMedia?.id === f.id ? 'selected' : ''}`} onClick={e => { e.stopPropagation(); handleSelectVideo(f); }}>
                            <div className="csm-video-item-icon video"><Film size={14} /></div>
                            <div className="csm-video-item-info">
                              <span className="csm-video-item-name">{f.name}</span>
                              <span className="csm-video-item-meta">{f.duration} • {(f.size / 1048576).toFixed(1)} MB</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {filteredPlaylists.length === 0 && filteredVideos.length === 0 && (
                      <div className="csm-video-empty">No media found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group" style={{ background: 'rgba(168, 85, 247, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', marginBottom: 0 }}>
                  <Sparkles size={12} /> AI Keywords (Optional)
                </label>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerateAll}
                  disabled={!!generatingField}
                  title="Generate title, description & tags in one click"
                  style={{ padding: '4px 10px', fontSize: '11px', height: '26px', gap: '4px', display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none' }}
                >
                  {generatingField === 'all'
                    ? <><RefreshCw size={11} className="spin" /> Generating...</>
                    : <><Zap size={11} /> Generate All</>}
                </button>
              </div>
              <input className="form-input" value={aiKeyword} onChange={e => setAiKeyword(e.target.value)} placeholder="e.g. gaming, tutorial, music..." style={{ fontSize: '12px', padding: '8px 10px', minHeight: '32px' }} />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
                ⚡ Generate All fills title, description &amp; tags in <strong>one API request</strong> — saves tokens &amp; uses cache. <span style={{ color: '#a855f7' }}>({getRemainingRequests()} requests remaining)</span>
              </p>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Stream Title</label>
                <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate('title')} disabled={generatingField === 'title'} style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}>
                  {generatingField === 'title' ? <RefreshCw size={12} className="spin" /> : <Wand2 size={12} />} Generate AI
                </button>
              </div>
              {renderAiSuggestion('title')}
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter stream title..." disabled={generatingField === 'title'} />
            </div>

            <div className="form-group">
              <label className="form-label">Overlay Scene</label>
              <select className="form-input" value={selectedSceneId} onChange={e => setSelectedSceneId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">None</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {tab === 'manual' && (
              <>
                {/* Stream Configuration */}
                <div className="form-group">
                  <label className="form-label">Stream Configuration</label>
                  <div className="csm-rtmp-field">
                    {/* Platform picker trigger — positioned on the left of RTMP URL */}
                    <div className="csm-rtmp-platform-btn" ref={platformDropRef}>
                      <button
                        className="csm-platform-trigger-icon"
                        onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                        title="Select Platform"
                        style={{ background: PLATFORMS.find(p => p.id === platform)?.color + '22', border: `1.5px solid ${PLATFORMS.find(p => p.id === platform)?.color}44` }}
                      >
                        <PlatformIcon id={platform} size={18} />
                      </button>
                      {showPlatformDropdown && (
                        <div className="csm-platform-dropdown-v2">
                          <div className="csm-pd-header">Select Platform</div>
                          {PLATFORMS.map(p => (
                            <button
                              key={p.id}
                              className={`csm-pd-item ${platform === p.id ? 'active' : ''}`}
                              onClick={() => handleSelectPlatform(p)}
                            >
                              <span className="csm-pd-icon" style={{ background: p.color + '22' }}>
                                <PlatformIcon id={p.id} size={20} />
                              </span>
                              <span className="csm-pd-label">{p.label}</span>
                              {platform === p.id && <span className="csm-pd-check">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input className="form-input csm-rtmp-input" placeholder="RTMP URL" value={rtmpUrl} onChange={e => setRtmpUrl(e.target.value)} />
                  </div>
                  {/* Stream Key */}
                  <div className="csm-rtmp-field" style={{ marginTop: 6 }}>
                    <div className="csm-rtmp-icon"><Key size={13} /></div>
                    <input className="form-input csm-rtmp-input" placeholder="Stream Key" value={streamKey} onChange={e => setStreamKey(e.target.value)} type="password" />
                    <button className="csm-copy-btn" onClick={() => copyToClipboard(streamKey, 'key')} title="Copy">
                      {copiedField === 'key' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Description</label>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate('description')} disabled={generatingField === 'description'} style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}>
                      {generatingField === 'description' ? <RefreshCw size={12} className="spin" /> : <Wand2 size={12} />} Generate AI
                    </button>
                  </div>
                  {renderAiSuggestion('description')}
                  <textarea className="form-textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Stream description..." disabled={generatingField === 'description'} />
                </div>

                {/* Privacy & Category */}
                <div className="csm-row">
                  <div className="form-group">
                    <label className="form-label">Privacy</label>
                    <select className="form-input" value={privacy} onChange={e => setPrivacy(e.target.value)}>
                      <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Tags */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}><Tag size={12} /> Tags</label>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate('tags')} disabled={generatingField === 'tags'} style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}>
                      {generatingField === 'tags' ? <RefreshCw size={12} className="spin" /> : <Wand2 size={12} />} Generate AI
                    </button>
                  </div>
                  {renderAiSuggestion('tags')}
                  <div className="csm-tags-wrap">
                    <div className="csm-tags-list">
                      {tags.map((t, i) => (
                        <span key={i} className="csm-tag">{t} <button onClick={() => removeTag(i)}><X size={10} /></button></span>
                      ))}
                    </div>
                    <input className="form-input" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} placeholder="Type and press Enter..." />
                    <span className="csm-tag-count">{tags.length}/500</span>
                  </div>
                </div>

                {/* Additional Settings Toggle */}
                <div className="csm-additional-toggle" onClick={() => setShowAdditional(!showAdditional)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px', marginBottom: '8px', opacity: 0.8, fontSize: '12px' }}>
                  <ChevronDown size={14} style={{ transform: showAdditional ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  <span>Additional settings</span>
                </div>

                {/* Additional Settings Content */}
                {showAdditional && (
                  <div className="csm-additional-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '22px', marginBottom: '16px' }}>
                    <div className="csm-toggle-item compact" onClick={() => updateForm('autoStart', !autoStart)}>
                      <span>Enable Auto-start</span>
                      <div className={`csm-switch ${autoStart ? 'on' : ''}`}><div className="csm-switch-knob"/></div>
                    </div>
                    <div className="csm-toggle-item compact" onClick={() => updateForm('autoStop', !autoStop)}>
                      <span>Enable Auto-stop</span>
                      <div className={`csm-switch ${autoStop ? 'on' : ''}`}><div className="csm-switch-knob"/></div>
                    </div>
                    <div className="csm-toggle-item compact" onClick={() => updateForm('dvr', !dvr)}>
                      <span>Enable DVR</span>
                      <div className={`csm-switch ${dvr ? 'on' : ''}`}><div className="csm-switch-knob"/></div>
                    </div>
                    <div className="csm-toggle-item compact" onClick={() => updateForm('video360', !video360)}>
                      <span>360° video</span>
                      <div className={`csm-switch ${video360 ? 'on' : ''}`}><div className="csm-switch-knob"/></div>
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label className="form-label" style={{ fontSize: '11px', opacity: 0.7 }}>Added delay</label>
                      <select className="form-input" value={delay} onChange={(e) => updateForm('delay', e.target.value)} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, padding: '4px 0' }}>
                        <option value="none">None</option>
                        <option value="30s">30 Seconds</option>
                        <option value="60s">1 Minute</option>
                      </select>
                    </div>
                    <div className="csm-toggle-item compact" onClick={() => updateForm('closedCaptions', !closedCaptions)}>
                      <span>Closed captions</span>
                      <div className={`csm-switch ${closedCaptions ? 'on' : ''}`}><div className="csm-switch-knob"/></div>
                    </div>
                    <div className="csm-toggle-item compact" onClick={() => updateForm('unlistReplay', !unlistReplay)}>
                      <span>Unlist live replay once stream ends</span>
                      <div className={`csm-switch ${unlistReplay ? 'on' : ''}`}><div className="csm-switch-knob"/></div>
                    </div>
                  </div>
                )}

                {/* Schedule */}
                <div className="form-group">
                  <label className="form-label csm-schedule-label-row">
                    <span>Schedule Settings</span>
                    <span className="form-hint-inline">Server time: {serverTime}</span>
                  </label>
                  <div className="csm-loop-schedule">
                    <div className="csm-toggle-item compact">
                      <div className="csm-toggle-left">
                        <RotateCcw size={14} />
                        <span>Loop Video</span>
                        <span style={{ fontSize: '11px', color: loopVideo ? '#2dd4a8' : 'var(--text-muted)', marginLeft: 6 }}>
                          ({loopVideo ? 'Active' : 'Inactive'})
                        </span>
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={loopVideo} onChange={e => setLoopVideo(e.target.checked)} />
                        <span className="switch-slider" />
                      </label>
                    </div>
                  </div>
                  <div className="csm-schedule-row">
                    <div className="csm-schedule-field">
                      <span className="csm-schedule-sub">Start Stream</span>
                      <input className="form-input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                    </div>
                    <div className="csm-schedule-field">
                      <span className="csm-schedule-sub">End Stream</span>
                      <input className="form-input" type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'api' && (
              <>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Description</label>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate('description')} disabled={generatingField === 'description'} style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}>
                      {generatingField === 'description' ? <RefreshCw size={12} className="spin" /> : <Wand2 size={12} />} Generate AI
                    </button>
                  </div>
                  {renderAiSuggestion('description')}
                  <textarea className="form-textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Stream description..." disabled={generatingField === 'description'} />
                </div>
                <div className="csm-row">
                  <div className="form-group">
                    <label className="form-label">Privacy</label>
                    <select className="form-input" value={privacy} onChange={e => setPrivacy(e.target.value)}>
                      <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}><Tag size={12} /> Tags</label>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleGenerate('tags')} disabled={generatingField === 'tags'} style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}>
                      {generatingField === 'tags' ? <RefreshCw size={12} className="spin" /> : <Wand2 size={12} />} Generate AI
                    </button>
                  </div>
                  {renderAiSuggestion('tags')}
                  <div className="csm-tags-wrap">
                    <div className="csm-tags-list">
                      {tags.map((t, i) => (
                        <span key={i} className="csm-tag">{t} <button onClick={() => removeTag(i)}><X size={10} /></button></span>
                      ))}
                    </div>
                    <input className="form-input" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} placeholder="Type and press Enter..." />
                    <span className="csm-tag-count">{tags.length}/500</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column */}
          <div className="csm-right">
            {tab === 'manual' ? (
              <>
                <div className="csm-preview-media-group">
                  {/* Manual: Video Player Preview */}
                  <div className="form-group">
                    <label className="form-label">Video Preview</label>
                    <div className="csm-video-player-wrap">
                      {selectedMedia && selectedMedia.serverFilename ? (
                        <video
                          className="csm-video-player"
                          controls
                          src={`/api/video/play/${encodeURIComponent(selectedMedia.serverFilename)}`}
                        />
                      ) : selectedMedia && selectedMedia.objectUrl ? (
                        <video
                          className="csm-video-player"
                          controls
                          src={selectedMedia.objectUrl}
                        />
                      ) : (
                        <div className="csm-preview-empty">
                          <MonitorPlay size={36} strokeWidth={1} />
                          <span>Select a video to preview</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail */}
                  <div className="form-group csm-thumb-group">
                    <label className="form-label">Thumbnail</label>
                  <div className="csm-thumb-container">
                    <div className="csm-thumb" onClick={() => { if (!thumbnailUrl && !selectedMedia?.serverFilename) document.getElementById('csm-thumb-input')?.click(); }}>
                      {thumbnailUrl ? (
                        <>
                          <img src={thumbnailUrl} alt="" className="csm-thumb-img" />
                          <div className="csm-thumb-overlay-action">
                            <button className="csm-thumb-icon-btn" title="Upload" onClick={(e) => { e.stopPropagation(); document.getElementById('csm-thumb-input')?.click(); }}><Upload size={14} /></button>
                            <button className="csm-thumb-icon-btn" title="Gallery" onClick={(e) => { e.stopPropagation(); setShowThumbGallery(!showThumbGallery); }}><LayoutGrid size={14} /></button>
                            <button className="csm-thumb-icon-btn remove" title="Remove" onClick={handleRemoveThumbnail}><Trash2 size={14} /></button>
                          </div>
                        </>
                      ) : (
                        selectedMedia?.serverFilename ? (
                          <>
                            <img src={`/api/video/thumbnail/${encodeURIComponent(selectedMedia.serverFilename)}`} alt="" className="csm-thumb-img" onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerHTML='<div class="csm-thumb-empty"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Click to upload</span><small>1280×720</small></div>'; }} />
                            <div className="csm-thumb-overlay-action">
                              <button className="csm-thumb-icon-btn" title="Upload" onClick={(e) => { e.stopPropagation(); document.getElementById('csm-thumb-input')?.click(); }}><Upload size={14} /></button>
                              <button className="csm-thumb-icon-btn" title="Gallery" onClick={(e) => { e.stopPropagation(); setShowThumbGallery(!showThumbGallery); }}><LayoutGrid size={14} /></button>
                            </div>
                          </>
                        ) : (
                          <div className="csm-thumb-empty">
                            <ImageIcon size={20} strokeWidth={1} />
                            <span>Select Thumbnail</span>
                            <small>1280×720 (Max 2MB)</small>
                            <div className="csm-thumb-actions">
                              <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); document.getElementById('csm-thumb-input')?.click(); }}>Upload File</button>
                              <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); setShowThumbGallery(!showThumbGallery); }}>From Gallery</button>
                            </div>
                          </div>
                        )
                      )}
                      {thumbnailUrl && !selectedMedia?.serverFilename && <input id="csm-thumb-input" type="file" accept="image/*" hidden onChange={handleThumbnail} />}
                      {(!thumbnailUrl || selectedMedia?.serverFilename) && <input id="csm-thumb-input" type="file" accept="image/*" hidden onChange={handleThumbnail} />}
                    </div>
                    {showThumbGallery && (
                      <div className="csm-thumb-gallery-dropdown">
                        <div className="csm-gallery-header">
                          <span>Select from Gallery</span>
                          <button onClick={() => setShowThumbGallery(false)}><X size={14}/></button>
                        </div>
                        <div className="csm-gallery-grid">
                          {galleryImages.length > 0 ? galleryImages.map(img => (
                            <div key={img.id || img.name} className="csm-gallery-item" onClick={() => handleGallerySelect(img)}>
                              <img src={img.objectUrl || img.url || `/uploads/${encodeURIComponent(img.serverFilename || img.name)}`} alt={img.name} />
                            </div>
                          )) : (
                            <div className="csm-gallery-empty">No images found in gallery</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>



                {/* Advanced Settings */}
                <div className="csm-toggle-row">
                  <div className="csm-toggle-item">
                    <div className="csm-toggle-left">
                      <span>Advanced Settings</span>
                      <span style={{ fontSize: '11px', color: advancedSettings ? '#2dd4a8' : 'var(--text-muted)' }}>
                        ({advancedSettings ? 'Active' : 'Inactive'})
                      </span>
                      <Info size={13} className="csm-info-icon" />
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={advancedSettings} onChange={e => setAdvancedSettings(e.target.checked)} />
                      <span className="switch-slider" />
                    </label>
                  </div>
                </div>
                {advancedSettings && (
                  <div className="csm-advanced-block">
                    <div className="csm-advanced-warning">
                      <AlertTriangle size={15} />
                      <div>
                        <strong>Advanced Settings Warning</strong>
                        <p>Using advanced settings will make the streaming process more resource-intensive</p>
                      </div>
                    </div>
                    <div className="csm-row">
                      <div className="form-group">
                        <label className="form-label">Bitrate</label>
                        <select className="form-input" value={bitrate} onChange={e => setBitrate(e.target.value)}>
                          {BITRATES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Frame Rate</label>
                        <select className="form-input" value={fps} onChange={e => setFps(e.target.value)}>
                          {FPS_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="csm-row">
                      <div className="form-group">
                        <label className="form-label">Resolution</label>
                        <select className="form-input" value={resolution} onChange={e => { setResolution(e.target.value); setBitrate(RECOMMENDED_BITRATE[e.target.value] || '2500'); }}>
                          {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Orientation</label>
                        <div className="csm-orientation">
                          <button className={`csm-orient-btn ${orientation === 'landscape' ? 'active' : ''}`} onClick={() => setOrientation('landscape')}>
                            <Monitor size={14} /> Landscape
                          </button>
                          <button className={`csm-orient-btn ${orientation === 'portrait' ? 'active' : ''}`} onClick={() => setOrientation('portrait')}>
                            <Smartphone size={14} /> Portrait
                          </button>
                        </div>
                      </div>
                    </div>
                    <span className="csm-resolution-hint">{RESOLUTIONS.find(r => r.value === resolution)?.desc || resolution}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* YouTube API: Channel selector with Change button */}
                <div className="form-group">
                  <label className="form-label">Select Channel</label>
                  {channels.length === 0 ? (
                    <div className="csm-no-channel"><p>Belum ada channel — hubungkan di Settings</p></div>
                  ) : (
                    <div className="csm-channel-card">
                      {selectedChannel ? (
                        <>
                          {selectedChannel.avatarUrl ? (
                            <img src={selectedChannel.avatarUrl} alt="" className="csm-ch-photo-lg" />
                          ) : (
                            <div className="csm-ch-avatar-lg" style={{ background: selectedChannel.avatarColor }}>{selectedChannel.avatar}</div>
                          )}
                          <div className="csm-ch-info">
                            <span className="csm-ch-name">{selectedChannel.name}</span>
                            <span className="csm-ch-subs">{formatNum(selectedChannel.subscribers)} subscribers</span>
                          </div>
                          <div className="csm-ch-change">
                            <Edit2 size={12} />
                            <span>Change</span>
                          </div>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>Choose channel...</span>}
                      <select className="csm-channel-hidden-select" value={channelId} onChange={e => setChannelId(e.target.value)}>
                        <option value="">Choose...</option>
                        {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="csm-preview-media-group">
                  {/* Video Player Preview — same as Manual */}
                  <div className="form-group">
                    <label className="form-label">Video Preview</label>
                    <div className="csm-video-player-wrap">
                      {selectedMedia && selectedMedia.serverFilename ? (
                        <video
                          className="csm-video-player"
                          controls
                          src={`/api/video/play/${encodeURIComponent(selectedMedia.serverFilename)}`}
                        />
                      ) : selectedMedia && selectedMedia.objectUrl ? (
                        <video
                          className="csm-video-player"
                          controls
                          src={selectedMedia.objectUrl}
                        />
                      ) : (
                        <div className="csm-preview-empty">
                          <MonitorPlay size={36} strokeWidth={1} />
                          <span>Select a video to preview</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail — same as Manual */}
                  <div className="form-group csm-thumb-group">
                    <label className="form-label">Thumbnail</label>
                  <div className="csm-thumb-container">
                    <div className="csm-thumb" onClick={() => { if (!thumbnailUrl) document.getElementById('csm-thumb-input-api')?.click(); }}>
                      {thumbnailUrl ? (
                        <>
                          <img src={thumbnailUrl} alt="" className="csm-thumb-img" />
                          <div className="csm-thumb-overlay-action">
                            <button className="csm-thumb-icon-btn" title="Upload" onClick={(e) => { e.stopPropagation(); document.getElementById('csm-thumb-input-api')?.click(); }}><Upload size={14} /></button>
                            <button className="csm-thumb-icon-btn" title="Gallery" onClick={(e) => { e.stopPropagation(); setShowThumbGallery(!showThumbGallery); }}><LayoutGrid size={14} /></button>
                            <button className="csm-thumb-icon-btn remove" title="Remove" onClick={handleRemoveThumbnail}><Trash2 size={14} /></button>
                          </div>
                        </>
                      ) : (
                        <div className="csm-thumb-empty">
                          <ImageIcon size={20} strokeWidth={1} />
                          <span>Select Thumbnail</span>
                          <small>1280×720 (Max 2MB)</small>
                          <div className="csm-thumb-actions">
                            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); document.getElementById('csm-thumb-input-api')?.click(); }}>Upload File</button>
                            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); setShowThumbGallery(!showThumbGallery); }}>From Gallery</button>
                          </div>
                        </div>
                      )}
                      <input id="csm-thumb-input-api" type="file" accept="image/*" hidden onChange={handleThumbnail} />
                    </div>
                    {showThumbGallery && (
                      <div className="csm-thumb-gallery-dropdown">
                        <div className="csm-gallery-header">
                          <span>Select from Gallery</span>
                          <button onClick={() => setShowThumbGallery(false)}><X size={14}/></button>
                        </div>
                        <div className="csm-gallery-grid">
                          {galleryImages.length > 0 ? galleryImages.map(img => (
                            <div key={img.id || img.name} className="csm-gallery-item" onClick={() => handleGallerySelect(img)}>
                              <img src={img.objectUrl || img.url || `/uploads/${encodeURIComponent(img.serverFilename || img.name)}`} alt={img.name} />
                            </div>
                          )) : (
                            <div className="csm-gallery-empty">No images found in gallery</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>

                {/* Enable Schedule */}
                <div className="csm-toggle-row">
                  <div className="csm-toggle-item">
                    <div className="csm-toggle-left">
                      <span>Enable Schedule</span>
                      <span style={{ fontSize: '11px', color: enableSchedule ? '#2dd4a8' : 'var(--text-muted)' }}>
                        ({enableSchedule ? 'Active' : 'Inactive'})
                      </span>
                      <span className="form-hint-inline" style={{ marginLeft: 8 }}>{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={enableSchedule} onChange={e => setEnableSchedule(e.target.checked)} />
                      <span className="switch-slider" />
                    </label>
                  </div>
                  {enableSchedule && <input className="form-input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={{ marginTop: 6 }} />}
                </div>

                {/* Enable Monetization */}
                <div className="csm-toggle-row">
                  <div className="csm-toggle-item">
                    <div className="csm-toggle-left">
                      <span>Enable Monetization</span>
                      <span style={{ fontSize: '11px', color: enableMonetization ? '#2dd4a8' : 'var(--text-muted)' }}>
                        ({enableMonetization ? 'Active' : 'Inactive'})
                      </span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={enableMonetization} onChange={e => setEnableMonetization(e.target.checked)} />
                      <span className="switch-slider" />
                    </label>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="csm-toggle-row" style={{ marginTop: '16px' }}>
                  <div className="csm-toggle-item">
                    <div className="csm-toggle-left">
                      <span>Advanced Settings</span>
                      <span style={{ fontSize: '11px', color: advancedSettings ? '#2dd4a8' : 'var(--text-muted)' }}>
                        ({advancedSettings ? 'Active' : 'Inactive'})
                      </span>
                      <Info size={13} className="csm-info-icon" />
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={advancedSettings} onChange={e => setAdvancedSettings(e.target.checked)} />
                      <span className="switch-slider" />
                    </label>
                  </div>
                </div>

                {advancedSettings && (
                  <div className="csm-advanced-block" style={{ marginTop: '8px' }}>
                    <div className="csm-advanced-warning">
                      <AlertTriangle size={15} />
                      <div>
                        <strong>Advanced Settings Warning</strong>
                        <p>Using advanced settings will make the streaming process more resource-intensive</p>
                      </div>
                    </div>
                    <div className="csm-row">
                      <div className="form-group">
                        <label className="form-label">Bitrate</label>
                        <select className="form-input" value={bitrate} onChange={e => setBitrate(e.target.value)}>
                          {BITRATES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Frame Rate</label>
                        <select className="form-input" value={fps} onChange={e => setFps(e.target.value)}>
                          {FPS_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="csm-row">
                      <div className="form-group">
                        <label className="form-label">Resolution</label>
                        <select className="form-input" value={resolution} onChange={e => { setResolution(e.target.value); setBitrate(RECOMMENDED_BITRATE[e.target.value] || '2500'); }}>
                          {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Orientation</label>
                        <div className="csm-orientation">
                          <button className={`csm-orient-btn ${orientation === 'landscape' ? 'active' : ''}`} onClick={() => setOrientation('landscape')}>
                            <Monitor size={14} /> Landscape
                          </button>
                          <button className={`csm-orient-btn ${orientation === 'portrait' ? 'active' : ''}`} onClick={() => setOrientation('portrait')}>
                            <Smartphone size={14} /> Portrait
                          </button>
                        </div>
                      </div>
                    </div>
                    <span className="csm-resolution-hint">{RESOLUTIONS.find(r => r.value === resolution)?.desc || resolution}</span>
                    
                    <div className="csm-toggle-row" style={{ marginTop: '12px' }}>
                      <div className="csm-toggle-item compact">
                        <div className="csm-toggle-left">
                          <RotateCcw size={14} />
                          <span>Loop Video</span>
                          <span style={{ fontSize: '11px', color: loopVideo ? '#2dd4a8' : 'var(--text-muted)', marginLeft: 6 }}>
                            ({loopVideo ? 'Active' : 'Inactive'})
                          </span>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={loopVideo} onChange={e => setLoopVideo(e.target.checked)} />
                          <span className="switch-slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {broadcastError && (
          <div className="stream-error-toast" style={{ marginBottom: 0, marginTop: 'var(--space-sm)' }}>
            <AlertTriangle size={16} />
            <span>{broadcastError}</span>
            <button onClick={() => setBroadcastError('')}><X size={14} /></button>
          </div>
        )}
        <div className="csm-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!title.trim() || creatingBroadcast}>
            {creatingBroadcast ? 'Creating Broadcast...' : editId ? 'Save Changes' : 'Create Stream'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
