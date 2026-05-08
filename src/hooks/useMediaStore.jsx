import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const MediaContext = createContext(null);

export function MediaProvider({ children }) {
  const [files, setFiles] = useState([]);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  const getToken = () => localStorage.getItem('streamtube_token');

  // Load from DB on mount
  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/data/media_files', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.data) {
          setFiles(data.data);
        }
      } catch {}
    };
    init();
  }, []);

  // Save single file metadata to DB (for updates like category change)
  const saveFileToDB = useCallback(async (f) => {
    const token = getToken();
    if (!token || !f?.id) return false;
    try {
      const res = await fetch('/api/data/media_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(f)
      });
      const data = await res.json();
      return data.success;
    } catch { return false; }
  }, []);

  // Add files to local state — DB save is handled by backend upload endpoint
  const addFiles = useCallback((newFiles) => {
    setFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const unique = newFiles.filter(f => !existingIds.has(f.id));
      return [...unique, ...prev];
    });
  }, []);

  const deleteFile = useCallback(async (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    const token = getToken();
    if (token) {
      try {
        await fetch(`/api/data/media_files/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {}
    }
  }, []);

  const changeCategory = useCallback((id, newCat) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, category: newCat } : f));
    // Save updated category to DB
    setTimeout(() => {
      const f = filesRef.current.find(x => x.id === id);
      if (f) saveFileToDB({ ...f, category: newCat });
    }, 0);
  }, [saveFileToDB]);

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
