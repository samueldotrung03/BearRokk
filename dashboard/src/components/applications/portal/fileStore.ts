// Uploaded files' contents, kept on this computer in IndexedDB. The account only holds each file's
// name, size and type, so a résumé or transcript never leaves the device. A file is stored under
// its tab's id and its own id, so removing a tab can clear every file it had.

const DB_NAME = 'bearrok-portal-files';
const STORE = 'files';

/** The key a file's contents are stored under. */
export const fileKey = (tabId: string, fileId: string) => `${tabId}/${fileId}`;

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('This browser cannot keep files.'));
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('Could not open the file store.'));
    };
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error ?? new Error('The file store refused the change.'));
    tx.onabort = () => reject(tx.error ?? new Error('The file store refused the change.'));
  });
}

export async function putFile(tabId: string, fileId: string, contents: Blob): Promise<void> {
  await run('readwrite', (store) => store.put(contents, fileKey(tabId, fileId)));
}

/** The file's contents, or null when they are not on this computer (added on another device). */
export async function getFile(tabId: string, fileId: string): Promise<Blob | null> {
  const blob = await run<Blob>('readonly', (store) => store.get(fileKey(tabId, fileId)) as IDBRequest<Blob>);
  return blob ?? null;
}

export async function deleteFile(tabId: string, fileId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(fileKey(tabId, fileId)));
}

/** Clears every file a removed tab had. */
export async function deleteTabFiles(tabId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(IDBKeyRange.bound(`${tabId}/`, `${tabId}/￿`)));
}
