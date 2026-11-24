import { handleNextDialog } from './helpers';
import { expect, test } from '@playwright/test';
import { navigate } from './helpers';

test('income, fair percentage funding and affordability work together without creating funds', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await navigate(page, 'Settings');
  await page.getByLabel('Your identity').selectOption('0');
  await page.getByLabel('Income effective month').fill('2026-01');
  await page.getByLabel('First member net monthly income').fill('2000');
  await page.getByLabel('Second member net monthly income').fill('3000');
  await page.getByRole('button', { name: 'Save members', exact: true }).click();
  await expect(page.locator('.message.success')).toBeVisible();
  await navigate(page, 'Investments');
  await page.getByLabel('Investment income month').fill('2026-02');
  await expect(page.getByTestId('annual-income-0')).toHaveText('€24,000.00');
  await expect(page.getByTestId('annual-income-1')).toHaveText('€36,000.00');
  await expect(page.getByTestId('annual-household-income')).toHaveText(
    '€60,000.00',
  );
  await expect(
    page.getByLabel('Full repayment term (years)'),
  ).not.toBeVisible();
  await page
    .getByText('2 · Rates & purchase assumptions', { exact: true })
    .click();
  const before = await page.getByTestId('home-low-price').innerText();
  await page.getByLabel('Full repayment term (years)').fill('20');
  expect(await page.getByTestId('home-low-price').innerText()).not.toBe(before);
  await page.getByLabel('Best-case annual interest (%)').fill('6');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('home-price-range')).toHaveCount(0);
  await page.getByLabel('Best-case annual interest (%)').fill('0');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Planning month').fill('2026-02');
  await page.getByLabel('Contribution method').selectOption('income');
  await expect(
    page.getByRole('region', { name: 'Fixed savings', exact: true }),
  ).not.toBeVisible();
  await expect(page.getByTestId('operating-target')).toHaveText('€2,000.00');
  await expect(page.getByTestId('target-0')).toHaveText('€1,400.00');
  await expect(page.getByTestId('target-1')).toHaveText('€1,400.00');
  await page.getByLabel('Leisure percentage').fill('40');
  await expect(page.getByRole('alert')).toContainText('100%');
  await expect(
    page.getByRole('button', { name: 'Save monthly plan' }),
  ).toBeDisabled();
  await page.getByLabel('Contribution method').selectOption('fixed');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Contribution method').selectOption('income');
  await page.getByLabel('Leisure percentage').fill('30');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await navigate(page, 'Overview');
  await expect(page.getByTestId('operating-funds')).toHaveText('€0.00');
  const handledDialog1 = handleNextDialog(page, (d) => d.accept());
  await page
    .getByRole('button', { name: 'Confirm my savings transfer', exact: true })
    .click();
  await handledDialog1;
  await expect(page.getByTestId('savings-funds')).toHaveText('€400.00');
  await page.reload();
  await page.getByLabel('Planning month').fill('2026-02');
  await expect(page.getByTestId('savings-funds')).toHaveText('€400.00');
  await navigate(page, 'Monthly plan');
  await expect(page.getByLabel('Contribution method')).toHaveValue('income');
  await page.getByLabel('Planning month').fill('2026-01');
  await expect(page.getByLabel('Contribution method')).toHaveValue('fixed');
  await navigate(page, 'Investments');
  await page.getByLabel('Investment income month').fill('2026-02');
  await page
    .getByText('2 · Rates & purchase assumptions', { exact: true })
    .click();
  await expect(page.getByLabel('Full repayment term (years)')).toHaveValue(
    '20',
  );
  for (const width of [320, 412, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 412, height: 850 });
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-investments.png`,
    fullPage: true,
  });
});

test('sample mode isolates fictional chart data and edits from the saved household', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Settings');
  await page
    .getByLabel('First member', { exact: true })
    .fill('Actual household');
  await page.getByRole('button', { name: 'Save members', exact: true }).click();
  await expect(page.locator('.message.success')).toBeVisible();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('family-manager-v1', 2);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Promise<string>((resolve, reject) => {
      const r = db
        .transaction('household')
        .objectStore('household')
        .get('current');
      r.onsuccess = () => {
        resolve(JSON.stringify(r.result));
        db.close();
      };
      r.onerror = () => reject(r.error);
    });
  });
  const githubRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('api.github.com')) githubRequests.push(r.url());
  });
  await page.goto('/?demo=1');
  await expect(
    page.getByText(/Sample household · changes reset on reload/),
  ).toBeVisible();
  await navigate(page, 'Charts');
  await expect(
    page.getByTestId('history-chart').locator('canvas').first(),
  ).toBeVisible();
  await page.getByLabel('Chart series').selectOption('savings');
  await expect(page.getByTestId('chart-value')).not.toHaveText('€0.00');
  await navigate(page, 'Settings');
  await expect(
    page.getByRole('region', { name: 'Device synchronization' }),
  ).toHaveCount(0);
  await page.getByLabel('First member', { exact: true }).fill('Edited sample');
  await page.getByRole('button', { name: 'Save members', exact: true }).click();
  await expect(page.locator('.message.success')).toContainText('Demo updated');
  await page.reload();
  await navigate(page, 'Settings');
  await expect(page.getByLabel('First member', { exact: true })).toHaveValue(
    'Alex (sample)',
  );
  await page.goto('/');
  await navigate(page, 'Settings');
  await expect(page.getByLabel('First member', { exact: true })).toHaveValue(
    'Actual household',
  );
  const after = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const o = indexedDB.open('family-manager-v1', 2);
      o.onsuccess = () => r(o.result);
    });
    return new Promise<string>((resolve) => {
      const r = db
        .transaction('household')
        .objectStore('household')
        .get('current');
      r.onsuccess = () => {
        resolve(JSON.stringify(r.result));
        db.close();
      };
    });
  });
  expect(after).toBe(saved);
  expect(githubRequests).toEqual([]);
});
