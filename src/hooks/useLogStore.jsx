import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logService, LOG_LEVELS, LOG_CATEGORIES } from '../services/logService';

const LogContext = createContext(null);

export function LogProvider({ children }) {
  const [logs, setLogs] = useState(() => logService.getLogs());
  const [stats, setStats] = useState(() => logService.getStats());

  useEffect(() => {
    logService.init();
    setLogs(logService.getLogs());
    setStats(logService.getStats());

    const unsub = logService.subscribe((newLogs) => {
      setLogs(newLogs);
      setStats(logService.getStats());
    });

    return unsub;
  }, []);

  const clearLogs = useCallback(() => logService.clear(), []);
  const exportText = useCallback(() => logService.exportAsText(), []);
  const exportJSON = useCallback(() => logService.exportAsJSON(), []);

  const getFiltered = useCallback((filters) => logService.getFiltered(filters), []);

  return (
    <LogContext.Provider value={{
      logs, stats, clearLogs, exportText, exportJSON, getFiltered,
      LOG_LEVELS, LOG_CATEGORIES,
    }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLog must be used within LogProvider');
  return ctx;
}
