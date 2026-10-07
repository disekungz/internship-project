const apiCache = new Map(); // key → { data, expiresAt }

export function getCached(key) {
  const entry = apiCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  apiCache.delete(key);
  return null;
}

export function setCache(key, data, ttlMs = 60_000) {
  apiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
