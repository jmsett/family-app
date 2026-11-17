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
