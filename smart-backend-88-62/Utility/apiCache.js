const apiCache = new Map(); // key → { data, expiresAt }

function getCached(key) {
  const entry = apiCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  apiCache.delete(key);
  return null;
}

function setCache(key, data, ttlMs = 60_000) {
  apiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function clearAllCache() {
  apiCache.clear();
}

module.exports = { getCached, setCache, clearAllCache };