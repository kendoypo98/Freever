let prefix = 'freever:guest:';

/** Scope all saved data to the logged-in user. */
export function setUser(name) {
  prefix = `freever:u:${String(name).toLowerCase()}:`;
}
export const getPrefix = () => prefix;

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded (e.g. huge background image) or storage blocked
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(prefix + key);
  } catch {
    /* ignore */
  }
}
