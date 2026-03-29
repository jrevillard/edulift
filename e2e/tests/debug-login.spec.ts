import { test } from '@playwright/test';

test('debug login form interaction', async ({ page }) => {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  console.log('Page loaded:', page.url());

  // Try new user tab
  const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
  await newUserTab.click();
  await page.waitForTimeout(500);

  // Check name input
  const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
  console.log('Name input visible:', await nameInput.isVisible());
  await nameInput.fill('Test User');
  console.log('Name input value:', await nameInput.inputValue());

  // Check email input
  const emailInput = page.locator('[data-testid="LoginPage-Input-email-new"]');
  console.log('Email input visible:', await emailInput.isVisible());
  const testEmail = 'test@example.com';
  await emailInput.fill(testEmail);
  console.log('Email input value:', await emailInput.inputValue());

  // Check submit button
  const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
  console.log('Submit button visible:', await submitButton.isVisible());
  const isEnabled = await submitButton.isEnabled();
  console.log('Submit button enabled:', isEnabled);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-form.png' });

  // Try clicking even if disabled
  try {
    await submitButton.click({ timeout: 5000 });
    console.log('Button clicked successfully');
  } catch (e) {
    console.log('Button click failed:', (e as Error).message);
  }
});
