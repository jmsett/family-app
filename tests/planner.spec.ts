import { expect, test } from '@playwright/test';

test('a couple can plan, save and reload without inventing recorded funds', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Monthly targets' }),
  ).toBeVisible();
  await page
    .getByLabel('Planning month')
    .fill(testInfo.project.name === 'mobile' ? '2030-02' : '2030-01');
  await expect(page.getByLabel('Total allocation')).toBeEnabled();
  await page.getByLabel('Total allocation', { exact: true }).fill('1000.01');
  await page.getByLabel('General savings', { exact: true }).fill('200');
  await page.getByLabel('First member', { exact: true }).fill('Alex');
  await page.getByLabel('Second member', { exact: true }).fill('Sam');
  await expect(page.getByTestId('target-0')).toHaveText('€500.00');
  await expect(page.getByTestId('target-1')).toHaveText('€500.01');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.locator('.message.success')).toContainText(
    'Draft saved on this device',
  );
  await page.reload();
  // Month selection is intentionally not persisted in browser storage.
  await page
    .getByLabel('Planning month')
    .fill(testInfo.project.name === 'mobile' ? '2030-02' : '2030-01');
  await expect(page.getByLabel('First member', { exact: true })).toHaveValue(
    'Alex',
  );
  await expect(
    page.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1000.01');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  for (const label of [
    'Earmarked by members',
    'Recorded expenses',
    'Household owes members',
  ]) {
    await expect(
      page.locator('dl > div').filter({ hasText: label }),
    ).toContainText('€0.00');
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Monthly plan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Monthly plan' }),
  ).toBeVisible();
});

test('two windows cannot silently overwrite the same draft', async ({
  page,
  context,
}, testInfo) => {
  const month = testInfo.project.name === 'mobile' ? '2030-04' : '2030-03';
  await page.goto('/');
  await page.getByLabel('Planning month').fill(month);
  await expect(
    page.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1200.00');
  const second = await context.newPage();
  await second.goto('/');
  await second.getByLabel('Planning month').fill(month);
  await expect(
    second.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1200.00');
  await page.getByLabel('Total allocation', { exact: true }).fill('1500');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.locator('.message.success')).toContainText('Draft saved');
  await second.getByLabel('Total allocation', { exact: true }).fill('1800');
  await second.getByRole('button', { name: 'Save draft' }).click();
  await expect(second.getByRole('alert')).toContainText(
    'changed in another window',
  );
  await expect(
    second.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1800');
  await second.close();
});

test('invalid savings blocks saving with a clear explanation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('General savings', { exact: true }).fill('999999');
  await expect(page.getByRole('alert')).toHaveText(
    'Savings cannot exceed the total allocation.',
  );
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
});
