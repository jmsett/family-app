// Device-only credentials. This database is never part of household exports or sync.
const DATABASE = 'family-github-device-v1';
const CHANNEL = 'family-github-connection';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('secrets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'Could not access the saved GitHub connection on this device.',
        ),
      );
  });
}
export async function readGitHubToken(): Promise<string> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('secrets');
      const request = tx.objectStore('secrets').get('github-token');
      tx.oncomplete = () =>
        resolve(typeof request.result === 'string' ? request.result : '');
      tx.onerror = tx.onabort = () =>
        reject(new Error('Could not read the saved GitHub connection.'));
    });
  } finally {
    db.close();
  }
}
export async function saveGitHubToken(token: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('secrets', 'readwrite');
      if (token) tx.objectStore('secrets').put(token, 'github-token');
      else tx.objectStore('secrets').delete('github-token');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            'Could not update the saved GitHub connection. Device records are preserved.',
          ),
        );
    });
  } finally {
    db.close();
  }
  if ('BroadcastChannel' in globalThis) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  }
}
export function watchGitHubToken(onChange: () => void): () => void {
  if (!('BroadcastChannel' in globalThis)) return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => onChange();
  return () => channel.close();
}
