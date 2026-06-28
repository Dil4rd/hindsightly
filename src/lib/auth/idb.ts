// Minimal IndexedDB wrapper. One database, two single-record stores:
//   - 'vault' : the passkey-encrypted token
//   - 'cache' : the persisted (content-stripped) Todoist dataset

const DB_NAME = 'hindsight'
const DB_VERSION = 2
const STORES = ['vault', 'cache'] as const
type Store = (typeof STORES)[number]
const KEY = 'default'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function get<T>(store: Store): Promise<T | undefined> {
  const db = await open()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(KEY)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function put<T>(store: Store, value: T): Promise<void> {
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function del(store: Store): Promise<void> {
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

// vault store (used by the token vault)
export const idbGet = <T>() => get<T>('vault')
export const idbSet = <T>(v: T) => put<T>('vault', v)
export const idbClear = () => del('vault')

// cache store (used by the dataset cache)
export const cacheGet = <T>() => get<T>('cache')
export const cacheSet = <T>(v: T) => put<T>('cache', v)
export const cacheClear = () => del('cache')
