import {
  initialHousehold,
  migrateLegacyDrafts,
  validateHousehold,
  upgradeHousehold,
  canonicalEvent,
} from '@family/domain';
import type { BudgetDraft, HouseholdPlan } from '@family/shared';

export interface LocalRecord {
  document: HouseholdPlan;
  base: HouseholdPlan | null;
  sha: string | null;
  pending: boolean;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('family-manager-v1', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('budgets'))
        request.result.createObjectStore('budgets');
      request.result.createObjectStore('household');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error('Device storage is unavailable. No changes were saved.'),
      );
    request.onblocked = () =>
      reject(
        new Error(
          'Close older Family app tabs, then reload to update device storage.',
        ),
      );
  });
}
export async function readRecord(): Promise<LocalRecord> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['household', 'budgets'], 'readwrite');
      const store = tx.objectStore('household');
      const request = store.get('current');
      let record: LocalRecord;
      request.onsuccess = () => {
        if (request.result) {
          record = request.result;
          const oldVersion = record.document?.schemaVersion;
          try {
            record = {
              ...record,
              document: upgradeHousehold(record.document),
              base: record.base ? upgradeHousehold(record.base) : null,
            };
          } catch {
            tx.abort();
            return;
          }
          if (oldVersion !== 5) {
            record.pending = true;
            store.put(record, 'current');
          }
          return;
        }
        const legacy = tx.objectStore('budgets').getAll();
        legacy.onsuccess = () => {
          const drafts = (legacy.result as { draft: BudgetDraft }[]).map(
            (row) => row.draft,
          );
          record = {
            document: drafts.length
              ? migrateLegacyDrafts(drafts)
              : initialHousehold(),
            base: null,
            sha: null,
            pending: drafts.length > 0,
          };
          store.put(record, 'current');
        };
      };
      tx.oncomplete = () => {
        try {
          validateHousehold(record.document);
          resolve(record);
        } catch (error) {
          reject(error);
        }
      };
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            'Could not read device data. Existing records were preserved.',
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function writeRecord(
  next: LocalRecord,
  expectedRevision: number,
): Promise<void> {
  validateHousehold(next.document);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('household', 'readwrite');
      const store = tx.objectStore('household');
      let failure = 'Device storage failed. Your changes have not been saved.';
      const request = store.get('current');
      request.onsuccess = () => {
        if ((request.result?.document.revision ?? 0) !== expectedRevision) {
          failure =
            'The household changed in another window. Reload before saving.';
          tx.abort();
          return;
        }
        let current = request.result as LocalRecord | undefined;
        if (current) {
          try {
            current = {
              ...current,
              document: upgradeHousehold(current.document),
            };
          } catch {
            tx.abort();
            return;
          }
        }
        if (
          current?.document.transfers.some(
            (recorded) =>
              !next.document.transfers.some(
                (transfer) =>
                  transfer.id === recorded.id &&
                  transfer.amountMinor === recorded.amountMinor,
              ),
          )
        ) {
          failure =
            'Recorded transfer amounts cannot be removed or changed. Export both copies for review.';
          tx.abort();
          return;
        }
        if (
          (current?.document.transferRetractions ?? []).some(
            (r) =>
              !next.document.transferRetractions.some(
                (entry) => entry.id === r.id,
              ),
          )
        ) {
          failure =
            'Funding retractions cannot be removed from history. Confirm the transfer again instead.';
          tx.abort();
          return;
        }
        if (
          (current?.document.ledger ?? []).some(
            (recorded) =>
              !next.document.ledger.some(
                (event) =>
                  event.id === recorded.id &&
                  canonicalEvent(event) === canonicalEvent(recorded),
              ),
          )
        ) {
          failure =
            'Financial history cannot be removed or edited. Record a reversal or correction instead.';
          tx.abort();
          return;
        }
        store.put(next, 'current');
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error(failure));
    });
  } finally {
    db.close();
  }
}
export async function saveHousehold(
  document: HouseholdPlan,
): Promise<HouseholdPlan> {
  validateHousehold(document);
  const current = await readRecord();
  const next = {
    ...current,
    document: { ...document, revision: document.revision + 1 },
    pending: true,
  };
  await writeRecord(next, document.revision);
  return next.document;
}
