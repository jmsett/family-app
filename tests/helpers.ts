import { expect, type Page } from '@playwright/test';
export async function navigate(
  page: Page,
  name: 'Overview' | 'Monthly plan' | 'Settings',
) {
  await page.bringToFront();
  const button = page
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
  await navigate(page, 'Overview');
  await page.getByLabel('Confirming member').selectOption(member);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirm my transfer' }).click();
  await expect(
    page.getByText('Your transfer is recorded.', { exact: false }),
  ).toBeVisible();
}
