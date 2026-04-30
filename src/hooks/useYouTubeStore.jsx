import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const YouTubeContext = createContext(null);

const CREDENTIALS_KEY = 'streamtube_yt_credentials';
const CHANNELS_KEY = 'streamtube_yt_channels';

export function YouTubeProvider({ children }) {
  const [credentials, setCredentials] = useState({ clientId: '', clientSecret: '', redirectUri: `${window.location.origin}/auth/youtube/callback` });
  const [channels, setChannels] = useState([]);
  const [connecting, setConnecting] = useState(false);

  const channelsRef = useRef(channels);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  const getToken = () => localStorage.getItem('streamtube_token');

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const credRes = await fetch('/api/settings/yt_credentials', { headers: { Authorization: `Bearer ${token}` } });
        const credData = await credRes.json();
        if (credData.success && credData.data) {
          setCredentials(prev => ({ ...prev, ...credData.data }));
        }

        const chanRes = await fetch('/api/data/youtube_channels', { headers: { Authorization: `Bearer ${token}` } });
        const chanData = await chanRes.json();
        if (chanData.success && chanData.data) {
          setChannels(chanData.data);
        }
      } catch {}
    };
    init();
  }, []);

  const saveChannel = (c) => {
    const token = getToken();
    if (token && c) {
      fetch('/api/data/youtube_channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(c)
      }).catch(() => {});
    }
  };

  const saveCredentialsAPI = (creds) => {
    const token = getToken();
    if (token) {
      fetch('/api/settings/yt_credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(creds)
      }).catch(() => {});
    }
  };

  const saveCredentials = useCallback((clientId, clientSecret) => {
    setCredentials(prev => {
      const nc = { ...prev, clientId, clientSecret };
      saveCredentialsAPI({ clientId, clientSecret });
      return nc;
    });
  }, []);

  // Start YouTube OAuth to add channel
  const connectChannel = useCallback(() => {
    if (!credentials.clientId) {
      return { success: false, error: 'Masukkan Client ID terlebih dahulu di Integration settings' };
    }

    const isDemo = credentials.clientId === 'demo' || !credentials.clientId.includes('.');

    if (isDemo) {
      return { success: false, error: 'Demo connection is disabled. Please configure valid API Credentials.' };
    }

    // Real OAuth flow
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { success: true };
  }, [credentials, channels]);

  // Handle OAuth callback (for real YouTube integration)
  const handleYouTubeCallback = useCallback(async (code) => {
    setConnecting(true);
    try {
      // Exchange code for token via server-side endpoint
      const response = await fetch('/api/youtube/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri: credentials.redirectUri,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('YouTube OAuth error:', data.error);
        setConnecting(false);
        throw new Error(data.error || 'Failed to fetch channel info');
      }

      // Build channel from real API data
      const ch = data.channel;
      const newChannel = {
        id: ch.id,
        name: ch.name,
        handle: ch.handle,
        email: ch.email || '',
        avatar: ch.name?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'YT',
        avatarUrl: ch.avatarUrl || '',
        avatarColor: 'linear-gradient(135deg, #ff0000, #cc0000)',
        subscribers: ch.subscribers || 0,
        videoCount: ch.videoCount || 0,
        viewCount: ch.viewCount || 0,
        isDefault: channels.length === 0,
        connectedAt: new Date().toISOString(),
        status: 'connected',
        accessToken: ch.accessToken,
        refreshToken: ch.refreshToken,
      };

      setChannels(prev => [...prev, newChannel]);
      saveChannel(newChannel);
      setConnecting(false);
      return newChannel;
    } catch (err) {
      console.error('YouTube OAuth error:', err);
      setConnecting(false);
      throw err;
    }
  }, [channels, credentials]);

  const removeChannel = useCallback((channelId) => {
    setChannels(prev => {
      const next = prev.filter(c => c.id !== channelId);
      if (next.length > 0 && !next.some(c => c.isDefault)) {
        next[0].isDefault = true;
        saveChannel(next[0]);
      }
      return next;
    });
    const token = getToken();
    if (token) {
      fetch(`/api/data/youtube_channels/${channelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, []);

  const updateChannel = useCallback((channelId, updates) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, ...updates } : c));
    setTimeout(() => {
      const c = channelsRef.current.find(x => x.id === channelId);
      if (c) saveChannel(c);
    }, 0);
  }, []);

  const setDefaultChannel = useCallback((channelId) => {
    setChannels(prev => prev.map(c => {
      const isDefault = c.id === channelId;
      if (c.isDefault !== isDefault) {
        const nc = { ...c, isDefault };
        saveChannel(nc);
        return nc;
      }
      return c;
    }));
  }, []);

  const disconnectAll = useCallback(() => {
    const ids = channelsRef.current.map(c => c.id);
    setChannels([]);
    const token = getToken();
    if (token) {
      ids.forEach(id => {
        fetch(`/api/data/youtube_channels/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      });
    }
  }, []);

  const defaultChannel = channels.find(c => c.isDefault) || channels[0] || null;

  // Check if credentials are saved (non-empty)
  const hasCredentials = !!(credentials.clientId && credentials.clientSecret);

  return (
    <YouTubeContext.Provider value={{
      credentials,
      channels,
      defaultChannel,
      connecting,
      hasCredentials,
      saveCredentials,
      connectChannel,
      handleYouTubeCallback,
      removeChannel,
      updateChannel,
      setDefaultChannel,
      disconnectAll,
    }}>
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error('useYouTube must be used within YouTubeProvider');
  return ctx;
}
