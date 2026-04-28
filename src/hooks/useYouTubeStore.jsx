import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const YouTubeContext = createContext(null);

const CREDENTIALS_KEY = 'streamtube_yt_credentials';
const CHANNELS_KEY = 'streamtube_yt_channels';

export function YouTubeProvider({ children }) {
  const [credentials, setCredentials] = useState(() =>
    readUserData(CREDENTIALS_KEY, { clientId: '', clientSecret: '', redirectUri: `${window.location.origin}/auth/youtube/callback` })
  );
  const [channels, setChannels] = useState(() => readUserData(CHANNELS_KEY, []));
  const [connecting, setConnecting] = useState(false);

  // Persist
  const mountedCreds = useRef(false);
  useEffect(() => {
    if (!mountedCreds.current) { mountedCreds.current = true; return; }
    writeUserData(CREDENTIALS_KEY, credentials);
  }, [credentials]);

  const mountedChans = useRef(false);
  useEffect(() => {
    if (!mountedChans.current) { mountedChans.current = true; return; }
    writeUserData(CHANNELS_KEY, channels);
  }, [channels]);

  // Save API credentials
  const saveCredentials = useCallback((clientId, clientSecret) => {
    setCredentials(prev => ({ ...prev, clientId, clientSecret }));
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
      setConnecting(false);
      return newChannel;
    } catch (err) {
      console.error('YouTube OAuth error:', err);
      setConnecting(false);
      throw err;
    }
  }, [channels, credentials]);

  // Remove channel
  const removeChannel = useCallback((channelId) => {
    setChannels(prev => {
      const next = prev.filter(c => c.id !== channelId);
      if (next.length > 0 && !next.some(c => c.isDefault)) {
        next[0].isDefault = true;
      }
      return next;
    });
  }, []);

  // Update channel data (e.g. refresh accessToken)
  const updateChannel = useCallback((channelId, updates) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, ...updates } : c));
  }, []);

  // Set default channel
  const setDefaultChannel = useCallback((channelId) => {
    setChannels(prev =>
      prev.map(c => ({ ...c, isDefault: c.id === channelId }))
    );
  }, []);

  // Disconnect all
  const disconnectAll = useCallback(() => {
    setChannels([]);
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
