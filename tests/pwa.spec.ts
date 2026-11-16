import { expect, test } from '@playwright/test';

test('Pages subpath installs its offline shell and keeps device drafts', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await page.getByLabel('Total allocation', { exact: true }).fill('1300.01');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.locator('.message.success')).toContainText(
    'saved on this device',
  );
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
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    )!;
    return (await fetch(link.href)).json();
  });
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(2);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1300.01');
  await page.getByLabel('General savings', { exact: true }).fill('300');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.locator('.message.success')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('General savings', { exact: true })).toHaveValue(
    '300.00',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('two devices synchronize without overwriting divergent drafts and can recover explicitly', async ({
  browser,
  page,
}) => {
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  let remote: { content: string; sha: string } | null = null;
  let writes = 0;
  for (const device of [page, second]) {
    await device.route(
      /^https:\/\/api\.github\.com\/repos\/jmsett\/family-data(?:\/.*)?$/,
      async (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Allow-Methods': 'GET,PUT',
            },
          });
        const headers = { 'Access-Control-Allow-Origin': '*' };
        if (!request.url().includes('/contents/'))
          return route.fulfill({
            json: { private: true, default_branch: 'main' },
            headers,
          });
        if (request.method() === 'PUT') {
          const body = request.postDataJSON();
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
  await page.getByLabel('Total allocation', { exact: true }).fill('1400');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByLabel('GitHub token').fill('github_pat_fake_test_only');
  await page.getByRole('button', { name: 'Connect family-data' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Synced with' }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await second.getByLabel('GitHub token').fill('github_pat_fake_test_only');
  await second.getByRole('button', { name: 'Connect family-data' }).click();
  await expect(
    second.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1400.00');
  await second.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await second.getByLabel('Total allocation', { exact: true }).fill('1600');
  await second.getByRole('button', { name: 'Save draft' }).click();
  await page.getByLabel('Total allocation', { exact: true }).fill('1500');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect.poll(() => writes).toBe(2);
  await expect(
    page.getByRole('status').filter({ hasText: 'Synced with' }),
  ).toBeVisible();
  await second.getByLabel('GitHub token').fill('github_pat_fake_test_only');
  await second.getByRole('button', { name: 'Connect family-data' }).click();
  await expect(
    second
      .getByRole('region', { name: 'Device synchronization' })
      .getByRole('status'),
  ).toContainText('Both devices changed');
  expect(writes).toBe(2);
  await expect(
    second.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1600.00');
  const downloadPromise = second.waitForEvent('download');
  await second.getByRole('button', { name: 'Export saved month JSON' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^family-budget-/,
  );
  second.once('dialog', (dialog) => dialog.accept());
  await second.getByRole('button', { name: 'Recover from GitHub' }).click();
  await expect(
    second.getByLabel('Total allocation', { exact: true }),
  ).toHaveValue('1500.00');
  expect(writes).toBe(2);
  await secondContext.close();
});
