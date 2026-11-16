import { useEffect, useRef, useState } from 'react';
import { GitHubData, syncDecision } from './github';
import { readRecord, writeRecord } from './storage';

export function SyncPanel({
  month,
  dirty,
  refreshKey,
  onRefresh,
  onBusy,
}: {
  month: string;
  dirty: boolean;
  refreshKey: number;
  onRefresh: () => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('Saved on this device only.');
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const callbacks = useRef({ onRefresh, onBusy });
  callbacks.current = { onRefresh, onBusy };

  async function synchronize(recover = false) {
    if (!token || dirty || running.current) return;
    running.current = true;
    setWorking(true);
    callbacks.current.onBusy(true);
    try {
      setStatus('Synchronizing…');
      const api = new GitHubData(token);
      await api.verifyPrivate();
      const local = await readRecord(month);
      const remote = await api.read(month);
      if (recover && !remote)
        throw new Error(
          'No remote draft exists for this month. Device copy was preserved.',
        );
      const decision = recover ? 'pull' : syncDecision(local, remote);
      if (decision === 'pull' && remote) {
        await writeRecord(
          {
            draft: { ...remote.draft, revision: local.draft.revision + 1 },
            base: remote.draft,
            sha: remote.sha,
            pending: false,
          },
          local.draft.revision,
        );
      } else if (decision === 'push') {
        const sha = await api.write(local.draft, remote?.sha ?? null);
        await writeRecord(
          {
            ...local,
            draft: { ...local.draft, revision: local.draft.revision + 1 },
            base: local.draft,
            sha,
            pending: false,
          },
          local.draft.revision,
        );
      } else if (remote && (local.pending || local.sha !== remote.sha)) {
        await writeRecord(
          {
            ...local,
            draft: { ...local.draft, revision: local.draft.revision + 1 },
            base: remote.draft,
            sha: remote.sha,
            pending: false,
          },
          local.draft.revision,
        );
      }
      await callbacks.current.onRefresh();
      setStatus(
        remote || decision === 'push'
          ? 'Synced with private GitHub repository.'
          : 'No saved draft to sync. Save a proposal first.',
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
    void readRecord(month)
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
  }, [month, refreshKey]);
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
  }, [token, dirty, month, refreshKey]);

  async function exportDraft() {
    try {
      const local = await readRecord(month);
      const url = URL.createObjectURL(
        new Blob(
          [JSON.stringify({ schemaVersion: 1, draft: local.draft }, null, 2)],
          { type: 'application/json' },
        ),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `family-budget-${month}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  return (
    <section className="panel sync-panel" aria-label="Device synchronization">
      <h2>Device synchronization</h2>
      <p role="status">{status}</p>
      {!token ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setToken(tokenInput.trim());
            setTokenInput('');
          }}
        >
          <label>
            GitHub token
            <input
              aria-label="GitHub token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={!tokenInput.trim()}>
            Connect family-data
          </button>
          <p>
            Use a fine-grained token restricted to private family-data with
            Contents read/write. It stays in memory until reload or disconnect.
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
            onClick={() => {
              if (
                window.confirm(
                  'Replace this month’s saved device draft with GitHub? Pending local changes will be discarded. Export your device copy first if needed.',
                )
              )
                void synchronize(true);
            }}
          >
            Recover from GitHub
          </button>
          <button
            disabled={working}
            onClick={() => {
              setToken('');
              setStatus('Disconnected. Device drafts are preserved.');
            }}
          >
            Disconnect
          </button>
        </div>
      )}
      <button disabled={working || dirty} onClick={() => void exportDraft()}>
        Export saved month JSON
      </button>
      {dirty && <p>Save your changes before synchronizing or exporting.</p>}
      <small>
        Sync runs while the app is open. Browser storage can be cleared; pending
        changes are not backed up. Tokens grant access to all records in
        family-data.
      </small>
    </section>
  );
}
