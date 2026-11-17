import { expect, test } from '@playwright/test';
import { confirm, navigate, setSavings } from './helpers';
test('joint trip goals budget dates, earmark savings once, retain photos and labels, filter expenses and archive', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await setSavings(page, '4000');
  await confirm(page, '0');
  await confirm(page, '1');
  await navigate(page, 'Travel');
  await page.getByRole('button', { name: 'Add trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Rome getaway');
  await page.getByLabel('Trip departure', { exact: true }).fill('2027-03-10');
  await page.getByLabel('Trip return', { exact: true }).fill('2027-03-15');
  await expect(page.getByLabel('Hotel nights', { exact: true })).toHaveValue(
    '5',
  );
  await expect(page.getByTestId('trip-budget-preview')).toHaveText('€1,518.00');
  await page
    .getByLabel('Other planned expenses · total (€)', { exact: true })
    .fill('250');
  await expect(page.getByTestId('trip-budget-preview')).toHaveText('€1,768.00');
  // A valid tiny image exercises the real upload/compression path without external photos.
  const photo = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 40;
    const x = c.getContext('2d')!;
    x.fillStyle = '#37dbea';
    x.fillRect(0, 0, 80, 40);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByText('Destination picture', { exact: true }).click();
  await page
    .getByLabel('Upload destination picture', { exact: true })
    .setInputFiles({
      name: 'destination.png',
      mimeType: 'image/png',
      buffer: Buffer.from(photo, 'base64'),
    });
  await expect(page.getByAltText('Destination preview')).toBeVisible();
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  const card = page.getByRole('region', {
    name: 'Trip: Rome getaway',
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(card.getByRole('progressbar')).toHaveCount(1);
  await expect(card.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await card
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('884');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await expect(card.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    page.getByLabel('Other planned expenses · total (€)', { exact: true }),
  ).toHaveValue('250.00');
  await page.getByLabel('Trip name', { exact: true }).fill('Rome spring');
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  const renamed = page.getByRole('region', {
    name: 'Trip: Rome spring',
    exact: true,
  });
  await renamed.getByText('Budget & details', { exact: true }).click();
  const label = (
    await renamed.getByText(/^Expense label:/).innerText()
  ).replace('Expense label: ', '');
  expect(label).toContain('trip:rome-getaway-');
  await renamed.getByRole('button', { name: 'Expenses', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page
    .getByLabel('Expense description', { exact: true })
    .fill('Rome dinner');
  await page.getByLabel('Expense amount', { exact: true }).fill('80');
  await page.getByLabel('Add trip label', { exact: true }).selectOption(label);
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(
    page.locator('.activity-row').filter({ hasText: 'Rome dinner' }),
  ).toBeVisible();
  await page.locator('.history-filter-options > summary').click();
  await expect(page.getByLabel('History label', { exact: true })).toHaveValue(
    label,
  );
  await navigate(page, 'Overview');
  await expect(page.getByLabel('History label', { exact: true })).toHaveValue(
    'all',
  );
  await page.locator('.ledger-history > details > summary').click();
  await page.getByLabel('History label', { exact: true }).selectOption(label);
  await page
    .getByRole('button', { name: 'Reset filters', exact: true })
    .click();
  await expect(page.getByLabel('History label', { exact: true })).toHaveValue(
    'all',
  );
  await page.reload();
  await navigate(page, 'Travel');
  await expect(renamed.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  await expect(page.getByAltText('Rome spring destination')).toBeVisible();
  for (const width of [320, 360, 412, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 412, height: 850 });
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-travel.png`,
    fullPage: true,
  });
  await renamed.getByText('Budget & details', { exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await renamed
    .getByRole('button', { name: 'Archive trip', exact: true })
    .click();
  await expect(renamed).toHaveCount(0);
  await expect(page.getByText(/€0.00 earmarked/)).toBeVisible();
  await page.getByText('Archived trips (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore trip', exact: true }).click();
  await expect(renamed.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await navigate(page, 'Overview');
  await expect(page.getByTestId('savings-funds')).toHaveText('€4,000.00');
});
test('undated goals use estimated days, block double allocation, protect drafts and reject invalid dates', async ({
  page,
}) => {
  await page.goto('/');
  await setSavings(page, '1000');
  await confirm(page, '0');
  await navigate(page, 'Travel');
  await page.getByRole('button', { name: 'Add trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Flexible holiday');
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  const first = page.getByRole('region', {
    name: 'Trip: Flexible holiday',
    exact: true,
  });
  await expect(first).toContainText('Dates flexible');
  await first
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('400');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Second holiday');
  await page.getByLabel('Trip departure', { exact: true }).fill('2027-03-15');
  await page.getByLabel('Trip return', { exact: true }).fill('2027-03-10');
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Return cannot precede');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'New trip', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Trip departure', { exact: true }).fill('');
  await page.getByLabel('Trip return', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  const second = page.getByRole('region', {
    name: 'Trip: Second holiday',
    exact: true,
  });
  await second
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('101');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Not enough unallocated');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await first
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('0');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await second
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('500');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await expect(page.getByText(/€0.00 unallocated joint savings/)).toBeVisible();
});
