import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initialDraft, validateDraft } from '@family/domain';
import type { BudgetDraft } from '@family/shared';

export class RevisionConflict extends Error {}

export function openStore(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
  );
  db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS budget_drafts (
      month TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK (revision > 0), payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS draft_audit (
      id INTEGER PRIMARY KEY, month TEXT NOT NULL, revision INTEGER NOT NULL,
      payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(month, revision)
    );
    INSERT OR IGNORE INTO schema_migrations VALUES (1);
    COMMIT;`);
  return {
    read(month: string): BudgetDraft {
      const row = db
        .prepare('SELECT payload FROM budget_drafts WHERE month = ?')
        .get(month) as { payload: string } | undefined;
      return row
        ? (JSON.parse(row.payload) as BudgetDraft)
        : initialDraft(month);
    },
    save(draft: BudgetDraft): BudgetDraft {
      validateDraft(draft);
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = db
          .prepare('SELECT revision FROM budget_drafts WHERE month = ?')
          .get(draft.month) as { revision: number } | undefined;
        if ((current?.revision ?? 0) !== draft.revision)
          throw new RevisionConflict(
            'This draft changed in another window. Reload it before saving.',
          );
        const next = {
          ...draft,
          memberNames: draft.memberNames.map((name) => name.trim()) as [
            string,
            string,
          ],
          revision: draft.revision + 1,
        };
        const payload = JSON.stringify(next);
        db.prepare(
          'INSERT INTO budget_drafts VALUES (?, ?, ?) ON CONFLICT(month) DO UPDATE SET revision = excluded.revision, payload = excluded.payload',
        ).run(next.month, next.revision, payload);
        db.prepare(
          'INSERT INTO draft_audit(month, revision, payload) VALUES (?, ?, ?)',
        ).run(next.month, next.revision, payload);
        db.exec('COMMIT');
        return next;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
