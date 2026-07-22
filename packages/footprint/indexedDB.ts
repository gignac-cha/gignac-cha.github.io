// One IndexedDB database per key, with database name == object store name == record key. This
// looks redundant but sidesteps IndexedDB's schema-versioning machinery entirely: object stores
// can only be created inside a versionchange transaction ('upgradeneeded'), so a single shared
// database would need a coordinated version bump every time a new key is introduced (uuid today,
// endpoint today, anything tomorrow) — and concurrent open()s from multiple tabs at mismatched
// versions surface blocked/versionchange states that would all need handling. With
// database-per-key, every open() is forever version 1, 'upgradeneeded' fires exactly once per
// fresh database, and there is no migration code to get wrong. The cost — a couple of tiny
// databases — is irrelevant at this scale. Do not "normalize" this into one shared database.
const open = (name: string): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(name, 1);
    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore(name);
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });

export const readIndexedDB = async (key: string): Promise<string | undefined> => {
  const database: IDBDatabase = await open(key);
  return new Promise<string | undefined>((resolve) => {
    const request: IDBRequest = database.transaction(key, 'readonly').objectStore(key).get(key);
    request.addEventListener('success', () => resolve(request.result as string | undefined));
    request.addEventListener('error', () => resolve(undefined));
  });
};

export const writeIndexedDB = async (key: string, value: string): Promise<void> => {
  const database: IDBDatabase = await open(key);
  return new Promise<void>((resolve) => {
    const transaction: IDBTransaction = database.transaction(key, 'readwrite');
    transaction.objectStore(key).put(value, key);
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('error', () => resolve());
  });
};
