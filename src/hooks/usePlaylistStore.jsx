import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const PlaylistContext = createContext(null);

const PLAYLISTS_KEY = 'streamtube_playlists';

const INITIAL_PLAYLISTS = [];

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState(() => readUserData(PLAYLISTS_KEY, INITIAL_PLAYLISTS));

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(PLAYLISTS_KEY, playlists);
  }, [playlists]);

  const createPlaylist = useCallback((data) => {
    const np = {
      id: Date.now(),
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
    return np;
  }, []);

  const deletePlaylist = useCallback((id) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const renamePlaylist = useCallback((id, name) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, []);

  const addMediaToPlaylist = useCallback((playlistId, media) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId
        ? { ...p, items: [...p.items, {
            id: `${p.id}_${Date.now()}`,
            mediaId: media.id,
            name: media.name,
            type: media.type,
            duration: media.duration,
            serverPath: media.serverPath || null,
            serverFilename: media.serverFilename || null,
            objectUrl: media.objectUrl || null,
          }] }
        : p
    ));
  }, []);

  const removeItemFromPlaylist = useCallback((playlistId, itemId) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId
        ? { ...p, items: p.items.filter(i => i.id !== itemId) }
        : p
    ));
  }, []);

  const moveItemInPlaylist = useCallback((playlistId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      const items = [...p.items];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...p, items };
    }));
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
