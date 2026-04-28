import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readUserData, writeUserData } from './useUserKey';
import { overlayScenes as defaultScenes } from '../data/mockData';

const OverlayContext = createContext(null);
const OVERLAY_KEY = 'streamtube_overlays_v1';

export function OverlayProvider({ children }) {
  const [scenes, setScenes] = useState(() => readUserData(OVERLAY_KEY, defaultScenes));
  const [activeSceneId, setActiveSceneId] = useState(() => scenes[0]?.id || 1);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(OVERLAY_KEY, scenes);
  }, [scenes]);

  const currentScene = scenes.find(s => s.id === activeSceneId) || scenes[0];

  const setActive = useCallback((id) => {
    setActiveSceneId(id);
  }, []);

  const toggleSceneLive = useCallback((id) => {
    setScenes(prev => prev.map(s => ({ ...s, active: (s.id === id ? !s.active : false) })));
  }, []);

  const addScene = useCallback(() => {
    setScenes(prev => {
      const id = Date.now();
      let num = 1;
      while (prev.some(s => s.name === `Scene ${num}`)) {
        num++;
      }
      return [...prev, { id, name: `Scene ${num}`, active: false, items: [] }];
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
  }, [activeSceneId]);

  const toggleItem = useCallback((sceneId, itemId) => {
    setScenes(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, visible: !i.visible } : i) }
        : s
    ));
  }, []);

  const addItem = useCallback((sceneId, itemData) => {
    const newItem = {
      id: `el_${Date.now()}`,
      type: 'text', label: 'New Element', visible: true, x: 50, y: 50, w: 200, h: 40,
      ...itemData,
    };
    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, items: [...s.items, newItem] } : s
    ));
  }, []);

  const deleteItem = useCallback((sceneId, itemId) => {
    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s
    ));
  }, []);

  const updateItem = useCallback((sceneId, itemId, updates) => {
    setScenes(prev => prev.map(s =>
      s.id === sceneId ? {
        ...s,
        items: s.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
      } : s
    ));
  }, []);

  const updateSceneName = useCallback((id, name) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, name } : s));
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
