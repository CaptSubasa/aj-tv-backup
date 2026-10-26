/** Minimal IndexedDB wrapper for locally stored playlist files (browser-only). */

export type LocalPlaylist = {
  id: string;
  name: string;
  text: string;
  size: number;
  addedAt: number;
};

const DB_NAME = "aj-tv";
const STORE = "playlists";

export const idbAvailable = () => typeof indexedDB !== "undefined";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB gagal dibuka"));
  });
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Operasi IndexedDB gagal"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      }),
  );
}

export const idbPut = (p: LocalPlaylist) => run("readwrite", (s) => s.put(p)).then(() => undefined);
export const idbGet = (id: string) =>
  run("readonly", (s) => s.get(id)).then((r) => r as LocalPlaylist | undefined);
export const idbDelete = (id: string) =>
  run("readwrite", (s) => s.delete(id)).then(() => undefined);
