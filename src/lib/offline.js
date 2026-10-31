// Offline support helpers. Pure, so they can be tested without a browser.

/** True for "the network is unreachable" errors (as opposed to a real answer from the server such as a denied request). */
export function isNetworkError(e, online = typeof navigator === 'undefined' ? true : navigator.onLine) {
  if (!online) return true;
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_internet|offline/i.test(String(e?.message || e || ''));
}

const LAST_PROFILE = 'freever:last-profile';
export const rememberProfile = (p) => { try { localStorage.setItem(LAST_PROFILE, JSON.stringify(p)); } catch { /* storage blocked */ } };
export const forgetProfile = () => { try { localStorage.removeItem(LAST_PROFILE); } catch { /* ignore */ } };

/** The last profile this device saw for `userId`, or null. Only used while the server cannot be reached and a login session still exists. */
export function savedProfile(userId) {
  try {
    const p = JSON.parse(localStorage.getItem(LAST_PROFILE) || 'null');
    return p && p.id === userId ? p : null;
  } catch { return null; }
}
