// Almacenamiento local en IndexedDB: los datos nunca salen del dispositivo.

const DB_NAME = 'embarque';
const DB_VERSION = 1;
const STORE = 'cards';

let dbp;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('passKey', 'passKey', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Operación cancelada'));
  });
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const db = {
  all: () => tx(STORE, 'readonly', (s) => wrap(s.getAll())),
  get: (id) => tx(STORE, 'readonly', (s) => wrap(s.get(id))),
  put: (card) => tx(STORE, 'readwrite', (s) => wrap(s.put(card))),
  remove: (id) => tx(STORE, 'readwrite', (s) => wrap(s.delete(id))),
  clear: () => tx(STORE, 'readwrite', (s) => wrap(s.clear())),
  byPassKey: (key) => tx(STORE, 'readonly', (s) => wrap(s.index('passKey').get(key))),
  getMeta: (key) => tx('meta', 'readonly', (s) => wrap(s.get(key))),
  setMeta: (key, value) => tx('meta', 'readwrite', (s) => wrap(s.put(value, key))),
};

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
