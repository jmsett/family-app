import { expect, type Page } from '@playwright/test';
export async function navigate(
  page: Page,
  name: 'Overview' | 'Monthly plan' | 'Charts' | 'Settings',
) {
  await page.bringToFront();
  const button =
    name === 'Settings'
      ? page.getByRole('button', { name, exact: true })
      : page
          .getByRole('navigation', { name: 'Main navigation' })
          .getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}
export async function setSavings(page: Page, value: string) {
  await navigate(page, 'Monthly plan');
  await page.getByLabel('Monthly savings', { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save monthly plan' }).click();
  await expect(page.locator('.message.success')).toContainText(
    'Saved on this device',
  );
}
export async function connect(page: Page) {
  await navigate(page, 'Settings');
  const panel = page.getByRole('region', { name: 'Device synchronization' });
  if (
    !(await panel.locator('details').getAttribute('open')) &&
    !(await panel
      .locator('details')
      .evaluate((e) => (e as HTMLDetailsElement).open))
  )
    await panel.getByText('Sync & backups', { exact: true }).click();
  await page.getByLabel('GitHub token').fill('github_pat_fake_test_only');
  await page.getByRole('button', { name: 'Connect family-data' }).click();
}
export async function confirm(page: Page, member: '0' | '1') {
  await navigate(page, 'Settings');
  await page.getByLabel('Your identity').selectOption(member);
  await navigate(page, 'Overview');
  for (const fund of ['operating', 'savings']) {
    const button = page.getByRole('button', {
      name: `Confirm my ${fund} transfer`,
      exact: true,
    });
    if (await button.count()) {
      page.once('dialog', (d) => d.accept());
      await button.click();
      await expect(button).toHaveCount(0);
    }
  }
}
