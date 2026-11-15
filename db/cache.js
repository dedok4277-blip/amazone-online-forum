// Простой in-memory TTL кэш для частых запросов к БД
const store = new Map();

function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { store.delete(key); return null; }
  return entry.value;
}

function cacheSet(key, value, ttlMs = 5000) {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

function cacheInvalidate(pattern) {
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) store.delete(key);
  }
}

module.exports = { cacheGet, cacheSet, cacheInvalidate };
