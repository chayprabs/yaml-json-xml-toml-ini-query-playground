import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('loading-indicator')).toHaveCount(0, { timeout: 30000 });
});

test('evaluates kubernetes yaml preset', async ({ page }) => {
  await page.getByTestId('preset-k8s').click();
  await expect(page.getByTestId('output-editor')).toHaveValue('my-deployment\n');
});

test('evaluates json input after switching format', async ({ page }) => {
  await page.getByTestId('input-editor').fill('{"name":"pixel","region":"ap-south-1"}');
  await page.getByTestId('input-format').selectOption('json');
  await page.getByTestId('output-format').selectOption('yaml');
  await page.getByTestId('expression-input').fill('.name');
  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('output-editor')).toHaveValue('pixel\n');
});

test('shows an error box for invalid expressions', async ({ page }) => {
  await page.getByTestId('expression-input').fill('.foo | |');
  await page.getByTestId('run-button').click();

  await expect(page.getByTestId('error-box')).toContainText('bad expression');
});

test('clicking each preset produces output', async ({ page }) => {
  const presetIds = ['k8s', 'compose', 'json-select', 'yaml-array', 'redact'];

  for (const presetId of presetIds) {
    await page.getByTestId(`preset-${presetId}`).click();
    await expect(page.getByTestId('output-editor')).not.toHaveValue('', { timeout: 15000 });
  }
});

test('switching yaml output to json yields valid json', async ({ page }) => {
  await page.getByTestId('preset-k8s').click();
  await page.getByTestId('output-format').selectOption('json');
  await page.getByTestId('expression-input').fill('.');
  await page.getByTestId('run-button').click();

  const output = await page.getByTestId('output-editor').inputValue();
  const parsed = JSON.parse(output);

  expect(parsed.metadata.name).toBe('my-deployment');
});
