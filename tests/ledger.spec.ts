import { expect, test, type Page } from '@playwright/test';
import { navigate } from './helpers';
async function identity(page: Page) {
  await navigate(page, 'Settings');
  await page.getByLabel('Your identity').selectOption('0');
  await navigate(page, 'Overview');
}
async function purchase(
  page: Page,
  description: string,
  amount: string,
  preset = 'equal',
) {
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Expense quick setup').selectOption(preset);
  await page.getByLabel('Expense description').fill(description);
  await page.getByLabel('Expense amount', { exact: true }).fill(amount);
}
test('expenses, partial repayments and corrections retain history and carry debt across months', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByLabel('Your identity')).toHaveCount(0);
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Settings' }),
  ).toHaveCount(0);
  await identity(page);
  await purchase(page, 'Dinner', '80');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('Owed €40.00');
  await expect(page.getByTestId('balance-b')).toHaveText('Owes €40.00');
  await page.getByRole('button', { name: 'Settle up', exact: true }).click();
  await page.getByLabel('Settlement amount').fill('15');
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await expect(page.getByTestId('balance-a')).toHaveText('Owed €25.00');
  await page.getByText('Spending by category', { exact: true }).click();
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€80.00');
  await page
    .getByText('Expenses & payment history (2)', { exact: true })
    .click();
  await page
    .getByRole('article', { name: 'expense: Dinner', exact: true })
    .getByRole('button', { name: 'Correct', exact: true })
    .click();
  await page.getByLabel('Expense amount', { exact: true }).fill('100');
  await page.getByLabel('Correction reason').fill('Included the tip');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('Owed €35.00');
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€100.00');
  await expect(
    page.getByRole('article', { name: 'expense: Dinner', exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('article', { name: 'reversal: Reversal: Dinner' }),
  ).toContainText('Included the tip');
  await page.getByLabel('History party').selectOption('household');
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€0.00');
  await page.getByLabel('History party').selectOption('all');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-ledger.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel('Planning month').fill('2027-01');
  await expect(page.getByTestId('balance-a')).toHaveText('Owed €35.00');
  await page.reload();
  await expect(page.getByTestId('personal-balance')).toHaveText(
    'You’re owed €35.00 net',
  );
  await navigate(page, 'Settings');
  await expect(page.getByLabel('Your identity')).toHaveValue('0');
});
test('household advances reserve funds and household spending creates no duplicate reimbursement', async ({
  page,
}) => {
  await page.goto('/');
  await identity(page);
  await purchase(page, 'Groceries', '80', 'advance');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-household')).toHaveText('Owes €80.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('-€80.00');
  await page.getByRole('button', { name: 'Settle up', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await expect(page.getByTestId('balance-household')).toHaveText('Settled');
  await expect(page.getByTestId('operating-funds')).toHaveText('-€80.00');
  await purchase(page, 'Household bill', '20', 'household');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-household')).toHaveText('Settled');
  await expect(page.getByTestId('operating-funds')).toHaveText('-€100.00');
  await page.getByText('Spending by category', { exact: true }).click();
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€100.00');
});
test('exact and percentage editors validate totals and work at narrow phone widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await identity(page);
  await purchase(page, 'Transport', '100.01');
  await page.getByLabel('Split method').selectOption('amount');
  await page.getByLabel('Member A split amount', { exact: true }).fill('20');
  await page.getByLabel('Member B split amount', { exact: true }).fill('80');
  await expect(
    page.getByRole('button', { name: 'Save expense', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Member B split amount', { exact: true }).fill('80.01');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('Owed €80.01');
  await purchase(page, 'Tickets', '100.01');
  await page.getByLabel('Split method').selectOption('percentage');
  await page
    .getByLabel('Member A split percentage', { exact: true })
    .fill('33.33');
  await page
    .getByLabel('Member B split percentage', { exact: true })
    .fill('66.67');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('Owed €146.69');
});

test('schema2 upgrades preserve recorded funds, member identity and recurring plans', async ({
  page,
}) => {
  await page.route('**/upgrade-setup', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Setup</body></html>',
    }),
  );
  await page.goto('/upgrade-setup');
  await page.evaluate(async () => {
    localStorage.setItem('family-active-member', '1');
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('family-manager-v1', 2);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('budgets');
        req.result.createObjectStore('household');
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const doc = {
          schemaVersion: 2,
          revision: 7,
          memberNames: ['Alex', 'Sam'],
          expenses: [
            {
              id: 'rent',
              name: 'Rent',
              amountMinor: 100000,
              firstDueDate: '2026-11-01',
              endDate: null,
              archivedFromMonth: null,
              category: 'Home & bills',
              labels: [],
            },
          ],
          savingsTargets: [{ month: '2026-11', amountMinor: 20000 }],
          transfers: [
            {
              id: '2026-11:0',
              month: '2026-11',
              member: 0,
              operatingMinor: 50000,
              savingsMinor: 10000,
              confirmedAt: '2026-11-10T12:00:00Z',
            },
          ],
          legacyDrafts: [],
        };
        const tx = db.transaction('household', 'readwrite');
        tx.objectStore('household').put(
          { document: doc, base: doc, sha: 'old-sha', pending: false },
          'current',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto('/');
  await page.getByLabel('Planning month').fill('2026-11');
  await expect(page.getByTestId('operating-funds')).toHaveText('€500.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  await expect(page.getByTestId('balance-a')).toHaveText('Settled');
  await navigate(page, 'Settings');
  await expect(page.getByLabel('Your identity')).toHaveValue('1');
  await expect(page.getByLabel('First member', { exact: true })).toHaveValue(
    'Alex',
  );
  await navigate(page, 'Overview');
  await purchase(page, 'After upgrade', '20');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await page.reload();
  await page.getByLabel('Planning month').fill('2026-11');
  await expect(page.getByTestId('balance-b')).toHaveText('Owed €10.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('€500.00');
});
