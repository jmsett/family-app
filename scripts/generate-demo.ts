// Fictional, deterministic records only. Run: bash scripts/npm.sh exec -- tsx scripts/generate-demo.ts
import { writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { createHash } from 'node:crypto';
import {
  initialHousehold,
  tripLabel,
  confirmFundTransfer,
  appendEntries,
  validateHousehold,
  monthlyPlan,
  validateDraft,
} from '../packages/domain/src/index';
import type {
  HouseholdPlan,
  PostedExpense,
  RecurringExpense,
} from '../packages/shared/src/index';
const id = (key: string) => {
  const h = createHash('sha256').update(`family-demo:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
// Keep dates fixed so everyone gets the same chart history and the file is reproducible.
const schedules: [string, number, string, number][] = [
  ['Rent', 115000, 'Home & bills', 1],
  ['Utilities & internet', 21500, 'Home & bills', 5],
  ['Groceries allowance', 40000, 'Food', 1],
  ['Transit passes', 9800, 'Transportation', 3],
  ['Streaming & gym', 6500, 'Entertainment', 12],
];
let doc: HouseholdPlan = {
  ...initialHousehold(),
  memberNames: ['Alex (sample)', 'Sam (sample)'],
  incomes: [
    { month: '2025-01', amountsMinor: [240000, 310000] },
    { month: '2026-07', amountsMinor: [260000, 330000] },
  ],
  savingsTargets: [
    { month: '2025-01', amountMinor: 80000 },
    { month: '2026-01', amountMinor: 100000 },
  ],
  fundingRules: [
    {
      month: '2026-07',
      mode: 'income',
      operatingBasisPoints: 5000,
      leisureBasisPoints: 3000,
      savingsBasisPoints: 2000,
    },
  ],
  expenses: schedules.map(
    ([name, amountMinor, category, day]): RecurringExpense => ({
      id: id(name),
      name,
      amountMinor,
      category,
      firstDueDate: `2025-01-${String(day).padStart(2, '0')}`,
      endDate: null,
      archivedFromMonth: null,
      labels: ['sample', 'monthly'],
    }),
  ),
};
for (let y = 2025; y <= 2026; y++)
  for (let m = 1; m <= (y === 2026 ? 11 : 12); m++) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    for (const member of [0, 1] as const)
      for (const fund of ['operating', 'savings'] as const) {
        if (month === '2026-11' && member === 1 && fund === 'savings') continue;
        doc = confirmFundTransfer(
          doc,
          month,
          member,
          fund,
          `${month}-0${member + 2}T09:00:00.000Z`,
        );
      }
    const expense = (
      key: string,
      day: number,
      amountMinor: number,
      category: string,
      description: string,
      household = true,
    ) => {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const payer = m % 2 ? 'a' : 'b';
      const entry: PostedExpense = {
        id: id(`${month}:${key}`),
        kind: 'expense',
        date,
        createdAt: `${date}T12:00:00.000Z`,
        actor: payer,
        description,
        amountMinor,
        payer: household ? 'household' : payer,
        source: household ? 'household' : 'personal',
        ...(household ? { fund: 'operating' as const } : {}),
        splitMode: 'equal',
        splitInput: household ? [0, 0, 1] : [1, 1, 0],
        shares: household
          ? [0, 0, amountMinor]
          : [Math.ceil(amountMinor / 2), Math.floor(amountMinor / 2), 0],
        category,
        labels: ['sample', ...(category === 'Food' ? ['groceries'] : [])],
      };
      // Shared personal amounts below are always even, so their equal split has no rounding ambiguity.
      doc = appendEntries(doc, [entry]);
    };
    expense('rent', 1, 115000, 'Home & bills', 'Apartment rent');
    expense(
      'utilities',
      5,
      18500 + (m % 4) * 900,
      'Home & bills',
      'Utilities and internet',
    );
    for (const [i, day] of [6, 13, 20, 27].entries())
      expense(
        `groceries-${i}`,
        day,
        6800 + ((m * 7 + i * 13) % 45) * 100,
        'Food',
        'Weekly groceries',
      );
    expense('transit', 3, 9800, 'Transportation', 'Monthly transit passes');
    expense('streaming', 12, 6500, 'Entertainment', 'Streaming and gym');
    expense(
      'dinner',
      15,
      6200 + (m % 5) * 800,
      'Entertainment',
      'Dinner together',
      false,
    );
    expense('pharmacy', 18, 1800 + (m % 3) * 650, 'Health', 'Pharmacy');
    if (m % 3 === 0)
      expense(
        'trip',
        23,
        21500 + m * 450,
        'Transportation',
        'Weekend train trip',
      );
    if (m === 8)
      expense('holiday', 22, 64000, 'Entertainment', 'Summer weekend away');
    if (m === 12) expense('gifts', 21, 28500, 'Other', 'Holiday gifts');
    if (m % 4 === 0)
      doc = appendEntries(doc, [
        {
          id: id(`${month}:withdrawal`),
          kind: 'fund-movement',
          from: 'savings',
          to: 'external',
          amountMinor: 35000 + (m % 3) * 10000,
          note: 'Sample savings withdrawal',
          date: `${month}-24`,
          createdAt: `${month}-24T15:00:00.000Z`,
          actor: 'a',
        },
      ]);
    if (m === 5)
      doc = appendEntries(doc, [
        {
          id: id(`${month}:move`),
          kind: 'fund-movement',
          from: 'operating',
          to: 'savings',
          amountMinor: 15000,
          note: 'Sample operating surplus',
          date: `${month}-28`,
          createdAt: `${month}-28T15:00:00.000Z`,
          actor: 'b',
        },
      ]);
  }
doc.trips = [
  {
    id: 'sample-rome',
    name: 'Rome weekend (sample)',
    label: tripLabel('Rome weekend', 'sample-rome'),
    startDate: '2027-03-12',
    endDate: '2027-03-16',
    days: 5,
    nights: 4,
    foodPerPersonMinor: 4000,
    hotelPerNightMinor: 12500,
    flightPerPersonMinor: 18000,
    extrasMode: 'percentage',
    extrasBasisPoints: 1500,
    extrasMinor: 0,
    allocatedMinor: 65000,
    photo: null,
    archived: false,
  },
  {
    id: 'sample-coast',
    name: 'Coastal escape (sample)',
    label: tripLabel('Coastal escape', 'sample-coast'),
    startDate: null,
    endDate: null,
    days: 8,
    nights: 7,
    foodPerPersonMinor: 3500,
    hotelPerNightMinor: 11000,
    flightPerPersonMinor: 22000,
    extrasMode: 'percentage',
    extrasBasisPoints: 1500,
    extrasMinor: 0,
    allocatedMinor: 95000,
    photo: null,
    archived: false,
  },
];
validateHousehold(doc);
// Validate the planning envelope with the same limits as any saved document.
const plan = monthlyPlan(doc, '2026-11');
validateDraft({
  month: '2026-11',
  revision: 0,
  totalMinor: plan.totalMinor,
  savingsMinor: plan.savingsMinor,
  memberNames: doc.memberNames,
  firstMemberBasisPoints: 5000,
});
writeFileSync(
  new URL('../examples/demo-household.json', import.meta.url),
  await format(JSON.stringify(doc), { parser: 'json' }),
);
console.log(
  `Generated fictional household: ${doc.ledger.length} ledger entries, ${doc.transfers.length} confirmations, January 2025–November 2026.`,
);
