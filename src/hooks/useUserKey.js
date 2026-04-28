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
    fetch('/api/userdata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set', key: finalKey, value })
    }).catch(err => console.error('Failed to sync user data', err));
  }
}

/** Pull all user data from backend to localStorage */
export async function syncUserDataFromServer(token) {
  if (!token) return false;
  try {
    const res = await fetch('/api/userdata', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      let changed = false;
      for (const [k, v] of Object.entries(data.data)) {
        if (localStorage.getItem(k) !== v) {
          localStorage.setItem(k, v);
          changed = true;
        }
      }
      return changed;
    }
  } catch { }
  return false;
}
