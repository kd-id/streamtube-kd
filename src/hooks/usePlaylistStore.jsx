import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const PlaylistContext = createContext(null);

const PLAYLISTS_KEY = 'streamtube_playlists';

const INITIAL_PLAYLISTS = [];

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState(INITIAL_PLAYLISTS);
  const playlistsRef = useRef(playlists);
  
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);

  const getToken = () => localStorage.getItem('streamtube_token');

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await fetch('/api/data/playlists', { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.success && data.data) {
            setPlaylists(data.data);
          }
        } catch {}
      }
    };
    init();
  }, []);

  const savePlaylist = (p) => {
    const token = getToken();
    if (token && p) {
      fetch('/api/data/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(p)
      }).catch(() => {});
    }
  };

  const createPlaylist = useCallback((data) => {
    const np = {
      id: 'playlist_' + Date.now(),
      name: data.name,
      description: data.description || '',
      playbackMode: data.playbackMode || 'Sequential',
      items: (data.items || []).map((item, idx) => ({
        id: `${Date.now()}_${idx}`,
        mediaId: item.mediaId || item.id,
        name: item.name,
        type: item.type,
        duration: item.duration || '0:00',
        serverPath: item.serverPath || null,
        serverFilename: item.serverFilename || null,
        objectUrl: item.objectUrl || null,
      })),
      createdAt: new Date().toISOString(),
    };
    setPlaylists(prev => [...prev, np]);
    savePlaylist(np);
    return np;
  }, []);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    const token = getToken();
    if (token) {
      fetch(`/api/data/playlists/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, []);

  const _updatePlaylist = (id, updater) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id !== id) return p;
      return updater(p);
    }));
    setTimeout(() => {
      const p = playlistsRef.current.find(x => x.id === id);
      if (p) savePlaylist(p);
    }, 0);
  };

  const renamePlaylist = useCallback((id, name) => {
    _updatePlaylist(id, p => ({ ...p, name }));
  }, []);

  const addMediaToPlaylist = useCallback((playlistId, media) => {
    _updatePlaylist(playlistId, p => ({
      ...p,
      items: [...p.items, {
        id: `${p.id}_${Date.now()}`,
        mediaId: media.id,
        name: media.name,
        type: media.type,
        duration: media.duration,
        serverPath: media.serverPath || null,
        serverFilename: media.serverFilename || null,
        objectUrl: media.objectUrl || null,
      }]
    }));
  }, []);

  const removeItemFromPlaylist = useCallback((playlistId, itemId) => {
    _updatePlaylist(playlistId, p => ({ ...p, items: p.items.filter(i => i.id !== itemId) }));
  }, []);

  const moveItemInPlaylist = useCallback((playlistId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    _updatePlaylist(playlistId, p => {
      const items = [...p.items];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...p, items };
    });
  }, []);

  return (
    <PlaylistContext.Provider value={{
      playlists, createPlaylist, deletePlaylist, renamePlaylist,
      addMediaToPlaylist, removeItemFromPlaylist, moveItemInPlaylist,
    }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylist must be used within PlaylistProvider');
  return ctx;
}
