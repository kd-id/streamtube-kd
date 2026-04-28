import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readUserData, writeUserData } from './useUserKey';

const MediaContext = createContext(null);

// Version-keyed storage — bump version to flush old cached mock data
const MEDIA_KEY = 'streamtube_media_files_v2';

export function MediaProvider({ children }) {
  const [files, setFiles] = useState(() => readUserData(MEDIA_KEY, []));

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    writeUserData(MEDIA_KEY, files);
  }, [files]);

  const addFiles = useCallback((newFiles) => {
    setFiles(prev => [...newFiles, ...prev]);
  }, []);

  const deleteFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const changeCategory = useCallback((id, newCat) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, category: newCat } : f));
  }, []);

  return (
    <MediaContext.Provider value={{ files, addFiles, deleteFile, changeCategory }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be used within MediaProvider');
  return ctx;
}
