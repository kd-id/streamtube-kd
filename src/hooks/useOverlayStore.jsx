import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { overlayScenes as defaultScenes } from '../data/mockData';

const OverlayContext = createContext(null);
const OVERLAY_KEY = 'streamtube_overlays_v1';

export function OverlayProvider({ children }) {
  const [scenes, setScenes] = useState(defaultScenes);
  const [activeSceneId, setActiveSceneId] = useState(1);
  const scenesRef = useRef(scenes);

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);

  const getToken = () => localStorage.getItem('streamtube_token');

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await fetch('/api/data/overlays', { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            setScenes(data.data);
            setActiveSceneId(data.data[0]?.id || 1);
          }
        } catch {}
      }
    };
    init();
  }, []);

  const saveScene = (s) => {
    const token = getToken();
    if (token && s) {
      fetch('/api/data/overlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(s)
      }).catch(() => {});
    }
  };

  const currentScene = scenes.find(s => s.id === activeSceneId) || scenes[0];

  const setActive = useCallback((id) => {
    setActiveSceneId(id);
  }, []);

  const _updateScene = (id, updater) => {
    setScenes(prev => prev.map(s => {
      if (s.id !== id) return s;
      return updater(s);
    }));
    setTimeout(() => {
      const s = scenesRef.current.find(x => x.id === id);
      if (s) saveScene(s);
    }, 0);
  };

  const toggleSceneLive = useCallback((id) => {
    _updateScene(id, s => ({ ...s, active: !s.active }));
  }, []);

  const addScene = useCallback(() => {
    const id = 'overlay_' + Date.now();
    setScenes(prev => {
      let num = 1;
      while (prev.some(s => s.name === `Scene ${num}`)) num++;
      const ns = { id, name: `Scene ${num}`, active: false, items: [] };
      saveScene(ns);
      return [...prev, ns];
    });
  }, []);

  const deleteScene = useCallback((id) => {
    setScenes(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeSceneId === id) {
        setTimeout(() => setActiveSceneId(next[0]?.id || null), 0);
      }
      return next;
    });
    const token = getToken();
    if (token) {
      fetch(`/api/data/overlays/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, [activeSceneId]);

  const toggleItem = useCallback((sceneId, itemId) => {
    _updateScene(sceneId, s => ({
      ...s, items: s.items.map(i => i.id === itemId ? { ...i, visible: !i.visible } : i)
    }));
  }, []);

  const addItem = useCallback((sceneId, itemData) => {
    const newItem = {
      id: `el_${Date.now()}`,
      type: 'text', label: 'New Element', visible: true, x: 50, y: 50, w: 200, h: 40,
      ...itemData,
    };
    _updateScene(sceneId, s => ({ ...s, items: [...s.items, newItem] }));
  }, []);

  const deleteItem = useCallback((sceneId, itemId) => {
    _updateScene(sceneId, s => ({ ...s, items: s.items.filter(i => i.id !== itemId) }));
  }, []);

  const updateItem = useCallback((sceneId, itemId, updates) => {
    _updateScene(sceneId, s => ({
      ...s, items: s.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
    }));
  }, []);

  const updateSceneName = useCallback((id, name) => {
    _updateScene(id, s => ({ ...s, name }));
  }, []);

  return (
    <OverlayContext.Provider value={{
      scenes, currentScene, activeSceneId,
      setActive, addScene, deleteScene, toggleSceneLive, toggleItem, addItem, deleteItem, updateItem, updateSceneName,
    }}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
}
