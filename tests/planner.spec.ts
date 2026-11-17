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
    page.getByRole('button', { name: 'Confirm my transfer' }),
  ).toHaveCount(0);
  await confirm(page, '1');
  await expect(page.getByTestId('operating-funds')).toHaveText('€800.01');
  await expect(page.getByTestId('savings-funds')).toHaveText('€200.00');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  await page.getByLabel('Planning month').fill('2030-02');
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
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
