/**
 * Per-user localStorage key helper.
 * Uses the auth token to get the current user ID.
 */

const TOKEN_KEY = 'streamtube_token';

/** Get the current logged-in user's ID from the token. */
export function getCurrentUserId() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const payload = JSON.parse(atob(token));
    return payload?.userId || null;
  } catch {
    return null;
  }
}

/** Build a per-user localStorage key: `baseKey_userId` */
export function userKey(baseKey) {
  const userId = getCurrentUserId();
  if (!userId) return baseKey;
  return `${baseKey}_${userId}`;
}

/** Read JSON from per-user localStorage */
export function readUserData(baseKey, fallback = null) {
  try {
    const data = localStorage.getItem(userKey(baseKey));
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

/** Write JSON to per-user localStorage and sync to backend */
export function writeUserData(baseKey, value) {
  const finalKey = userKey(baseKey);
  localStorage.setItem(finalKey, JSON.stringify(value));
  
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    // Fire-and-forget but track pending writes to prevent race conditions on reload
    const promise = fetch('/api/userdata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set', key: finalKey, value })
    }).catch(err => console.error('Failed to sync user data', err));
    // Track pending writes
    if (!window.__pendingWrites) window.__pendingWrites = [];
    window.__pendingWrites.push(promise);
    promise.finally(() => {
      if (window.__pendingWrites) {
        window.__pendingWrites = window.__pendingWrites.filter(p => p !== promise);
      }
    });
  }
}

/** Pull all user data from backend to localStorage */
export async function syncUserDataFromServer(token) {
  if (!token) return false;
  
  // Wait for any pending writes to complete first (prevents stale data overwriting new data)
  if (window.__pendingWrites && window.__pendingWrites.length > 0) {
    try { await Promise.allSettled(window.__pendingWrites); } catch {}
  }
  
  try {
    const res = await fetch('/api/userdata', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      let changed = false;
      for (const [k, v] of Object.entries(data.data)) {
        const local = localStorage.getItem(k);
        if (local === null || local === undefined) {
          // Only write from server if localStorage is EMPTY for this key (first login / new device)
          localStorage.setItem(k, v);
          changed = true;
        }
        // If localStorage already has data, keep local version (it's newer or same)
      }
      return changed;
    }
  } catch { }
  return false;
}
