import {
  canonicalHousehold,
  migrateLegacyDrafts,
  validateHousehold,
  upgradeHousehold,
  mergeLedger,
  canonicalEvent,
} from '@family/domain';
import type { HouseholdPlan } from '@family/shared';
import type { LocalRecord } from './storage';
import { GitHubData, SyncConflict } from './github';

export interface RemoteHousehold {
  document: HouseholdPlan;
  sha: string | null;
}
const same = (a: HouseholdPlan, b: HouseholdPlan) =>
  canonicalHousehold(a) === canonicalHousehold(b);
const config = (doc: HouseholdPlan) =>
  canonicalHousehold({
    ...doc,
    transfers: [],
    transferRetractions: [],
    ledger: [],
  });
export function reconcile(
  local: LocalRecord,
  remote: RemoteHousehold | null,
  recover = false,
): HouseholdPlan {
  if (!remote) {
    if (local.sha || recover)
      throw new SyncConflict(
        'The remote household is missing. Device data is preserved; review repository history.',
      );
    return local.document;
  }
  let result = remote.document;
  if (
    !recover &&
    local.pending &&
    config(local.document) !== config(remote.document)
  ) {
    if (local.base && config(remote.document) === config(local.base))
      result = local.document;
    else if (!local.base || config(local.document) !== config(local.base))
      throw new SyncConflict(
        'Both devices changed the plan. Export your device copy and review GitHub before recovering. Neither copy was overwritten.',
      );
  }
  const transfers = new Map(remote.document.transfers.map((t) => [t.id, t]));
  for (const transfer of local.document.transfers) {
    const existing = transfers.get(transfer.id);
    if (existing && existing.amountMinor !== transfer.amountMinor)
      throw new SyncConflict(
        'Conflicting confirmations for the same member and month. Both copies are preserved; review them before continuing.',
      );
    if (!existing) transfers.set(transfer.id, transfer);
  }
  const retractions = new Map(
    remote.document.transferRetractions.map((r) => [r.id, r]),
  );
  for (const entry of local.document.transferRetractions) {
    const existing = retractions.get(entry.id);
    if (!existing || entry.retractedAt < existing.retractedAt)
      retractions.set(entry.id, entry);
  }
  result = {
    ...result,
    transfers: [...transfers.values()].sort((a, b) => a.id.localeCompare(b.id)),
    ledger: mergeLedger(local.document.ledger, remote.document.ledger),
    transferRetractions: [...retractions.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
  validateHousehold(result);
  return result;
}
export { same as sameHousehold };

export function decodeHousehold(value: unknown): HouseholdPlan {
  const doc = upgradeHousehold(value);
  return {
    schemaVersion: 6,
    revision: doc.revision,
    memberNames: [doc.memberNames[0], doc.memberNames[1]],
    incomes: doc.incomes.map((t) => ({
      month: t.month,
      amountsMinor: [...t.amountsMinor] as [number, number],
    })),
    fundingRules: doc.fundingRules.map((r) => ({
      month: r.month,
      mode: r.mode,
      operatingBasisPoints: r.operatingBasisPoints,
      leisureBasisPoints: r.leisureBasisPoints,
      savingsBasisPoints: r.savingsBasisPoints,
    })),
    expenses: doc.expenses.map((e) => ({
      id: e.id,
      name: e.name,
      amountMinor: e.amountMinor,
      firstDueDate: e.firstDueDate,
      endDate: e.endDate,
      archivedFromMonth: e.archivedFromMonth,
      category: e.category,
      labels: [...e.labels],
    })),
    savingsTargets: doc.savingsTargets.map((t) => ({
      month: t.month,
      amountMinor: t.amountMinor,
    })),
    transfers: doc.transfers.map((t) => ({
      id: t.id,
      month: t.month,
      member: t.member,
      fund: t.fund,
      amountMinor: t.amountMinor,
      confirmedAt: t.confirmedAt,
      generation: t.generation,
    })),
    transferRetractions: doc.transferRetractions.map((r) => ({
      id: r.id,
      confirmationId: r.confirmationId,
      member: r.member,
      retractedAt: r.retractedAt,
    })),
    ledger: doc.ledger.map((event) => JSON.parse(canonicalEvent(event))),
    legacyDrafts: doc.legacyDrafts.map((d) => ({
      month: d.month,
      totalMinor: d.totalMinor,
      savingsMinor: d.savingsMinor,
      memberNames: [d.memberNames[0], d.memberNames[1]],
      firstMemberBasisPoints: d.firstMemberBasisPoints,
      revision: d.revision,
    })),
  };
}
export class GitHubHousehold extends GitHubData {
  async readHousehold(): Promise<RemoteHousehold | null> {
    const response = await this.request('/contents/household.json?ref=main');
    if (response.status === 404) {
      const listing = await this.request('/contents/budgets?ref=main');
      if (listing.status === 404) return null;
      const files = await listing.json();
      if (!Array.isArray(files) || files.length >= 1000)
        throw new Error(
          'Legacy data needs manual migration. Existing records were preserved.',
        );
      const months: string[] = files
        .map((file) => String(file.name))
        .filter((name) => /^\d{4}-\d{2}\.json$/.test(name))
        .sort()
        .map((name) => name.slice(0, 7));
      if (!months.length) return null;
      const drafts = [];
      for (const month of months) {
        const record = await this.read(month);
        if (record) drafts.push(record.draft);
      }
      return { document: migrateLegacyDrafts(drafts), sha: null };
    }
    const file = await response.json();
    if (
      file.encoding !== 'base64' ||
      typeof file.content !== 'string' ||
      typeof file.sha !== 'string' ||
      file.size > 1000000 ||
      file.content.length > 1400000
    )
      throw new Error(
        'Unexpected or oversized household data. Device copy was preserved.',
      );
    try {
      const json = new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(file.content.replace(/\s/g, '')), (c) =>
          c.charCodeAt(0),
        ),
      );
      return { document: decodeHousehold(JSON.parse(json)), sha: file.sha };
    } catch {
      throw new Error(
        'Invalid or unsupported household data. Nothing was replaced.',
      );
    }
  }
  async writeHousehold(
    document: HouseholdPlan,
    sha: string | null,
  ): Promise<string> {
    const clean = decodeHousehold(document);
    await this.verifyPrivate();
    const bytes = new TextEncoder().encode(JSON.stringify(clean, null, 2));
    if (bytes.length > 1000000)
      throw new Error(
        'Household data is too large to synchronize. Device data is preserved.',
      );
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const response = await this.request('/contents/household.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update household plan and financial history',
        branch: 'main',
        content: btoa(binary),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!response.ok)
      throw new Error(
        'Could not save household data. Check Contents write permission and branch rules.',
      );
    const result = await response.json();
    if (typeof result.content?.sha !== 'string')
      throw new Error(
        'GitHub did not confirm saving. Retry to reconcile the pending changes.',
      );
    return result.content.sha;
  }
}
