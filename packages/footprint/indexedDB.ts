const open = (name: string): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(name, 1);
    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore(name);
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });

export const readDatabase = async (key: string): Promise<string | undefined> => {
  const database: IDBDatabase = await open(key);
  return new Promise<string | undefined>((resolve) => {
    const request: IDBRequest = database.transaction(key, 'readonly').objectStore(key).get(key);
    request.addEventListener('success', () => resolve(request.result as string | undefined));
    request.addEventListener('error', () => resolve(undefined));
  });
};

export const writeDatabase = async (key: string, value: string): Promise<void> => {
  const database: IDBDatabase = await open(key);
  return new Promise<void>((resolve) => {
    const transaction: IDBTransaction = database.transaction(key, 'readwrite');
    transaction.objectStore(key).put(value, key);
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('error', () => resolve());
  });
};
