import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { confirm, connect, navigate, setSavings } from './helpers';

test('branch-published PWA keeps plans and confirmed funds offline', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await setSavings(page, '200');
  await confirm(page, '0');
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      );
  });
  const manifest = await page.evaluate(async () =>
    (
      await fetch(
        document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href,
      )
    ).json(),
  );
  expect(manifest.display).toBe('standalone');
  const identity = new URL(manifest.id, new URL(page.url()).origin + '/');
  expect(identity.pathname).toBe('/family-app/');
  expect(identity.pathname).not.toBe('/');
  expect(manifest.start_url).toBe('/family-app/');
  expect(manifest.scope).toBe('/family-app/');

  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  );
  await context.setOffline(true);
  await page.reload();
  const offlineId = await page.evaluate(
    async () =>
      (
        await (
          await fetch(
            document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!
              .href,
          )
        ).json()
      ).id,
  );
  expect(offlineId).toBe('/family-app/');
  await expect(page.getByTestId('savings-funds')).toHaveText('€100.00');
  await confirm(page, '1');
  await expect(page.getByTestId('savings-funds')).toHaveText('€200.00');
  await page.reload();
  await expect(page.getByTestId('savings-funds')).toHaveText('€200.00');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Expense description').fill('Offline purchase');
  await page.getByLabel('Expense amount', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(page.getByTestId('balance-b')).toHaveText('+€10.00');
  await page.reload();
  await expect(page.getByTestId('balance-b')).toHaveText('+€10.00');
  await page.getByText('Fund activity', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Move or withdraw funds', exact: true })
    .click();
  await page.getByLabel('Fund movement amount').fill('20');
  await page
    .getByLabel('Fund movement description')
    .fill('Offline savings transfer');
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record movement', exact: true })
    .click();
  await expect(page.getByTestId('savings-funds')).toHaveText('€180.00');
  await expect(page.getByTestId('operating-funds')).toHaveText('€20.00');
  await page.reload();
  await expect(page.getByTestId('savings-funds')).toHaveText('€180.00');
  await expect(page.getByTestId('balance-b')).toHaveText('+€10.00');
  // Visit the lazy chart view for the first time while offline.
  await navigate(page, 'Charts');
  await expect(
    page.getByTestId('history-chart').locator('canvas').first(),
  ).toBeVisible();
  await expect(page.getByTestId('chart-value')).toHaveText('€20.00');
  await page.getByLabel('Chart series').selectOption('savings');
  await expect(page.getByTestId('chart-value')).toHaveText('€180.00');
  await page.getByLabel('Chart series').selectOption('operating');
  await expect(page.getByTestId('chart-value')).toHaveText('€20.00');
  await navigate(page, 'Overview');
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', {
      name: 'Retract my savings confirmation',
      exact: true,
    })
    .click();
  await expect(page.getByTestId('savings-funds')).toHaveText('€80.00');
  await page.reload();
  await expect(page.getByTestId('savings-funds')).toHaveText('€80.00');
  await expect(
    page.getByRole('button', {
      name: 'Confirm my savings transfer',
      exact: true,
    }),
  ).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByLabel('First member net monthly income').fill('2200');
  await page.getByLabel('Second member net monthly income').fill('3400');
  await page.getByRole('button', { name: 'Save members', exact: true }).click();
  await navigate(page, 'Investments');
  await expect(page.getByTestId('annual-household-income')).toHaveText(
    '€67,200.00',
  );
  await page
    .getByText('2 · Rates & purchase assumptions', { exact: true })
    .click();
  await page.getByLabel('Full repayment term (years)').fill('20');
  await page.reload();
  await navigate(page, 'Investments');
  await expect(page.getByTestId('annual-household-income')).toHaveText(
    '€67,200.00',
  );
  await page
    .getByText('2 · Rates & purchase assumptions', { exact: true })
    .click();
  await expect(page.getByLabel('Full repayment term (years)')).toHaveValue(
    '20',
  );
  await navigate(page, 'Travel');
  await page.getByRole('button', { name: 'Add trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Offline holiday');
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  const offlineTrip = page.getByRole('region', {
    name: 'Trip: Offline holiday',
    exact: true,
  });
  await offlineTrip
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('50');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await page.reload();
  await navigate(page, 'Travel');
  await expect(offlineTrip).toContainText('€50.00 / €1,713.50');
  // The fictional history chunk is precached, even before the first sample visit.
  await page.goto('./?demo=1');
  await expect(
    page.getByText(/Sample household · changes reset on reload/),
  ).toBeVisible();
  await navigate(page, 'Charts');
  await page.getByLabel('Chart series').selectOption('savings');
  await expect(page.getByTestId('chart-value')).not.toHaveText('€0.00');
  await page.goto('./');
  await expect(page.getByTestId('savings-funds')).toHaveText('€80.00');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('devices synchronize plans, recover conflicts and merge independent offline confirmations', async ({
  browser,
  page,
  context,
}) => {
  test.setTimeout(60000);
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  let remote: { content: string; sha: string } | null = null;
  let writes = 0;
  for (const device of [page, second]) {
    await device.route(
      /^https:\/\/api\.github\.com\/repos\/jmsett\/family-data(?:\/.*)?$/,
      async (route) => {
        const request = route.request(),
          headers = { 'Access-Control-Allow-Origin': '*' };
        if (request.method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              ...headers,
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Allow-Methods': 'GET,PUT',
            },
          });
        if (!request.url().includes('/contents/'))
          return route.fulfill({
            json: { private: true, default_branch: 'main' },
            headers,
          });
        if (request.url().includes('/contents/budgets'))
          return route.fulfill({ status: 404, json: {}, headers });
        if (request.method() === 'PUT') {
          const body = request.postDataJSON();
          expect(
            Buffer.from(body.content, 'base64').toString('utf8'),
          ).not.toContain('github_pat_fake_test_only');
          if ((remote?.sha ?? undefined) !== body.sha)
            return route.fulfill({ status: 409, json: {}, headers });
          writes++;
          remote = { content: body.content, sha: `sha-${writes}` };
          return route.fulfill({
            json: { content: { sha: remote.sha } },
            headers,
          });
        }
        return remote
          ? route.fulfill({ json: { ...remote, encoding: 'base64' }, headers })
          : route.fulfill({ status: 404, json: {}, headers });
      },
    );
    await device.goto('http://localhost:4173/family-app/');
  }
  const status = (device: typeof page) =>
    device
      .getByRole('region', { name: 'Device synchronization' })
      .getByRole('status');
  await setSavings(page, '200');
  await connect(page);
  await expect(status(page)).toContainText('Synced with');
  expect(writes).toBe(1);
  await page.reload();
  await navigate(page, 'Settings');
  await page.getByText('Sync & backups', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sync now' })).toBeVisible();
  await expect(page.getByLabel('GitHub token')).toHaveCount(0);
  await expect(status(page)).toContainText('Synced with');
  expect(writes).toBe(1);

  await connect(second);
  await expect(status(second)).toContainText('Synced with');
  await second.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(second.getByLabel('GitHub token')).toBeVisible();
  await second.reload();
  await navigate(second, 'Settings');
  await second.getByText('Sync & backups', { exact: true }).click();
  await expect(second.getByLabel('GitHub token')).toBeVisible();

  await setSavings(second, '300');
  await setSavings(page, '250');
  await navigate(page, 'Settings');
  await expect.poll(() => writes).toBe(2);
  await expect(status(page)).toContainText('Synced with');
  await connect(second);
  await expect(status(second)).toContainText('Both devices changed');
  expect(writes).toBe(2);
  const download = second.waitForEvent('download');
  await second.getByRole('button', { name: 'Export household JSON' }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toBe('family-household.json');
  expect(await readFile((await backup.path())!, 'utf8')).not.toContain(
    'github_pat_fake_test_only',
  );
  second.once('dialog', (dialog) => dialog.accept());
  await second.getByRole('button', { name: 'Recover from GitHub' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Monthly plan');
  await expect(
    second.getByLabel('Monthly savings', { exact: true }),
  ).toHaveValue('250.00');
  await context.setOffline(true);
  await secondContext.setOffline(true);
  await confirm(page, '0');
  await confirm(second, '1');
  await expect(page.getByTestId('savings-funds')).toHaveText('€125.00');
  await expect(second.getByTestId('savings-funds')).toHaveText('€125.00');
  await context.setOffline(false);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => writes).toBe(3);
  await secondContext.setOffline(false);
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => writes).toBe(4);
  await expect(status(second)).toContainText('Synced with');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(page, 'Overview');
  await navigate(second, 'Overview');
  await expect(page.getByTestId('savings-funds')).toHaveText('€250.00');
  await expect(second.getByTestId('savings-funds')).toHaveText('€250.00');
  expect(writes).toBe(4);
  // Independent offline purchases merge into one shared ledger.
  await context.setOffline(true);
  await secondContext.setOffline(true);
  for (const [device, description, amount] of [
    [page, 'Offline dinner', '20'],
    [second, 'Offline tickets', '10'],
  ] as const) {
    await device
      .getByRole('button', { name: 'Add expense', exact: true })
      .click();
    await device.getByLabel('Expense description').fill(description);
    await device.getByLabel('Expense amount', { exact: true }).fill(amount);
    await device
      .getByRole('button', { name: 'Save expense', exact: true })
      .click();
    await expect(device.getByRole('form', { name: 'Add expense' })).toHaveCount(
      0,
    );
  }
  await context.setOffline(false);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await secondContext.setOffline(false);
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  for (const device of [page, second]) {
    await navigate(device, 'Overview');
    await expect(device.getByTestId('balance-a')).toHaveText('+€5.00');
    await device.getByText('Spending by category', { exact: true }).click();
    await expect(device.getByTestId('actual-spending-total')).toHaveText(
      '€30.00',
    );
  }
  await context.setOffline(true);
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
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await expect(page.getByTestId('balance-a')).toHaveText('€0.00');
  await context.setOffline(false);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Overview');
  await expect(second.getByTestId('balance-a')).toHaveText('€0.00');
  // A dated offline movement changes the accounts on both devices, never spending/debt.
  await navigate(page, 'Overview');
  await context.setOffline(true);
  await page.getByText('Fund activity', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Move or withdraw funds', exact: true })
    .click();
  await page.getByLabel('Fund movement amount').fill('20');
  await page
    .getByLabel('Fund movement description')
    .fill('Offline fund movement');
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Record movement', exact: true })
    .click();
  await expect(page.getByTestId('savings-funds')).toHaveText('€230.00');
  await context.setOffline(false);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Overview');
  await expect(second.getByTestId('savings-funds')).toHaveText('€230.00');
  await expect(second.getByTestId('operating-funds')).toHaveText('€20.00');
  await expect(second.getByTestId('balance-a')).toHaveText('€0.00');
  // An offline retraction must survive another device uploading a stale confirmation.
  await navigate(page, 'Overview');
  await context.setOffline(true);
  await secondContext.setOffline(true);
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', {
      name: 'Retract my savings confirmation',
      exact: true,
    })
    .click();
  await expect(page.getByTestId('savings-funds')).toHaveText('€105.00');
  await second
    .getByRole('button', { name: 'Add expense', exact: true })
    .click();
  await second.getByLabel('Expense description').fill('Stale device snack');
  await second.getByLabel('Expense amount', { exact: true }).fill('2');
  await second
    .getByRole('button', { name: 'Save expense', exact: true })
    .click();
  await context.setOffline(false);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await secondContext.setOffline(false);
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Overview');
  await expect(second.getByTestId('savings-funds')).toHaveText('€105.00');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(page, 'Overview');
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Confirm my savings transfer', exact: true })
    .click();
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Overview');
  await expect(second.getByTestId('savings-funds')).toHaveText('€230.00');
  const uploaded = JSON.parse(
    Buffer.from(remote!.content, 'base64').toString('utf8'),
  );
  // Income and funding rules synchronize as effective-month plan settings.
  await navigate(page, 'Settings');
  await page.getByLabel('First member net monthly income').fill('2000');
  await page.getByLabel('Second member net monthly income').fill('3000');
  await page.getByRole('button', { name: 'Save members', exact: true }).click();
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Contribution method').selectOption('income');
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Investments');
  await expect(second.getByTestId('annual-household-income')).toHaveText(
    '€60,000.00',
  );
  await navigate(second, 'Monthly plan');
  await expect(second.getByLabel('Contribution method')).toHaveValue('income');
  await expect(second.getByTestId('operating-target')).toHaveText('€2,000.00');
  await navigate(second, 'Overview');
  // A new target never rewrites previously confirmed €125 contributions.
  await expect(second.getByTestId('savings-funds')).toHaveText('€230.00');
  await context.setOffline(true);
  await navigate(page, 'Travel');
  await page.getByRole('button', { name: 'Add trip', exact: true }).click();
  await page.getByLabel('Trip name', { exact: true }).fill('Synced Rome');
  await page.getByRole('button', { name: 'Save trip', exact: true }).click();
  await page
    .getByRole('button', { name: 'Allocate savings', exact: true })
    .click();
  await page.getByLabel('Trip allocated savings', { exact: true }).fill('100');
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await context.setOffline(false);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(page)).toContainText('Synced with');
  await navigate(second, 'Settings');
  await second.getByRole('button', { name: 'Sync now' }).click();
  await expect(status(second)).toContainText('Synced with');
  await navigate(second, 'Travel');
  const syncedTrip = second.getByRole('region', {
    name: 'Trip: Synced Rome',
    exact: true,
  });
  await expect(syncedTrip.getByRole('progressbar')).toHaveCount(1);
  await expect(syncedTrip).toContainText('€100.00 / €1,713.50');
  const withIncome = JSON.parse(
    Buffer.from(remote!.content, 'base64').toString('utf8'),
  );
  expect(withIncome.trips).toHaveLength(1);
  expect(withIncome.trips[0].allocatedMinor).toBe(10000);
  expect(withIncome.incomes).toHaveLength(1);
  expect(withIncome.fundingRules).toHaveLength(1);
  expect(uploaded.ledger).toHaveLength(5);
  expect(uploaded.transfers).toHaveLength(3);
  expect(uploaded.transferRetractions).toHaveLength(1);
  expect(uploaded.schemaVersion).toBe(7);
  await secondContext.close();
});

test('invalid tokens are not remembered after reopening the app', async ({
  page,
}) => {
  await page.route(
    /^https:\/\/api\.github\.com\/repos\/jmsett\/family-data(?:\/.*)?$/,
    (route) =>
      route.fulfill({
        status: 401,
        json: {},
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
  );
  await page.goto('./');
  await connect(page);
  const status = page
    .getByRole('region', { name: 'Device synchronization' })
    .getByRole('status');
  await expect(status).toContainText('invalid or expired');
  await page.reload();
  await navigate(page, 'Settings');
  await page.getByText('Sync & backups', { exact: true }).click();
  await expect(page.getByLabel('GitHub token')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync now' })).toHaveCount(0);
});
