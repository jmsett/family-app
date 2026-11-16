import { validateDraft } from '@family/domain';
import type { BudgetDraft } from '@family/shared';
import type { LocalRecord } from './storage';

const API = 'https://api.github.com/repos/jmsett/family-data';
export interface RemoteRecord {
  draft: BudgetDraft;
  sha: string;
}
export class SyncConflict extends Error {}

export function sameDraft(
  a: BudgetDraft | null,
  b: BudgetDraft | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.month === b.month &&
    a.totalMinor === b.totalMinor &&
    a.savingsMinor === b.savingsMinor &&
    a.firstMemberBasisPoints === b.firstMemberBasisPoints &&
    a.memberNames[0] === b.memberNames[0] &&
    a.memberNames[1] === b.memberNames[1]
  );
}

export function syncDecision(
  local: LocalRecord,
  remote: RemoteRecord | null,
): 'pull' | 'push' | 'equal' {
  if (remote && sameDraft(local.draft, remote.draft)) return 'equal';
  if (!remote && local.sha)
    throw new SyncConflict(
      'The remote draft was deleted. Your device copy is preserved; review repository history.',
    );
  if (!local.pending) return remote ? 'pull' : 'equal';
  if (!sameDraft(local.base, remote?.draft ?? null))
    throw new SyncConflict(
      'Both devices changed this month. Export your device copy and review GitHub before recovering. Neither copy was overwritten.',
    );
  return 'push';
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export class GitHubData {
  constructor(
    private token: string,
    private fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  private async request(
    path: string,
    options?: RequestInit,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(`${API}${path}`, {
        ...options,
        cache: 'no-store',
        redirect: 'error',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2026-03-10',
          ...(options?.headers ?? {}),
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(
        'Could not reach GitHub. Saved device changes remain pending.',
      );
    }
    if (response.status === 401)
      throw new Error(
        'GitHub token is invalid or expired. Reconnect this device.',
      );
    if (response.status === 403 || response.status === 429)
      throw new Error(
        'GitHub denied access or reached its rate limit. Check token permissions and retry later.',
      );
    if (response.status === 409 || response.status === 422)
      throw new SyncConflict(
        'GitHub changed during synchronization. Retry to compare copies; your local draft is preserved.',
      );
    if (!response.ok && response.status !== 404)
      throw new Error(
        `GitHub request failed (${response.status}). Device changes are preserved.`,
      );
    return response;
  }

  async verifyPrivate(): Promise<void> {
    const response = await this.request('');
    if (!response.ok)
      throw new Error(
        'Cannot access family-data. Check the repository and token scope.',
      );
    const repo = await response.json();
    if (repo.private !== true)
      throw new Error(
        'family-data must be PRIVATE. Synchronization is blocked.',
      );
    if (repo.default_branch !== 'main')
      throw new Error(
        'Initialize family-data with a README on the main branch.',
      );
  }

  async read(month: string): Promise<RemoteRecord | null> {
    const response = await this.request(
      `/contents/budgets/${encodeURIComponent(month)}.json?ref=main`,
    );
    if (response.status === 404) return null;
    const file = await response.json();
    if (
      file.encoding !== 'base64' ||
      typeof file.content !== 'string' ||
      typeof file.sha !== 'string' ||
      file.size > 100000
    )
      throw new Error(
        'Unexpected or oversized GitHub data. Device copy was preserved.',
      );
    let document;
    try {
      document = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(file.content.replace(/\s/g, '')), (c) =>
            c.charCodeAt(0),
          ),
        ),
      );
      if (
        document.schemaVersion !== 1 ||
        !document.draft ||
        document.draft.month !== month
      )
        throw new Error();
      validateDraft(document.draft);
    } catch {
      throw new Error(
        'Invalid or unsupported remote draft. Nothing was replaced.',
      );
    }
    // Only known fields enter local storage or subsequent exports.
    const {
      totalMinor,
      savingsMinor,
      memberNames,
      firstMemberBasisPoints,
      revision,
    } = document.draft;
    return {
      sha: file.sha,
      draft: {
        month,
        totalMinor,
        savingsMinor,
        memberNames,
        firstMemberBasisPoints,
        revision,
      },
    };
  }

  async write(draft: BudgetDraft, sha: string | null): Promise<string> {
    validateDraft(draft);
    // Recheck visibility immediately before sending private records.
    await this.verifyPrivate();
    const response = await this.request(
      `/contents/budgets/${draft.month}.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Update monthly plan ${draft.month}`,
          branch: 'main',
          content: encode(JSON.stringify({ schemaVersion: 1, draft }, null, 2)),
          ...(sha ? { sha } : {}),
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        'Could not write the private draft. Check Contents write permission and branch rules.',
      );
    const result = await response.json();
    if (typeof result.content?.sha !== 'string')
      throw new Error(
        'GitHub did not confirm saving. Retry to reconcile the pending draft.',
      );
    return result.content.sha;
  }
}
