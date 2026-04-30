import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const MediaContext = createContext(null);

// Version-keyed storage — bump version to flush old cached mock data
const MEDIA_KEY = 'streamtube_media_files_v2';

export function MediaProvider({ children }) {
  const [files, setFiles] = useState([]);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  const getToken = () => localStorage.getItem('streamtube_token');

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await fetch('/api/data/media_files', { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.success && data.data) {
            setFiles(data.data);
          }
        } catch {}
      }
    };
    init();
  }, []);

  const saveFile = (f) => {
    const token = getToken();
    if (token && f) {
      fetch('/api/data/media_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(f)
      }).catch(() => {});
    }
  };

  const addFiles = useCallback((newFiles) => {
    setFiles(prev => [...newFiles, ...prev]);
    newFiles.forEach(f => saveFile(f));
  }, []);

  const deleteFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    const token = getToken();
    if (token) {
      fetch(`/api/data/media_files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, []);

  const changeCategory = useCallback((id, newCat) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, category: newCat } : f));
    setTimeout(() => {
      const f = filesRef.current.find(x => x.id === id);
      if (f) saveFile(f);
    }, 0);
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
