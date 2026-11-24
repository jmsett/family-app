import { confirmAction } from './Confirmation';
import { ChevronDown } from './ChevronDown';
import { useEffect, useRef, useState } from 'react';
import { GitHubHousehold, reconcile, sameHousehold } from './household-sync';
import { readRecord, writeRecord } from './storage';
import {
  readGitHubToken,
  saveGitHubToken,
  watchGitHubToken,
} from './credentials';

export function SyncPanel({
  dirty,
  refreshKey,
  onRefresh,
  onBusy,
  onStatus,
}: {
  dirty: boolean;
  refreshKey: number;
  onRefresh: () => Promise<void>;
  onBusy: (value: boolean) => void;
  onStatus: (value: string) => void;
}) {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [status, setStatus] = useState('Saved on this device only.');
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const callbacks = useRef({ onRefresh, onBusy });
  callbacks.current = { onRefresh, onBusy };

  useEffect(() => onStatus(status), [status, onStatus]);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const saved = await readGitHubToken();
        if (!cancelled) setToken(saved);
      } catch (error) {
        if (!cancelled) setStatus((error as Error).message);
      } finally {
        if (!cancelled) setTokenReady(true);
      }
    };
    void restore();
    const unwatch = watchGitHubToken(() => void restore());
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  async function connectToken(event: React.FormEvent) {
    event.preventDefault();
    if (!tokenReady || running.current) return;
    running.current = true;
    setWorking(true);
    callbacks.current.onBusy(true);
    try {
      const candidate = tokenInput.trim();
      setStatus('Checking private repository access…');
      await new GitHubHousehold(candidate).verifyPrivate();
      await saveGitHubToken(candidate);
      setToken(candidate);
      setTokenInput('');
      setStatus('Connection saved on this device. Synchronization pending.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      running.current = false;
      setWorking(false);
      callbacks.current.onBusy(false);
    }
  }

  async function disconnect() {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    callbacks.current.onBusy(true);
    try {
      await saveGitHubToken('');
      setToken('');
      setTokenInput('');
      setStatus(
        'Disconnected. Saved token removed; device records are preserved.',
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      running.current = false;
      setWorking(false);
      callbacks.current.onBusy(false);
    }
  }

  async function synchronize(recover = false) {
    if (!token || dirty || running.current) return;
    running.current = true;
    setWorking(true);
    callbacks.current.onBusy(true);
    try {
      setStatus('Synchronizing…');
      const api = new GitHubHousehold(token);
      await api.verifyPrivate();
      const local = await readRecord();
      const remote = await api.readHousehold();
      const document = reconcile(local, remote, recover);
      const upload =
        (local.pending && !remote) ||
        (remote &&
          (!sameHousehold(document, remote.document) || remote.sha === null));
      const sha = upload
        ? await api.writeHousehold(document, remote?.sha ?? null)
        : (remote?.sha ?? null);
      if (
        !sameHousehold(document, local.document) ||
        local.pending ||
        local.sha !== sha
      ) {
        await writeRecord(
          {
            document: { ...document, revision: local.document.revision + 1 },
            base: sha ? document : null,
            sha,
            pending: false,
          },
          local.document.revision,
        );
        await callbacks.current.onRefresh();
      }
      setStatus(
        sha
          ? 'Synced with private GitHub repository.'
          : 'No saved changes to sync.',
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      running.current = false;
      setWorking(false);
      callbacks.current.onBusy(false);
    }
  }
  const syncRef = useRef(synchronize);
  syncRef.current = synchronize;
  useEffect(() => {
    let cancelled = false;
    void readRecord()
      .then((record) => {
        if (!cancelled)
          setStatus(
            record.pending
              ? 'Saved on device · pending sync.'
              : record.sha
                ? 'Last saved copy synced. Connect to check for updates.'
                : 'Saved on this device only.',
          );
      })
      .catch((error) => {
        if (!cancelled) setStatus(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  useEffect(() => {
    if (!token || dirty) return;
    const sync = () => {
      if (navigator.onLine && document.visibilityState === 'visible')
        void syncRef.current();
    };
    const timer = window.setTimeout(sync, 600);
    const interval = window.setInterval(sync, 120000);
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [token, dirty, refreshKey]);

  async function exportDraft() {
    try {
      const local = await readRecord();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(local.document, null, 2)], {
          type: 'application/json',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'family-household.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  return (
    <section className="panel sync-panel" aria-label="Device synchronization">
      <details>
        <summary>
          <span className="sync-title">Sync &amp; backups</span>
          <span className="sync-status" role="status">
            {status}
          </span>
          <ChevronDown className="disclosure-icon" />
        </summary>
        <div className="sync-content">
          {!token ? (
            <form onSubmit={(event) => void connectToken(event)}>
              <label>
                GitHub token
                <input
                  aria-label="GitHub token"
                  type="password"
                  autoComplete="off"
                  disabled={working || !tokenReady}
                  spellCheck={false}
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={working || !tokenReady || !tokenInput.trim()}
              >
                Connect family-data
              </button>
              <p>
                Use a fine-grained token restricted to private family-data with
                Contents read/write. The connection is remembered on this device
                until you disconnect or clear browser data.
              </p>
            </form>
          ) : (
            <div className="sync-actions">
              <button
                disabled={working || dirty}
                onClick={() => void synchronize()}
              >
                Sync now
              </button>
              <button
                disabled={working || dirty}
                onClick={async () => {
                  if (
                    await confirmAction(
                      'Replace unsynced plan settings with GitHub? Transfer confirmations will be preserved. Export your device copy first if needed.',
                    )
                  )
                    void synchronize(true);
                }}
              >
                Recover from GitHub
              </button>
              <button disabled={working} onClick={() => void disconnect()}>
                Disconnect
              </button>
            </div>
          )}
          <button
            disabled={working || dirty}
            onClick={() => void exportDraft()}
          >
            Export household JSON
          </button>
          {dirty && <p>Save your changes before synchronizing or exporting.</p>}
          <small>
            The token stays on this device and is excluded from JSON backups.
            Sync runs while the app is open. Browser storage can be cleared;
            pending changes are not backed up. Tokens grant access to all
            records in family-data.
          </small>
        </div>
      </details>
    </section>
  );
}
