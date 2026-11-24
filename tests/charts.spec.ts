import { handleNextDialog } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import {
  initialHousehold,
  confirmFundTransfer,
  appendEntries,
} from '@family/domain';
import { navigate } from './helpers';
const createdAt = '2026-01-02T12:00:00Z';
function fixture() {
  let doc = initialHousehold();
  doc = {
    ...doc,
    memberNames: ['Alex', 'Sam'],
    expenses: [
      {
        id: 'bills',
        name: 'Bills',
        amountMinor: 10000,
        firstDueDate: '2026-01-01',
        endDate: null,
        archivedFromMonth: null,
        category: 'Home & bills',
        labels: [],
      },
    ],
    savingsTargets: [{ month: '2026-01', amountMinor: 20000 }],
  };
  for (const month of ['2026-01', '2026-02'])
    for (const fund of ['operating', 'savings'] as const)
      doc = confirmFundTransfer(doc, month, 0, fund, `${month}-02T12:00:00Z`);
  return appendEntries(doc, [
    {
      id: 'dinner',
      kind: 'expense',
      description: 'Dinner',
      date: '2026-01-10',
      createdAt,
      actor: 'a',
      amountMinor: 8000,
      payer: 'a',
      source: 'personal',
      splitMode: 'equal',
      splitInput: [1, 1, 0],
      shares: [4000, 4000, 0],
      category: 'Food',
      labels: [],
    },
    {
      id: 'trip',
      kind: 'expense',
      description: 'Trip',
      date: '2026-02-10',
      createdAt,
      actor: 'a',
      amountMinor: 4000,
      payer: 'household',
      source: 'household',
      fund: 'savings',
      splitMode: 'equal',
      splitInput: [0, 0, 1],
      shares: [0, 0, 4000],
      category: 'Travel',
      labels: [],
    },
    {
      id: 'move',
      kind: 'fund-movement',
      date: '2026-02-15',
      createdAt,
      actor: 'a',
      from: 'savings',
      to: 'operating',
      amountMinor: 2000,
      note: 'Cover bills',
    },
    {
      id: 'withdraw',
      kind: 'fund-movement',
      date: '2026-03-02',
      createdAt,
      actor: 'a',
      from: 'savings',
      to: 'external',
      amountMinor: 1000,
      note: 'Withdraw',
    },
    {
      id: 'advance',
      kind: 'expense',
      description: 'Groceries',
      date: '2026-03-03',
      createdAt,
      actor: 'a',
      amountMinor: 1000,
      payer: 'a',
      source: 'personal',
      splitMode: 'equal',
      splitInput: [0, 0, 1],
      shares: [0, 0, 1000],
      category: 'Food',
      labels: [],
    },
    {
      id: 'repay',
      kind: 'settlement',
      date: '2026-03-04',
      createdAt,
      actor: 'a',
      from: 'household',
      to: 'a',
      amountMinor: 1000,
      note: '',
    },
  ]);
}
async function seed(page: Page) {
  await page.route('**/chart-setup', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Setup</body></html>',
    }),
  );
  await page.goto('/chart-setup');
  await page.evaluate(async (doc) => {
    localStorage.setItem('family-active-member', '0');
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('family-manager-v1', 2);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('budgets');
        req.result.createObjectStore('household');
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction('household', 'readwrite');
        tx.objectStore('household').put(
          { document: doc, base: null, sha: null, pending: true },
          'current',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, fixture());
  await page.goto('/');
}
test('overview uses a single member balance, compact due captions, separate panels and labeled navigation', async ({
  page,
}) => {
  await seed(page);
  await expect(page.getByTestId('personal-balance')).toHaveCount(0);
  await expect(
    page.locator('.balance-row').filter({ has: page.getByTestId('balance-a') }),
  ).toContainText('Alex you');
  await expect(page.getByTestId('operating-due')).toContainText('€100.00');
  await expect(page.getByTestId('operating-due')).toContainText('You: €50.00');
  await expect(page.getByTestId('savings-due')).toContainText('You: €100.00');
  const balances = page.getByRole('region', {
    name: 'Balances and settlements',
    exact: true,
  });
  await expect(
    balances.getByText('Spending by category', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', {
      name: 'Expenses and payment history',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Spending by category', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await navigate(page, 'Monthly plan');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const recurring = page.getByRole('region', {
    name: 'Recurring expenses',
    exact: true,
  });
  const fixed = page.getByRole('region', {
    name: 'Fixed savings',
    exact: true,
  });
  await expect(
    fixed.getByLabel('Monthly savings', { exact: true }),
  ).toBeVisible();
  await expect(
    recurring.getByLabel('Monthly savings', { exact: true }),
  ).toHaveCount(0);
  await expect(
    recurring.getByRole('heading', { name: 'Fixed savings', exact: true }),
  ).toHaveCount(0);
  await navigate(page, 'Overview');
  for (const [name, label] of [
    ['Overview', 'Home'],
    ['Monthly plan', 'Plan'],
    ['Charts', 'Charts'],
  ]) {
    const button = page
      .getByRole('navigation')
      .getByRole('button', { name, exact: true });
    await expect(button).toHaveText(label);
    await expect(button.locator('svg')).toHaveCount(1);
  }
  const value = await page.getByTestId('operating-funds').boundingBox();
  expect(value!.height).toBeGreaterThanOrEqual(48);
  const handledDialog1 = handleNextDialog(page, (d) => {
    expect(d.message()).toMatch(
      /^Confirm €50.00 transferred to operating for /,
    );
    expect(d.message().length).toBeLessThan(100);
    void d.accept();
  });
  await page
    .getByRole('button', { name: 'Confirm my operating transfer', exact: true })
    .click();
  await handledDialog1;
  await expect(
    page.getByRole('button', {
      name: 'Confirm my operating transfer',
      exact: true,
    }),
  ).toHaveCount(0);
});
test('historical series reconcile spending, savings, operating funds and monthly budgets with category filters', async ({
  page,
}, testInfo) => {
  await seed(page);
  await navigate(page, 'Charts');
  const panel = page.getByRole('region', { name: 'Historical charts' });
  await expect(panel.getByLabel('Chart from date')).not.toBeVisible();
  await expect(
    panel.getByTestId('history-chart').locator('canvas').first(),
  ).toBeVisible();
  await panel.getByText('Advanced options', { exact: true }).click();
  await panel.getByLabel('Chart to date').fill('2026-03-31');
  await expect(page.getByTestId('chart-value')).toHaveText('€10.00');
  await panel.getByText('Values', { exact: true }).click();
  await expect(
    panel.getByRole('table', { name: 'Expenses · EUR', exact: true }),
  ).toContainText('€80.00');
  await expect(
    panel.getByRole('table', { name: 'Expenses · EUR', exact: true }),
  ).toContainText('€40.00');
  await panel.getByLabel('Chart category').selectOption('Travel');
  await expect(page.getByTestId('chart-value')).toHaveText('€0.00');
  await expect(
    panel.getByRole('table', { name: 'Expenses · EUR', exact: true }),
  ).not.toContainText('€80.00');
  await panel.getByLabel('Chart category').selectOption('');
  for (const [metric, amount] of [
    ['savings', '€130.00'],
    ['operating', '€110.00'],
  ]) {
    await panel.getByLabel('Chart series').selectOption(metric);
    await expect(page.getByTestId('chart-value')).toHaveText(amount);
    await expect(panel.getByTestId('chart-target')).toHaveText(
      metric === 'operating' ? '€100.00' : '€200.00',
    );
    await expect(panel.getByTestId('chart-funded')).toHaveText('€0.00');
    await expect(panel.getByTestId('chart-funding-status')).toContainText(
      'to the monthly funding goal',
    );
    await expect(
      panel.getByRole('button', { name: 'Line', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  }
  await panel.getByLabel('Chart to date').fill('2026-02-28');
  await expect(panel.getByTestId('chart-funded')).toHaveText('€50.00');
  await expect(panel.getByTestId('chart-target')).toHaveText('€100.00');
  await expect(panel.getByTestId('chart-funding-status')).toContainText(
    '€50.00 to the monthly funding goal',
  );
  await expect(
    panel.getByLabel('Chart series').locator('option[value="budget"]'),
  ).toHaveCount(0);
  await panel.getByLabel('Chart to date').fill('2026-03-31');
  await panel.getByRole('button', { name: 'Yearly', exact: true }).click();
  await expect(page.getByTestId('chart-value')).toHaveText('€110.00');
  await panel.getByLabel('Chart series').selectOption('expenses');
  await expect(page.getByTestId('chart-value')).toHaveText('€130.00');
  await panel.getByRole('button', { name: 'Monthly', exact: true }).click();
  await panel.getByLabel('Chart series').selectOption('savings');
  await panel.getByText('Advanced options', { exact: true }).click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-history.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await navigate(page, 'Overview');
  await page.getByLabel('Planning month').fill('2026-03');
  await expect(page.getByTestId('operating-funds')).toHaveText('€110.00');
  await expect(page.getByTestId('savings-funds')).toHaveText('€130.00');
});
test('charts support zoom, keyboard navigation, intervals and phone pinch gestures', async ({
  page,
  context,
}, testInfo) => {
  await seed(page);
  await navigate(page, 'Charts');
  const panel = page.getByRole('region', { name: 'Historical charts' });
  await panel.getByRole('button', { name: 'Daily', exact: true }).click();
  const range = page.getByTestId('chart-visible-range');
  const initial = await range.textContent();
  await panel.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(range).not.toHaveText(initial!);
  const zoomed = await range.textContent();
  await page.getByRole('group', { name: 'History chart', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(range).not.toHaveText(zoomed!);
  await panel
    .getByRole('button', { name: 'Fit all history', exact: true })
    .click();
  const full = await range.textContent();
  const box = (await panel.getByTestId('history-chart').boundingBox())!;
  if (testInfo.project.name === 'mobile') {
    const session = await context.newCDPSession(page);
    const center = box.x + (box.width - 65) / 2,
      y = box.y + 120;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: center - 20, y, id: 1 },
        { x: center + 20, y, id: 2 },
      ],
    });
    for (const delta of [30, 45, 65])
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: center - delta, y, id: 1 },
          { x: center + delta, y, id: 2 },
        ],
      });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(box.x + box.width / 2, box.y + 100);
    await page.mouse.wheel(0, -350);
  }
  await expect(range).not.toHaveText(full!);
  await panel.getByRole('button', { name: 'Weekly', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: 'Weekly', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Line', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: 'Line', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('charts remain usable at 320 pixels, adapt to light mode and reject invalid ranges visibly', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await seed(page);
  await navigate(page, 'Settings');
  await page
    .getByRole('region', { name: 'Appearance', exact: true })
    .locator('summary')
    .first()
    .click();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await navigate(page, 'Charts');
  await expect(
    page.getByTestId('history-chart').locator('canvas').first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByText('Advanced options', { exact: true }).click();
  await page.getByLabel('Chart from date').fill('2027-01-01');
  await expect(page.getByRole('alert')).toContainText('date range');
  await page.getByLabel('Chart from date').fill('2026-01-01');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the right value axis scales with a vertical drag without moving the time range or scrolling the page', async ({
  page,
  context,
}, testInfo) => {
  await seed(page);
  await navigate(page, 'Charts');
  await page.getByLabel('Chart series').selectOption('operating');
  await page.getByText('Advanced options', { exact: true }).click();
  const scale = page.getByTestId('chart-value-range');
  await expect(scale).toContainText('€');
  const before = await scale.textContent();
  const timeRange = await page.getByTestId('chart-visible-range').textContent();
  const plot = page.getByTestId('history-chart');
  await plot.scrollIntoViewIfNeeded();
  const box = (await plot.boundingBox())!,
    x = box.x + box.width - 20,
    y = box.y + 120;
  const scroll = await page.evaluate(() => scrollY);
  if (testInfo.project.name === 'mobile') {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    for (const delta of [20, 45, 70, 95])
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + delta, id: 1 }],
      });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 95, { steps: 6 });
    await page.mouse.up();
  }
  await expect(scale).not.toHaveText(before!);
  await expect(page.getByTestId('chart-visible-range')).toHaveText(timeRange!);
  expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(
    3,
  );
  await page
    .getByRole('button', { name: 'Reset value scale', exact: true })
    .click();
  await expect(scale).toHaveText(before!);
});

test('overview category pie shows whole slices, filtered totals and a readable legend instead of progress bars', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await seed(page);
  await page.getByLabel('Planning month').fill('2026-01');
  const category = page.getByRole('region', {
    name: 'Spending by category',
    exact: true,
  });
  await category.getByText('Spending by category', { exact: true }).click();
  const pie = category.getByRole('img', {
    name: 'Spending by category pie chart',
    exact: true,
  });
  await expect(pie).toBeVisible();
  await expect(pie.locator('circle')).toHaveCount(1);
  await expect(category.getByRole('progressbar')).toHaveCount(0);
  await expect(category.locator('figcaption')).toContainText('100%');
  await expect(category.locator('figcaption')).toContainText('€80.00');
  const history = page.getByRole('region', {
    name: 'Expenses and payment history',
    exact: true,
  });
  await history
    .getByText('Expenses & payment history (6)', { exact: true })
    .click();
  await history.getByText('Filters', { exact: true }).click();
  await history.getByLabel('History to date').fill('2026-03-31');
  await expect(pie.locator('path')).toHaveCount(2);
  await expect(category.locator('figcaption')).toContainText('€90.00');
  await expect(category.locator('figcaption')).toContainText('€40.00');
  await expect(category.locator('figcaption')).toContainText('69.2%');
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-category-pie.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await history.getByLabel('History category').selectOption('Travel');
  await expect(pie.locator('path')).toHaveCount(0);
  await expect(pie.locator('circle')).toHaveCount(1);
  await expect(category.locator('figcaption')).toContainText(
    'Travel100%€40.00',
  );
});
