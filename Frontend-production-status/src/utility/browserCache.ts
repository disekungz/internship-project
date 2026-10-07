const DB_NAME = 'planning-system-cache';
const STORE_NAME = 'dashboard-data';
const DB_VERSION = 1;
const memoryCache = new Map<string, unknown>();

const openCacheDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function getBrowserCache<T>(key: string): Promise<T | null> {
  if (memoryCache.has(key)) return memoryCache.get(key) as T;
  const db = await openCacheDb();
  try {
    const value = await new Promise<T | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    if (value !== null) memoryCache.set(key, value);
    return value;
  } finally {
    db.close();
  }
}

export async function setBrowserCache<T>(key: string, value: T): Promise<void> {
  memoryCache.set(key, value);
  const db = await openCacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function removeBrowserCache(key: string): Promise<void> {
  memoryCache.delete(key);
  const db = await openCacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function removeLegacyLocalCache(...keys: string[]) {
  keys.forEach(key => localStorage.removeItem(key));
}

