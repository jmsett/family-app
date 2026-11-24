import { handleNextDialog } from './helpers';
import { expect, test, type Page } from '@playwright/test';
import { confirm, navigate } from './helpers';
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
  const self = await page.getByLabel('Quick paid by').inputValue();
  await page
    .getByLabel('Quick paid by')
    .selectOption(
      preset === 'household'
        ? 'household'
        : preset.startsWith('other-')
          ? self === 'a'
            ? 'b'
            : 'a'
          : self,
    );
  await page
    .getByLabel('Quick expense type')
    .selectOption(
      preset === 'household' || preset.endsWith('advance')
        ? 'household'
        : preset.replace('other-', ''),
    );
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
  await expect(page.getByTestId('balance-a')).toHaveText('+€40.00');
  await expect(page.getByTestId('balance-b')).toHaveText('−€40.00');
  await expect(
    page.getByRole('heading', { name: 'Suggested payments', exact: true }),
  ).not.toBeVisible();
  await page.getByText('Settle up', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Suggested payments', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Record a payment', exact: true })
    .click();
  await page.getByLabel('Settlement amount').fill('15');
  const handledDialog1 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await handledDialog1;
  await expect(page.getByTestId('balance-a')).toHaveText('+€25.00');
  await page.getByText('Spending by category', { exact: true }).click();
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€80.00');
  await page
    .getByText('Expenses & payment history (2)', { exact: true })
    .click();
  await page
    .getByRole('article', { name: 'expense: Dinner', exact: true })
    .getByText('Details', { exact: true })
    .click();
  await page
    .getByRole('article', { name: 'expense: Dinner', exact: true })
    .getByRole('button', { name: 'Correct', exact: true })
    .click();
  await page.getByLabel('Expense amount', { exact: true }).fill('100');
  await page.getByLabel('Correction reason').fill('Included the tip');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('+€35.00');
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€100.00');
  await expect(
    page.getByRole('article', { name: 'expense: Dinner', exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('article', { name: 'reversal: Reversal: Dinner' }),
  ).toContainText('Included the tip');
  await page.getByText('Filters', { exact: true }).click();
  await page.getByLabel('History party').selectOption('household');
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€100.00');
  await page.getByLabel('Spending scope').selectOption('household');
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€0.00');
  await page.getByLabel('Spending scope').selectOption('total');
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
  await expect(page.getByTestId('balance-a')).toHaveText('+€35.00');
  await page.reload();
  await expect(page.getByTestId('personal-balance')).toHaveCount(0);
  await expect(page.getByTestId('balance-a')).toHaveText('+€35.00');
  await expect(
    page.locator('.balance-row').filter({ has: page.getByTestId('balance-a') }),
  ).toContainText('you');
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
  await expect(page.getByTestId('balance-household')).toHaveText('−€80.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('-€80.00');
  await expect(
    page.getByRole('heading', { name: 'Suggested payments', exact: true }),
  ).not.toBeVisible();
  await page.getByText('Settle up', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Suggested payments', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Record a payment', exact: true })
    .click();
  const handledDialog2 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await handledDialog2;
  await expect(page.getByTestId('balance-household')).toHaveText('€0.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('-€80.00');
  await purchase(page, 'Household bill', '20', 'household');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-household')).toHaveText('€0.00');
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
  await page
    .getByRole('form', { name: 'Add expense', exact: true })
    .getByRole('button', { name: 'Custom', exact: true })
    .click();
  await page.getByLabel('Split method').selectOption('amount');
  await page.getByLabel('Member A split amount', { exact: true }).fill('20');
  await page.getByLabel('Member B split amount', { exact: true }).fill('80');
  await expect(
    page.getByRole('button', { name: 'Save expense', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Member B split amount', { exact: true }).fill('80.01');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('+€80.01');
  await purchase(page, 'Tickets', '100.01');
  await page
    .getByRole('form', { name: 'Add expense', exact: true })
    .getByRole('button', { name: 'Custom', exact: true })
    .click();
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
  await expect(page.getByTestId('balance-a')).toHaveText('+€146.69');
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
  await expect(page.getByTestId('balance-a')).toHaveText('€0.00');
  await navigate(page, 'Settings');
  await expect(page.getByLabel('Your identity')).toHaveValue('1');
  await expect(page.getByLabel('First member', { exact: true })).toHaveValue(
    'Alex',
  );
  await navigate(page, 'Overview');
  await purchase(page, 'After upgrade', '20');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-b')).toHaveText('+€10.00');
  await page.reload();
  await page.getByLabel('Planning month').fill('2026-11');
  await expect(page.getByTestId('balance-b')).toHaveText('+€10.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('€500.00');
});

test('quick setups record the other payer with compact personal history and hidden advanced controls', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await identity(page);
  await purchase(page, 'Sam bought dinner', '80', 'other-equal');
  const form = page.getByRole('form', { name: 'Add expense', exact: true });
  await expect(form.getByLabel('Split method')).not.toBeVisible();
  await expect(form.getByLabel('Expense payer')).not.toBeVisible();
  await expect(form.getByLabel('Expense date')).not.toBeVisible();
  await expect(form.getByLabel('Actual expense category')).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-compact-expense.png`,
    fullPage: true,
  });
  await form.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('−€40.00');
  await expect(page.getByTestId('balance-a')).toHaveCSS(
    'color',
    'rgb(255, 181, 70)',
  );
  await expect(page.getByTestId('balance-b')).toHaveCSS(
    'color',
    'rgb(55, 219, 234)',
  );
  await page
    .getByText('Expenses & payment history (1)', { exact: true })
    .click();
  await expect(page.getByLabel('History from date')).not.toBeVisible();
  const row = page.getByRole('article', {
    name: 'expense: Sam bought dinner',
    exact: true,
  });
  await expect(row.locator('.activity-summary')).toHaveText(
    'Sam bought dinner−€40.00',
  );
  await expect(
    row.getByRole('button', { name: 'Correct', exact: true }),
  ).not.toBeVisible();
  await expect(row.locator('.activity-caption')).toHaveText(
    'Member B paid €80.00',
  );
  await expect(row.locator('.activity-caption')).toBeVisible();
  await row.getByText('Details', { exact: true }).click();
  await expect(row.locator('.entry-detail-content')).not.toContainText(
    'Member B paid',
  );
  await expect(row.locator('.entry-detail-content')).not.toContainText(
    'Full expense',
  );
  await expect(row).toHaveCSS('border-bottom-width', '0px');
  await expect(
    row.getByText('Recorded by Member A', { exact: false }),
  ).toBeVisible();
  await expect(row.getByText('Member B paid', { exact: false })).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByLabel('Your identity').selectOption('1');
  await navigate(page, 'Overview');
  await page
    .getByText('Expenses & payment history (1)', { exact: true })
    .click();
  await expect(
    page
      .getByRole('article', { name: 'expense: Sam bought dinner', exact: true })
      .locator('.activity-summary'),
  ).toHaveText('Sam bought dinner+€40.00');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('funds confirm independently, zero shares need no transfer, and savings movements preserve totals', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await identity(page);
  await page.getByLabel('Planning month').fill('2026-11');
  await navigate(page, 'Monthly plan');
  await page.getByRole('button', { name: 'Add recurring expense' }).click();
  await page.getByLabel('Expense name', { exact: true }).fill('Bills');
  await page.getByLabel('Monthly amount', { exact: true }).fill('100');
  await page.getByLabel('First due date').fill('2026-11-01');
  await page.getByRole('button', { name: 'Add to plan' }).click();
  await page.getByLabel('Monthly savings', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await navigate(page, 'Overview');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByTestId('operating-funds')).toHaveCSS(
    'text-align',
    'center',
  );
  await expect(page.getByTestId('savings-funds')).toHaveCSS(
    'text-align',
    'center',
  );
  const handledDialog3 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Confirm my operating transfer', exact: true })
    .click();
  await handledDialog3;
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€0.00');
  await expect(
    page.getByRole('button', {
      name: 'Confirm my savings transfer',
      exact: true,
    }),
  ).toBeVisible();
  const handledDialog4 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Confirm my savings transfer', exact: true })
    .click();
  await handledDialog4;
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  await page.getByText('Fund activity', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Move or withdraw funds', exact: true })
    .click();
  await page.getByLabel('Fund movement amount').fill('20');
  await page
    .getByLabel('Fund movement description')
    .fill('Cover operating costs');
  const handledDialog5 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record movement', exact: true })
    .click();
  await handledDialog5;
  await expect(page.getByTestId('operating-funds')).toHaveText('€70.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€80.00');
  await page
    .getByRole('button', { name: 'Move or withdraw funds', exact: true })
    .click();
  await page.getByLabel('Move to fund').selectOption('external');
  await page.getByLabel('Fund movement amount').fill('5');
  await page
    .getByLabel('Fund movement description')
    .fill('Withdraw from tracked savings');
  const handledDialog6 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record movement', exact: true })
    .click();
  await handledDialog6;
  await expect(page.getByTestId('savings-funds')).toHaveText('€75.00');
  await purchase(page, 'Paid from savings', '10', 'household');
  await page
    .getByRole('form', { name: 'Add expense', exact: true })
    .getByRole('button', { name: 'Custom', exact: true })
    .click();
  await page
    .getByLabel('Expense fund', { exact: true })
    .selectOption('savings');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('savings-funds')).toHaveText('€65.00');
  await page.getByText('Spending by category', { exact: true }).click();
  await expect(page.getByTestId('actual-spending-total')).toHaveText('€10.00');
  await page.reload();
  await page.getByLabel('Planning month').fill('2026-11');
  await expect(page.getByTestId('operating-funds')).toHaveText('€70.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€65.00');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-compact-overview.png`,
    fullPage: true,
  });
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Planning month').fill('2026-12');
  await page.getByLabel('Monthly savings', { exact: true }).fill('0.01');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await navigate(page, 'Overview');
  await expect(
    page.getByRole('button', {
      name: 'Member A: savings not required',
      exact: true,
    }),
  ).toHaveClass(/complete/);
  await expect(
    page.getByRole('button', {
      name: 'Confirm my savings transfer',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByTestId('savings-funds')).toHaveText('€65.00');
});

test('confirmed funding toggles back to pending, preserves the other fund and can be confirmed again', async ({
  page,
}) => {
  await page.goto('/');
  await identity(page);
  await navigate(page, 'Monthly plan');
  await page.getByRole('button', { name: 'Add recurring expense' }).click();
  await page.getByLabel('Expense name', { exact: true }).fill('Bills');
  await page.getByLabel('Monthly amount', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Add to plan' }).click();
  await page.getByLabel('Monthly savings', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await confirm(page, '0');
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  const retract = page.getByRole('button', {
    name: 'Retract my operating confirmation',
    exact: true,
  });
  await expect(retract).toBeEnabled();
  await expect(retract).toHaveAttribute('aria-pressed', 'true');
  const handledDialog7 = handleNextDialog(page, (d) => d.dismiss());
  await retract.click();
  await handledDialog7;
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  const handledDialog8 = handleNextDialog(page, (d) => {
    expect(d.message()).toContain('Retract €50.00 operating confirmation');
    void d.accept();
  });
  await retract.click();
  await handledDialog8;
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  await expect(
    page.getByRole('button', {
      name: 'Confirm my operating transfer',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByText('Fund activity', { exact: true }).click();
  await expect(page.locator('.retracted-contribution')).toHaveCount(1);
  await expect(page.locator('.retracted-contribution')).toContainText(
    'Retracted',
  );
  await navigate(page, 'Charts');
  await page.getByLabel('Chart series').selectOption('operating');
  await expect(page.getByTestId('chart-funded')).toHaveText('€0.00');
  await expect(page.getByTestId('chart-value')).toHaveText('€0.00');
  await expect(page.getByTestId('chart-target')).toHaveText('€100.00');
  await page.reload();
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  const handledDialog9 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Confirm my operating transfer', exact: true })
    .click();
  await handledDialog9;
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  await page.getByText('Fund activity', { exact: true }).click();
  await expect(page.locator('.retracted-contribution')).toHaveCount(1);
  const handledDialog10 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', {
      name: 'Retract my savings confirmation',
      exact: true,
    })
    .click();
  await handledDialog10;
  await expect(page.getByTestId('savings-funds')).toHaveText('€0.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  await navigate(page, 'Settings');
  await page.getByLabel('Your identity').selectOption('1');
  await navigate(page, 'Overview');
  await expect(
    page.getByRole('button', {
      name: 'Member A: operating confirmed €50.00',
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', {
      name: 'Retract my operating confirmation',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('Quick and Custom are separate and category spending assigns costs to responsible people or Household', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await identity(page);
  const entries = [
    ['a', 'personal', '20', 'Food', 'A personal'],
    ['b', 'personal', '30', 'Food', 'B personal'],
    ['b', 'equal', '80', 'Entertainment', 'Shared dinner'],
    ['a', 'full', '100', 'Food', 'A owed all'],
    ['b', 'full', '40', 'Food', 'B owed all'],
    ['a', 'household', '50', 'Home & bills', 'A household advance'],
    ['b', 'household', '70', 'Home & bills', 'B household advance'],
    ['household', 'household', '60', 'Home & bills', 'Household paid'],
  ];
  for (const [paidBy, kind, amount, category, description] of entries) {
    await page
      .getByRole('button', { name: 'Add expense', exact: true })
      .click();
    const form = page.getByRole('form', { name: 'Add expense', exact: true });
    await expect(
      form.getByRole('button', { name: 'Quick', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(form.getByLabel('Expense payer')).toHaveCount(0);
    await expect(form.getByLabel('Split method')).toHaveCount(0);
    await expect(
      form
        .getByRole('group', { name: 'Quick expense setup', exact: true })
        .getByRole('combobox'),
    ).toHaveCount(2);
    await form.getByLabel('Quick paid by').selectOption(paidBy);
    await form.getByLabel('Quick expense type').selectOption(kind);
    await form.getByLabel('Expense description').fill(description);
    await form.getByLabel('Expense amount', { exact: true }).fill(amount);
    await form.getByLabel('Actual expense category').selectOption(category);
    if (description === 'A owed all')
      await page.screenshot({
        path: `test-results/${testInfo.project.name}-quick-expense.png`,
        fullPage: true,
      });
    await form
      .getByRole('button', { name: 'Save expense', exact: true })
      .click();
    await expect(form).toHaveCount(0);
  }
  await page.getByText('Spending by category', { exact: true }).click();
  const report = page.getByRole('region', {
    name: 'Spending by category',
    exact: true,
  });
  await expect(report.getByTestId('actual-spending-total')).toHaveText(
    '€450.00',
  );
  for (const [scope, amount] of [
    ['a', '€100.00'],
    ['b', '€170.00'],
    ['household', '€180.00'],
    ['total', '€450.00'],
  ]) {
    await report.getByLabel('Spending scope').selectOption(scope);
    await expect(report.getByTestId('actual-spending-total')).toHaveText(
      amount,
    );
  }
  await report.getByLabel('Spending scope').selectOption('household');
  await expect(report.locator('figcaption')).toContainText(
    'Home & bills100%€180.00',
  );
  await expect(report.locator('figcaption')).not.toContainText('Food');
  await page
    .getByText('Expenses & payment history (8)', { exact: true })
    .click();
  await page.getByText('Filters', { exact: true }).click();
  await page.getByLabel('History party').selectOption('a');
  await report.getByLabel('Spending scope').selectOption('total');
  await expect(report.getByTestId('actual-spending-total')).toHaveText(
    '€450.00',
  );
  await page.getByLabel('History category').selectOption('Entertainment');
  await report.getByLabel('Spending scope').selectOption('a');
  await expect(report.getByTestId('actual-spending-total')).toHaveText(
    '€40.00',
  );
  await report.getByLabel('Spending scope').selectOption('household');
  await expect(report.getByTestId('actual-spending-total')).toHaveText('€0.00');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Expense description').fill('Mode switch');
  await page.getByLabel('Expense amount', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await expect(page.getByLabel('Quick paid by')).toHaveCount(0);
  await expect(page.getByLabel('Quick expense type')).toHaveCount(0);
  await expect(page.getByLabel('Expense payer')).toBeVisible();
  await expect(page.getByLabel('Split method')).toBeVisible();
  await expect(page.getByLabel('Expense description')).toHaveValue(
    'Mode switch',
  );
  await page.getByRole('button', { name: 'Quick', exact: true }).click();
  await expect(page.getByLabel('Expense payer')).toHaveCount(0);
  await expect(page.getByLabel('Split method')).toHaveCount(0);
  await expect(page.getByLabel('Expense amount', { exact: true })).toHaveValue(
    '12',
  );
  await page.setViewportSize({ width: 320, height: 850 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('correcting in Quick preserves the other payer and assigns the corrected full cost only to the debtor', async ({
  page,
}) => {
  await page.goto('/');
  await identity(page);
  await purchase(page, 'Other payer full cost', '40', 'other-full');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('−€40.00');
  await page
    .getByText('Expenses & payment history (1)', { exact: true })
    .click();
  const row = page.getByRole('article', {
    name: 'expense: Other payer full cost',
    exact: true,
  });
  await row.getByText('Details', { exact: true }).click();
  await row.getByRole('button', { name: 'Correct', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Custom', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Quick', exact: true }).click();
  await expect(page.getByLabel('Quick paid by')).toHaveValue('b');
  await expect(page.getByLabel('Quick expense type')).toHaveValue('full');
  await expect(page.getByLabel('Correction reason')).toBeVisible();
  await page.getByLabel('Expense amount', { exact: true }).fill('60');
  await page.getByLabel('Correction reason').fill('Corrected ticket price');
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(page.getByTestId('balance-a')).toHaveText('−€60.00');
  await page.getByText('Spending by category', { exact: true }).click();
  for (const [scope, total] of [
    ['total', '€60.00'],
    ['a', '€60.00'],
    ['b', '€0.00'],
    ['household', '€0.00'],
  ]) {
    await page.getByLabel('Spending scope').selectOption(scope);
    await expect(page.getByTestId('actual-spending-total')).toHaveText(total);
  }
});
