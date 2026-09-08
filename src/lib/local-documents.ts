const databaseName = "ecomvault-documents";
const storeName = "files";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lokale documentopslag kon niet worden geopend."));
  });
}

function transactionRequest<T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = execute(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lokale documentopslag is mislukt."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Lokale documentopslag is mislukt."));
  }));
}

export function localDocumentPath(id: string) {
  return `indexeddb:${id}`;
}

export function localDocumentId(path?: string) {
  return path?.startsWith("indexeddb:") ? path.slice("indexeddb:".length) : "";
}

export async function saveLocalDocument(id: string, file: Blob) {
  if (!window.indexedDB) throw new Error("Deze browser ondersteunt geen duurzame documentopslag.");
  await transactionRequest("readwrite", (store) => store.put(file, id));
  return localDocumentPath(id);
}

export async function loadLocalDocument(path?: string) {
  const id = localDocumentId(path);
  if (!id || !window.indexedDB) return null;
  const result = await transactionRequest("readonly", (store) => store.get(id));
  return result instanceof Blob ? result : null;
}

export async function removeLocalDocument(path?: string) {
  const id = localDocumentId(path);
  if (!id || !window.indexedDB) return;
  await transactionRequest("readwrite", (store) => store.delete(id));
}
