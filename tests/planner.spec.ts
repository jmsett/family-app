import { expect, test } from '@playwright/test';
import { confirm, navigate } from './helpers';

test('overview shows only confirmed funds while monthly planning derives 50/50 targets from recurring expenses', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€0.00');
  await expect(page.getByLabel('Monthly savings', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Add recurring expense' }),
  ).toHaveCount(0);
  await page.getByLabel('Planning month').fill('2030-01');
  await navigate(page, 'Monthly plan');
  await page.getByRole('button', { name: 'Add recurring expense' }).click();
  await page.getByLabel('Expense name', { exact: true }).fill('Rent');
  await page.getByLabel('Monthly amount', { exact: true }).fill('800.01');
  await page.getByLabel('First due date').fill('2030-01-31');
  await page
    .getByLabel('Category', { exact: true })
    .selectOption('Home & bills');
  await page.getByLabel('Labels', { exact: true }).fill('housing, fixed');
  await page.getByLabel('Payment duration').selectOption('limited');
  await page.getByLabel('Last payment date').fill('2030-02-28');
  await page.getByRole('button', { name: 'Add to plan' }).click();
  await page.getByLabel('Monthly savings', { exact: true }).fill('200');
  await expect(page.getByTestId('operating-target')).toHaveText('€800.01');
  await expect(page.getByTestId('total-target')).toHaveText('€1,000.01');
  await expect(page.getByTestId('target-0')).toHaveText('€500.00');
  await expect(page.getByTestId('target-1')).toHaveText('€500.01');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await expect(page.locator('.message.success')).toBeVisible();
  await page.reload();
  await page.getByLabel('Planning month').fill('2030-01');
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  await confirm(page, '0');
  await expect(page.getByTestId('operating-funds')).toHaveText('€400.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  await expect(
    page.getByRole('button', { name: 'Confirm my operating transfer' }),
  ).toHaveCount(0);
  await confirm(page, '1');
  await expect(page.getByTestId('operating-funds')).toHaveText('€800.01');
  await expect(page.getByTestId('savings-funds')).toHaveText('€200.00');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  await page.getByLabel('Planning month').fill('2030-02');
  await expect(page.getByTestId('operating-funds')).toHaveText('€800.01');
  await expect(
    page.getByRole('button', {
      name: 'Confirm my operating transfer',
      exact: true,
    }),
  ).toBeVisible();
  await navigate(page, 'Monthly plan');
  await expect(
    page.getByText('Due 2030-02-28', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Planning month').fill('2030-03');
  await expect(page.getByTestId('operating-target')).toHaveText('€0.00');
  await page.getByLabel('Planning month').fill('2030-01');
  await expect(page.getByTestId('operating-target')).toHaveText('€800.01');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-plan.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('stale windows cannot overwrite household plans', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await navigate(page, 'Monthly plan');
  const second = await context.newPage();
  await second.goto('/');
  await navigate(second, 'Monthly plan');
  await page.getByLabel('Monthly savings', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await expect(page.locator('.message.success')).toBeVisible();
  await second.getByLabel('Monthly savings', { exact: true }).fill('300');
  await second.getByRole('button', { name: 'Save monthly plan' }).click();
  await expect(second.getByRole('alert')).toContainText(
    'changed in another window',
  );
  await expect(
    second.getByLabel('Monthly savings', { exact: true }),
  ).toHaveValue('300');
  await second.close();
});

test('invalid savings blocks saving and nothing is funded automatically', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Monthly savings', { exact: true }).fill('-1');
  await expect(page.getByRole('alert')).toContainText('positive amount');
  await expect(
    page.getByRole('button', { name: 'Save monthly plan' }),
  ).toBeDisabled();
});

test('device upgrade preserves earlier drafts without inventing funds or recurring payments', async ({
  page,
}) => {
  await page.route('**/legacy-setup', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Setup</body></html>',
    }),
  );
  await page.goto('/legacy-setup');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('family-manager-v1', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('budgets');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('budgets', 'readwrite');
        tx.objectStore('budgets').put(
          {
            draft: {
              month: '2030-01',
              totalMinor: 120000,
              savingsMinor: 20000,
              memberNames: ['Alex', 'Sam'],
              firstMemberBasisPoints: 6000,
              revision: 1,
            },
            base: null,
            sha: null,
            pending: true,
          },
          '2030-01',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  });
  await page.goto('/');
  await page.getByLabel('Planning month').fill('2030-01');
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€0.00');
  await navigate(page, 'Monthly plan');
  await expect(page.getByLabel('Monthly savings', { exact: true })).toHaveValue(
    '200.00',
  );
  await expect(page.getByTestId('operating-target')).toHaveText('€0.00');
  await expect(page.getByText('50 / 50', { exact: true })).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByText('Earlier manual targets (1)', { exact: true }).click();
  await expect(
    page.getByText('€1,200.00 target · €200.00 savings'),
  ).toBeVisible();
  await expect(page.getByLabel('First member', { exact: true })).toHaveValue(
    'Alex',
  );
});

test('appearance persists across reopening, updates real bar colors and respects reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('img', { name: 'JML multicolor logo' }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await navigate(page, 'Settings');
  const appearance = page.getByRole('region', {
    name: 'Appearance',
    exact: true,
  });
  await appearance.locator('summary').first().click();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await page.getByLabel('Bar effect', { exact: true }).selectOption('prism');
  await page.getByLabel('Color palette', { exact: true }).selectOption('prism');
  await page.getByText('Customize bar colors', { exact: true }).click();
  const color = page.getByLabel('Savings start color', { exact: true });
  await color.evaluate((element) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, '#12abcd');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByLabel('Glow intensity', { exact: true }).fill('35');
  await page.getByLabel('Animation speed', { exact: true }).fill('125');
  await page.getByLabel('Animate bars', { exact: true }).uncheck();
  await expect(
    page.getByRole('progressbar', { name: 'Savings preview', exact: true }),
  ).toHaveCSS('--stop-1', '#12abcd');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  await navigate(page, 'Settings');
  await appearance.locator('summary').first().click();
  await expect(
    page.getByRole('progressbar', { name: 'Savings preview', exact: true }),
  ).toHaveCSS('--stop-1', '#12abcd');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('light');
  await expect(page.getByLabel('Bar effect', { exact: true })).toHaveValue(
    'prism',
  );
  await expect(page.getByLabel('Glow intensity', { exact: true })).toHaveValue(
    '35',
  );
  await expect(page.getByLabel('Animation speed', { exact: true })).toHaveValue(
    '125',
  );
  await expect(
    page.getByLabel('Animate bars', { exact: true }),
  ).not.toBeChecked();
  const fill = page
    .getByRole('progressbar', { name: 'Savings preview', exact: true })
    .locator('.bar-fill');
  await expect(fill).toHaveCSS('animation-name', 'none');
  await page.getByLabel('Animate bars', { exact: true }).check();
  await expect(fill).toHaveCSS('animation-name', 'prism-drift');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(fill).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Reset appearance' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Bar effect', { exact: true })).toHaveValue(
    'halo',
  );
});

test('recurring edits apply forward or across all months and deleting removes planning history without removing recorded money', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Planning month').fill('2030-01');
  await page
    .getByRole('button', { name: 'Add recurring expense', exact: true })
    .click();
  await page.getByLabel('Expense name', { exact: true }).fill('Rent');
  await page.getByLabel('Monthly amount', { exact: true }).fill('100');
  await page.getByLabel('First due date', { exact: true }).fill('2030-01-31');
  await page.getByRole('button', { name: 'Add to plan', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  await confirm(page, '0');
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page
    .getByLabel('Expense description', { exact: true })
    .fill('Recorded rent payment');
  await page.getByLabel('Expense amount', { exact: true }).fill('80');
  await page.locator('form .advanced-options > summary').click();
  await page.getByLabel('Expense date', { exact: true }).fill('2020-01-03');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-a')).toHaveText('+€40.00');
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Planning month').fill('2030-03');
  let row = page.locator('.expense-row').filter({ hasText: 'Rent' });
  await row.getByText('Manage', { exact: true }).click();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Recurring edit scope')).toHaveValue('forward');
  await page.getByLabel('Monthly amount', { exact: true }).fill('120');
  await page.getByLabel('Recurring due day', { exact: true }).fill('31');
  await page
    .getByLabel('Payment duration', { exact: true })
    .selectOption('limited');
  await page
    .getByLabel('Last payment date', { exact: true })
    .fill('2030-04-30');
  await page
    .getByRole('button', { name: 'Apply edit to plan', exact: true })
    .click();
  await expect(page.getByTestId('operating-target')).toHaveText('€120.00');
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  for (const [month, amount] of [
    ['2030-01', '€100.00'],
    ['2030-02', '€100.00'],
    ['2030-03', '€120.00'],
    ['2030-04', '€120.00'],
    ['2030-05', '€0.00'],
  ]) {
    await page.getByLabel('Planning month').fill(month);
    await expect(page.getByTestId('operating-target')).toHaveText(amount);
  }
  await page.getByLabel('Planning month').fill('2030-03');
  row = page.locator('.expense-row').filter({ hasText: 'Rent' });
  await row.getByText('Manage', { exact: true }).click();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Recurring edit scope').selectOption('all');
  await page.getByLabel('Monthly amount', { exact: true }).fill('90');
  await page
    .getByLabel('Payment duration', { exact: true })
    .selectOption('indefinite');
  await page
    .getByRole('button', { name: 'Apply edit to plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  await page.reload();
  await navigate(page, 'Monthly plan');
  for (const month of ['2030-01', '2030-02', '2030-04', '2030-07']) {
    await page.getByLabel('Planning month').fill(month);
    await expect(page.getByTestId('operating-target')).toHaveText('€90.00');
  }
  row = page.locator('.expense-row').filter({ hasText: 'Rent' });
  await row.getByText('Manage', { exact: true }).click();
  page.once('dialog', (d) => d.dismiss());
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('operating-target')).toHaveText('€90.00');
  page.once('dialog', (d) => {
    expect(d.message()).toContain('from all months');
    void d.accept();
  });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('operating-target')).toHaveText('€0.00');
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  for (const month of ['2030-01', '2030-03', '2030-07']) {
    await page.getByLabel('Planning month').fill(month);
    await expect(page.getByTestId('operating-target')).toHaveText('€0.00');
  }
  await page.getByLabel('Planning month').fill('2030-01');
  await navigate(page, 'Overview');
  await expect(page.getByTestId('operating-funds')).toHaveText('€50.00');
  await expect(page.getByTestId('balance-a')).toHaveText('+€40.00');
  await page.locator('.ledger-history > details > summary').click();
  await page.locator('.history-filter-options > summary').click();
  await page.getByLabel('History from date').fill('2020-01-01');
  await expect(
    page.locator('.activity-row').filter({ hasText: 'Recorded rent payment' }),
  ).toBeVisible();
});

test('archived recurring expenses can be corrected or deleted, and an unfinished edit protects the monthly plan', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Planning month').fill('2030-01');
  await page
    .getByRole('button', { name: 'Add recurring expense', exact: true })
    .click();
  await page.getByLabel('Expense name', { exact: true }).fill('Subscription');
  await page.getByLabel('Monthly amount', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Add to plan', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  await page.getByLabel('Planning month').fill('2030-02');
  let row = page.locator('.expense-row').filter({ hasText: 'Subscription' });
  await row.getByText('Manage', { exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  await page.locator('.schedule-history > summary').click();
  row = page.locator('.expense-row').filter({ hasText: 'Subscription' });
  await row.getByText('Manage', { exact: true }).click();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Recurring edit scope').selectOption('all');
  await page.getByLabel('Monthly amount', { exact: true }).fill('0');
  await page
    .getByRole('button', { name: 'Apply edit to plan', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await expect(
    page.getByRole('button', { name: 'Save monthly plan', exact: true }),
  ).toBeDisabled();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'Edit recurring expense', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Monthly amount', { exact: true }).fill('40');
  await page.setViewportSize({ width: 320, height: 850 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-recurring-editor.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Apply edit to plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  await expect(page.getByTestId('operating-target')).toHaveText('€0.00');
  await page.getByLabel('Planning month').fill('2030-01');
  await expect(page.getByTestId('operating-target')).toHaveText('€40.00');
  await page.getByLabel('Planning month').fill('2030-02');
  await page.locator('.schedule-history > summary').click();
  row = page.locator('.expense-row').filter({ hasText: 'Subscription' });
  await row.getByText('Manage', { exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save monthly plan', exact: true })
    .click();
  await expect(page.locator('.message.success')).toBeVisible();
  await page.getByLabel('Planning month').fill('2030-01');
  await expect(page.getByTestId('operating-target')).toHaveText('€0.00');
});
