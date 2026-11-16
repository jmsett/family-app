import {
  DEFAULT_CATEGORIES,
  initialDraft,
  projectBudget,
  validateDraft,
} from '@family/domain';
import type { BudgetDraft, Workspace } from '@family/shared';

export interface LocalRecord {
  draft: BudgetDraft;
  base: BudgetDraft | null;
  sha: string | null;
  pending: boolean;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('family-manager-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('budgets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error('Device storage is unavailable. No changes were saved.'),
      );
  });
}

export async function readRecord(month: string): Promise<LocalRecord> {
  validateDraft(initialDraft(month));
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction('budgets')
        .objectStore('budgets')
        .get(month);
      request.onsuccess = () =>
        resolve(
          request.result ?? {
            draft: initialDraft(month),
            base: null,
            sha: null,
            pending: false,
          },
        );
      request.onerror = () =>
        reject(new Error('Could not read device storage.'));
    });
  } finally {
    db.close();
  }
}

// Compare and write inside one IndexedDB transaction, including across tabs.
export async function writeRecord(
  next: LocalRecord,
  expectedRevision: number,
): Promise<void> {
  validateDraft(next.draft);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('budgets', 'readwrite');
      const store = tx.objectStore('budgets');
      const request = store.get(next.draft.month);
      let conflict = false;
      request.onsuccess = () => {
        if ((request.result?.draft.revision ?? 0) !== expectedRevision) {
          conflict = true;
          tx.abort();
        } else store.put(next, next.draft.month);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? 'This draft changed in another window. Reload it before saving.'
              : 'Device storage failed. Your changes have not been saved.',
          ),
        );
    });
  } finally {
    db.close();
  }
}

export function workspace(record: LocalRecord): Workspace {
  return {
    mode: 'device-pwa',
    currency: 'EUR',
    timezone: 'Europe/Busingen',
    draft: record.draft,
    projection: projectBudget(record.draft),
    recorded: { earmarkedMinor: 0, expensesMinor: 0, payableMinor: 0 },
    categories: DEFAULT_CATEGORIES,
  };
}

export async function saveDraft(draft: BudgetDraft): Promise<Workspace> {
  validateDraft(draft);
  const current = await readRecord(draft.month);
  const next = {
    ...current,
    pending: true,
    draft: {
      ...draft,
      memberNames: draft.memberNames.map((name) => name.trim()) as [
        string,
        string,
      ],
      revision: draft.revision + 1,
    },
  };
  await writeRecord(next, draft.revision);
  return workspace(next);
}
