import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const sample = JSON.parse(
  readFileSync(
    new URL('../examples/demo-household.json', import.meta.url),
    'utf8',
  ),
) as HouseholdPlan;
import type { HouseholdPlan } from '@family/shared';
import { navigate } from './helpers';

async function touchDrag(
  page: Page,
  target: Locator,
  dx: number,
  dy: number,
  cancel = false,
) {
  const bounds = (await target.boundingBox())!;
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + (dx * step) / 6, y: y + (dy * step) / 6 }],
      });
    }
    await session.send('Input.dispatchTouchEvent', {
      type: cancel ? 'touchCancel' : 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

test('mobile dropdowns open on the first completed tap and allow repeated touch selection', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Requires touch input');
  await page.goto('/');
  await navigate(page, 'Settings');
  const identity = page.getByLabel('Your identity', { exact: true });
  await identity.scrollIntoViewIfNeeded();
  const bounds = (await identity.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + 24 }],
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await session.detach();
  const picker = page.getByRole('dialog', {
    name: 'Your identity',
    exact: true,
  });
  await expect(picker).toBeVisible();
  await picker.getByRole('option', { name: 'Member A', exact: true }).tap();
  await expect(picker).toHaveCount(0);
  await expect(identity).toHaveValue('0');
  await expect(identity).toBeFocused();
  for (let i = 0; i < 3; i++) {
    await identity.tap();
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Close dialog' }).tap();
    await expect(picker).toHaveCount(0);
  }
  // A scrolling gesture beginning on a select must not open a picker.
  await touchDrag(page, identity, 0, -80);
  await expect(picker).toHaveCount(0);
});

test('mobile sheet handles dismiss downward and snap back for short, horizontal or canceled drags', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Requires a mobile sheet and touch input');
  await page.goto('/');
  await navigate(page, 'Settings');
  const identity = page.getByLabel('Your identity', { exact: true });
  await identity.tap();
  const picker = page.getByRole('dialog');
  const handle = picker.locator('.dialog-drag-handle');
  const originalTop = (await picker.boundingBox())!.y;
  for (const [dx, dy, cancel] of [
    [0, 24, false],
    [90, 8, false],
    [0, 120, true],
  ] as const) {
    await touchDrag(page, handle, dx, dy, cancel);
    await expect(picker).toBeVisible();
    await expect
      .poll(async () => Math.abs((await picker.boundingBox())!.y - originalTop))
      .toBeLessThan(1);
  }
  await touchDrag(page, handle, 0, 120);
  await expect(picker).toHaveCount(0);
  await expect(identity).toBeFocused();
  await expect(identity).toHaveValue('');
  // Dismissal consumes only the overlay's Back entry.
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
});

test('swiping a mobile confirmation cancels the action', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Requires a mobile sheet and touch input');
  await page.goto('/?demo=1');
  const money = await page.getByTestId('operating-funds').textContent();
  const retract = page.getByRole('button', {
    name: 'Retract my operating confirmation',
    exact: true,
  });
  await retract.tap();
  const confirmation = page.locator('.confirmation-dialog');
  await expect(confirmation).toBeVisible();
  await touchDrag(page, confirmation.locator('.dialog-heading h2'), 0, 120);
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByTestId('operating-funds')).toHaveText(money!);
  await expect(retract).toBeVisible();
  await expect(retract).toBeFocused();
});

test('themed pickers select values, skip disabled options and restore focus', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Settings');
  const identity = page.getByLabel('Your identity', { exact: true });
  await identity.click();
  const picker = page.getByRole('dialog', {
    name: 'Your identity',
    exact: true,
  });
  await expect(picker).toBeVisible();
  await expect(
    picker.getByRole('option', { name: 'Choose your name', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(
      await picker.evaluate((dialog) =>
        dialog.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await picker.getByRole('option', { name: 'Member A', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(identity).toHaveValue('0');
  await expect(identity).toBeFocused();
  await navigate(page, 'Overview');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Quick paid by').click();
  await page
    .getByRole('dialog')
    .getByRole('option', { name: 'Household', exact: true })
    .click();
  await page.getByLabel('Quick expense type').click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('option', { name: 'Personal', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Home');
  await expect(
    page
      .getByRole('dialog')
      .getByRole('option', { name: 'Paid for household', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Quick expense type')).toHaveValue('household');
});

async function seedManyCategories(page: Page) {
  const document = structuredClone(sample) as unknown as HouseholdPlan;
  const expense = document.ledger.find((entry) => entry.kind === 'expense');
  if (!expense || expense.kind !== 'expense')
    throw new Error('Missing sample expense');
  document.ledger.push(
    ...Array.from({ length: 20 }, (_, i) => ({
      ...expense,
      id: `picker-test-${i}`,
      category: `Category ${String(i).padStart(2, '0')}`,
    })),
  );
  await page.route('**/interface-setup', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Setup</body></html>',
    }),
  );
  await page.goto('/interface-setup');
  await page.evaluate(async (document) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('family-manager-v1', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('budgets');
        request.result.createObjectStore('household');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('household', 'readwrite');
        tx.objectStore('household').put(
          { document, base: document, sha: null, pending: false },
          'current',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, document);
  await page.goto('/');
}

test('long option lists support search, empty results and keyboard selection at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seedManyCategories(page);
  await page.locator('.ledger-history > details > summary').click();
  await page.locator('.history-filter-options > summary').click();
  await page.getByLabel('History category').click();
  const picker = page.getByRole('dialog');
  const search = picker.getByRole('textbox');
  await search.fill('not present');
  await expect(picker.getByRole('status')).toHaveText('No matching options');
  await search.fill('Category 19');
  await expect(picker.getByRole('option')).toHaveCount(1);
  await search.press('Tab');
  await page.keyboard.press('Enter');
  await expect(picker).toHaveCount(0);
  await expect(page.getByLabel('History category')).toHaveValue('Category 19');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('mobile option lists scroll independently of the sheet drag handle', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Requires touch scrolling');
  await seedManyCategories(page);
  await page.locator('.ledger-history > details > summary').tap();
  await page.locator('.history-filter-options > summary').tap();
  const category = page.getByLabel('History category');
  await category.tap();
  const picker = page.getByRole('dialog');
  const options = picker.getByRole('listbox');
  await touchDrag(page, options, 0, -140);
  await expect
    .poll(() => options.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(picker).toBeVisible();
  await touchDrag(page, picker.locator('.dialog-drag-handle'), 0, 120);
  await expect(picker).toHaveCount(0);
  await expect(category).toBeFocused();
});

test('Back and Forward return through visited screens without leaving the app', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Monthly plan');
  await navigate(page, 'Travel');
  await navigate(page, 'Settings');
  for (const name of ['Travel', 'Monthly plan', 'Overview']) {
    await page.goBack();
    await expect(
      page.getByRole('heading', { level: 1, name, exact: true }),
    ).toBeVisible();
  }
  await page.goForward();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Monthly plan', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Contribution method').click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Monthly plan', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Overview', exact: true }),
  ).toBeVisible();
});

test('Back closes a picker, protects an unfinished entry, and returns to its parent menu', async ({
  page,
}) => {
  await page.goto('/?demo=1');
  await navigate(page, 'Travel');
  await navigate(page, 'Overview');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Expense description').fill('Keep my draft');
  await page.getByLabel('Actual expense category', { exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Expense description')).toHaveValue(
    'Keep my draft',
  );
  await page.goBack();
  const confirmation = page.locator('.confirmation-dialog');
  await expect(confirmation).toBeVisible();
  await page.goBack();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByLabel('Expense description')).toHaveValue(
    'Keep my draft',
  );
  await page.goBack();
  await confirmation.getByTestId('confirm-action').click();
  await expect(page.getByLabel('Expense description')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Travel', exact: true }),
  ).toBeVisible();
});

test('canceling Back keeps plan edits and accepting Back never saves the draft', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Monthly savings', { exact: true }).fill('999');
  await page.goBack();
  const dialog = page.locator('.confirmation-dialog');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Monthly savings', { exact: true })).toHaveValue(
    '999',
  );
  await page.goBack();
  await dialog.getByTestId('confirm-action').click();
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await navigate(page, 'Monthly plan');
  await expect(page.getByLabel('Monthly savings', { exact: true })).toHaveValue(
    '0.00',
  );
});

test('leaving an editor through navigation does not add a duplicate parent screen to Back', async ({
  page,
}) => {
  await page.goto('/?demo=1');
  await navigate(page, 'Travel');
  await navigate(page, 'Overview');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Expense description').fill('Discard when leaving');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .locator('.confirmation-dialog')
    .getByTestId('confirm-action')
    .click();
  await expect(
    page.getByRole('heading', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Expense description')).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Travel', exact: true }),
  ).toBeVisible();
});

test('manage menus dismiss with Back or Escape and confirmations never record canceled transfers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?demo=1');
  await navigate(page, 'Monthly plan');
  const menu = page.locator('.recurring-manage').first();
  await menu
    .locator('summary')
    .evaluate((summary) => summary.scrollIntoView({ block: 'end' }));
  await menu.getByText('Manage', { exact: true }).click();
  const menuBounds = await menu.locator('div').boundingBox();
  expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(740);
  await page.goBack();
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(
    page.getByRole('heading', { name: 'Monthly plan', exact: true }),
  ).toBeVisible();
  await menu.getByText('Manage', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await navigate(page, 'Overview');
  const money = await page.getByTestId('operating-funds').textContent();
  const transfer = page.getByRole('button', {
    name: 'Retract my operating confirmation',
    exact: true,
  });
  await transfer.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.getByTestId('operating-funds')).toHaveText(money!);
  await expect(transfer).toBeVisible();
});
