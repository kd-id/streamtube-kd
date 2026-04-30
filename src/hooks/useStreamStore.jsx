import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';

const defaultStreamSettings = {
  title: '',
  description: '',
  category: 'Science & Technology',
  tags: [],
  privacy: 'public',
  latency: 'normal',
  dvr: true,
  autoCaptions: true,
  chatEnabled: true,
  slowMode: false,
  slowModeDelay: 5,
  subscriberOnly: false,
};

const StreamContext = createContext(null);

const STREAMS_KEY = 'streamtube_saved_streams';

const initialState = {
  isLive: false,
  elapsedSeconds: 0,
  streamHealth: { bitrate: 4500, fps: 30, droppedFrames: 0, quality: 'excellent' },
  settings: { ...defaultStreamSettings },
  viewers: 0,
  savedStreams: [],
};

function rand4() {
  return Math.random().toString(36).substring(2, 6);
}

function randomHealth(prev) {
  return {
    bitrate: 4500 + Math.floor(Math.random() * 400) - 200,
    fps: Math.random() > 0.05 ? 30 : 29,
    droppedFrames: (prev?.droppedFrames || 0) + (Math.random() > 0.9 ? 1 : 0),
    quality: 'excellent',
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'GO_LIVE':
      return { ...state, isLive: true, elapsedSeconds: 0, viewers: 0 };
    case 'END_STREAM':
      return { ...state, isLive: false, elapsedSeconds: 0, viewers: 0 };
    case 'TICK':
      const anyActuallyLive = state.savedStreams.some(s => s.status === 'live');
      return {
        ...state,
        elapsedSeconds: anyActuallyLive ? state.elapsedSeconds + 1 : state.elapsedSeconds,
        viewers: anyActuallyLive ? Math.max(0, state.viewers + Math.floor(Math.random() * 21) - 8) : 0,
        streamHealth: anyActuallyLive ? randomHealth(state.streamHealth) : state.streamHealth,
        savedStreams: state.savedStreams.map(s =>
          s.status === 'live' ? {
            ...s,
            elapsedSeconds: (s.elapsedSeconds || 0) + 1,
            viewers: Math.max(0, (s.viewers || 0) + Math.floor(Math.random() * 21) - 8),
            health: randomHealth(s.health),
          } : s
        ),
      };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    // Saved streams
    case 'SET_STREAMS':
      return { ...state, savedStreams: action.payload };
    case 'CREATE_STREAM':
      return { ...state, savedStreams: [...state.savedStreams, action.payload] };
    case 'UPDATE_STREAM':
      return {
        ...state,
        savedStreams: state.savedStreams.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s
        ),
      };
    case 'DELETE_STREAM':
      return {
        ...state,
        savedStreams: state.savedStreams.filter(s => s.id !== action.payload),
      };
    case 'START_STREAM': {
      const stream = state.savedStreams.find(s => s.id === action.payload);
      if (!stream) return state;

      // Validate RTMP streams have key and URL
      if (stream.mode === 'manual' || !stream.mode) {
        if (!stream.streamKey || !stream.streamKey.trim()) {
          return state; // Will be caught by UI validation
        }
        if (!stream.rtmpUrl || !stream.rtmpUrl.trim()) {
          return state;
        }
      }

      // Validate API streams have a channel selected
      if (stream.mode === 'api') {
        if (!stream.channelId) {
          return state;
        }
      }

      return {
        ...state,
        isLive: true,
        savedStreams: state.savedStreams.map(s =>
          s.id === action.payload ? {
            ...s,
            status: 'starting',
            elapsedSeconds: 0,
            viewers: 0,
            health: null,
          } : s
        ),
      };
    }
    case 'STOP_STREAM':
      return {
        ...state,
        isLive: state.savedStreams.some(s => s.id !== action.payload && (s.status === 'live' || s.status === 'starting')),
        savedStreams: state.savedStreams.map(s =>
          s.id === action.payload ? {
            ...s,
            status: 'offline',
            viewers: 0,
            health: null,
            lastDurationSeconds: s.elapsedSeconds || s.lastDurationSeconds || 0,
            elapsedSeconds: 0,
          } : s
        ),
      };
    default:
      return state;
  }
}

export function StreamProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const streamsRef = useRef(state.savedStreams);
  useEffect(() => { streamsRef.current = state.savedStreams; }, [state.savedStreams]);

  const getToken = () => localStorage.getItem('streamtube_token');

  // On mount: fetch streams from DB, then check active status
  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await fetch('/api/data/streams', { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.success && data.data) {
            dispatch({
              type: 'SET_STREAMS',
              payload: data.data.map(s => ({ ...s, status: 'offline', elapsedSeconds: 0, viewers: 0, health: null }))
            });
          }
        } catch {}
      }

      // Sync active streams
      try {
        const res = await fetch('/api/streams/active');
        const data = await res.json();
        if (data.streams && data.streams.length > 0) {
          data.streams.forEach(active => {
            if (active.status === 'live' || active.status === 'starting') {
              let elapsed = 0;
              if (active.startedAt) {
                elapsed = Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000);
                if (elapsed < 0) elapsed = 0;
              }
              dispatch({ type: 'UPDATE_STREAM', payload: { id: active.streamId, updates: { status: active.status, elapsedSeconds: elapsed } } });
            }
          });
        }
      } catch {}
    };
    init();
  }, []);

  // ── Polling: sync streams from server every 10s for cross-device updates ──
  const lastSyncHash = useRef('');
  useEffect(() => {
    const poll = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/data/streams', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!data.success || !data.data) return;
        
        // Quick hash to avoid unnecessary updates
        const hash = JSON.stringify(data.data.map(s => ({ id: s.id, title: s.title, privacy: s.privacy, description: s.description, tags: s.tags, category: s.category, channelId: s.channelId, streamKey: s.streamKey, rtmpUrl: s.rtmpUrl, selectedMedia: s.selectedMedia?.id, thumbnailUrl: s.thumbnailUrl, mode: s.mode, scheduleChecked: s.scheduleChecked, scheduleTime: s.scheduleTime, delay: s.delay })));
        if (hash === lastSyncHash.current) return;
        lastSyncHash.current = hash;

        // Merge server data with local active status
        const currentStreams = streamsRef.current;
        const merged = data.data.map(serverStream => {
          const local = currentStreams.find(s => s.id === serverStream.id);
          if (local && (local.status === 'live' || local.status === 'starting')) {
            // Preserve live/starting status from local
            return { ...serverStream, status: local.status, elapsedSeconds: local.elapsedSeconds, viewers: local.viewers, health: local.health };
          }
          return { ...serverStream, status: 'offline', elapsedSeconds: 0, viewers: 0, health: null };
        });
        dispatch({ type: 'SET_STREAMS', payload: merged });
      } catch {}
    };

    const interval = setInterval(poll, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const goLive = useCallback(() => dispatch({ type: 'GO_LIVE' }), []);
  const endStream = useCallback(() => dispatch({ type: 'END_STREAM' }), []);
  const tick = useCallback(() => dispatch({ type: 'TICK' }), []);
  const updateSettings = useCallback((s) => dispatch({ type: 'UPDATE_SETTINGS', payload: s }), []);

  const createStream = useCallback((data) => {
    const newStream = {
      id: 'stream_' + Date.now(),
      ...data,
      status: 'offline',
      viewers: 0,
      elapsedSeconds: 0,
      health: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'CREATE_STREAM', payload: newStream });
    
    const token = getToken();
    if (token) {
      const { status, viewers, elapsedSeconds, health, ...rest } = newStream;
      fetch('/api/data/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(rest)
      }).catch(() => {});
    }
  }, []);

  const updateStream = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_STREAM', payload: { id, updates } });
    
    // Defer API call slightly to allow state to update, or just build the object
    setTimeout(() => {
      const stream = streamsRef.current.find(s => s.id === id);
      if (stream) {
        const token = getToken();
        if (token) {
          const { status, viewers, elapsedSeconds, health, ...rest } = stream;
          fetch('/api/data/streams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(rest)
          }).catch(() => {});
        }
      }
    }, 0);
  }, []);

  const deleteStream = useCallback((id) => {
    dispatch({ type: 'DELETE_STREAM', payload: id });
    const token = getToken();
    if (token) {
      fetch(`/api/data/streams/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, []);

  // Returns { success, error } for UI feedback
  const startStream = useCallback((id) => {
    const stream = state.savedStreams.find(s => s.id === id);
    if (!stream) return { success: false, error: 'Stream tidak ditemukan' };

    if (stream.mode === 'manual' || !stream.mode) {
      if (!stream.streamKey || !stream.streamKey.trim()) {
        return { success: false, error: 'Stream Key wajib diisi sebelum memulai stream' };
      }
      if (!stream.rtmpUrl || !stream.rtmpUrl.trim()) {
        return { success: false, error: 'RTMP URL wajib diisi sebelum memulai stream' };
      }
    }

    if (stream.mode === 'api') {
      if (!stream.channelId) {
        return { success: false, error: 'Pilih YouTube channel terlebih dahulu' };
      }
    }

    dispatch({ type: 'START_STREAM', payload: id });
    return { success: true };
  }, [state.savedStreams]);

  const stopStream = useCallback((id) => dispatch({ type: 'STOP_STREAM', payload: id }), []);

  const isLive = state.savedStreams.some(s => s.status === 'live' || s.status === 'starting');

  return (
    <StreamContext.Provider value={{
      ...state, isLive, goLive, endStream, tick, updateSettings,
      createStream, updateStream, deleteStream, startStream, stopStream,
    }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStream() {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error('useStream must be used within StreamProvider');
  return ctx;
}
