import { describe, expect, it, vi } from 'vitest';
import { initialDraft } from '@family/domain';
import { GitHubData, syncDecision } from './github';
import type { LocalRecord } from './storage';

const draft = initialDraft('2030-01');
const local = (extra: Partial<LocalRecord> = {}): LocalRecord => ({
  draft,
  base: null,
  sha: null,
  pending: true,
  ...extra,
});
const remote = { draft, sha: 'sha-a' };
describe('draft reconciliation', () => {
  it('uploads a saved first draft but does not upload untouched sample data', () => {
    expect(syncDecision(local(), null)).toBe('push');
    expect(syncDecision(local({ pending: false }), null)).toBe('equal');
  });
  it('pulls into a fresh device', () => {
    expect(
      syncDecision(local({ pending: false }), {
        ...remote,
        draft: { ...draft, totalMinor: 200000 },
      }),
    ).toBe('pull');
  });
  it('reconciles a lost successful response without writing again', () => {
    expect(syncDecision(local(), remote)).toBe('equal');
  });
  it('allows edits against the last known remote baseline', () => {
    expect(
      syncDecision(
        local({
          base: draft,
          sha: 'sha-a',
          draft: { ...draft, totalMinor: 200000 },
        }),
        remote,
      ),
    ).toBe('push');
  });
  it('rejects divergent same-month edits, including first pairing', () => {
    const changed = { ...remote, draft: { ...draft, totalMinor: 200000 } };
    expect(() => syncDecision(local(), changed)).toThrow(
      'Both devices changed',
    );
    expect(() =>
      syncDecision(
        local({
          base: draft,
          sha: 'sha-a',
          draft: { ...draft, totalMinor: 300000 },
        }),
        changed,
      ),
    ).toThrow('Both devices changed');
  });
  it('never silently recreates a deleted synchronized file', () => {
    expect(() =>
      syncDecision(local({ base: draft, sha: 'sha-a' }), null),
    ).toThrow('deleted');
  });
});

describe('GitHub protocol', () => {
  it('refuses a public data repository', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ private: false, default_branch: 'main' }),
      );
    await expect(
      new GitHubData('test-token', fetcher).write(draft, null),
    ).rejects.toThrow('PRIVATE');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('round trips UTF-8 and guards updates with SHA on main', async () => {
    const unicodeDraft = {
      ...draft,
      memberNames: ['José', '愛'] as [string, string],
    };
    let document = '';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url, options) => {
        expect(options?.headers).toMatchObject({
          Authorization: 'Bearer test-token',
        });
        if (String(url).endsWith('family-data'))
          return Response.json({ private: true, default_branch: 'main' });
        if (options?.method === 'PUT') {
          const body = JSON.parse(String(options.body));
          expect(body.sha).toBe('old-sha');
          expect(body.branch).toBe('main');
          document = body.content;
          return Response.json({ content: { sha: 'new-sha' } });
        }
        return Response.json({
          encoding: 'base64',
          content: document,
          sha: 'new-sha',
          size: 250,
        });
      });
    const api = new GitHubData('test-token', fetcher);
    expect(await api.write(unicodeDraft, 'old-sha')).toBe('new-sha');
    expect((await api.read(draft.month))?.draft).toEqual(unicodeDraft);
    expect(atob(document)).not.toContain('test-token');
  });
  it.each([401, 403, 409, 422, 429, 500])(
    'preserves changes on HTTP %i',
    async (status) => {
      const api = new GitHubData(
        'test-token',
        vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status })),
      );
      await expect(api.read(draft.month)).rejects.toThrow();
    },
  );
  it('rejects unknown schemas and invalid money', async () => {
    for (const value of [
      { schemaVersion: 2, draft },
      { schemaVersion: 1, draft: { ...draft, totalMinor: -1 } },
    ]) {
      const content = btoa(JSON.stringify(value));
      const api = new GitHubData(
        'test-token',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            Response.json({ content, encoding: 'base64', sha: 'x' }),
          ),
      );
      await expect(api.read(draft.month)).rejects.toThrow('unsupported');
    }
  });
});
