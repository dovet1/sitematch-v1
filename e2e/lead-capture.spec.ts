import { test, expect } from '@playwright/test';

test.describe('Lead Capture Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure modal shows
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show lead capture modal on first visit', async ({ page }) => {
    await page.goto('/');
    
    // Wait for modal to appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Stay Updated on Property Opportunities')).toBeVisible();
  });

  test('should not show modal on subsequent visits', async ({ page }) => {
    // First visit - modal should show
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Click "No thanks" to dismiss
    await page.getByRole('button', { name: 'No thanks' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Reload page - modal should not show again
    await page.reload();
    await page.waitForTimeout(1500); // Wait longer than modal delay
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.check('input[value="agent"]');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    
    // Should show validation error
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('should require persona selection', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Enter valid email but no persona
    await page.fill('input[type="email"]', 'test@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    
    // Should show validation error
    await expect(page.getByText('Please select an option')).toBeVisible();
  });

  test('should submit form successfully with valid data', async ({ page }) => {
    // Mock the API response
    await page.route('/api/leads', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Thank you for your interest! We\'ll keep you updated with relevant opportunities.'
        })
      });
    });

    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fill form with valid data
    await page.fill('input[type="email"]', 'test@example.com');
    await page.check('input[value="agent"]');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    
    // Should show success message
    await expect(page.getByText('✓ Thank you for subscribing!')).toBeVisible();
    
    // Modal should close automatically after success
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error response
    await page.route('/api/leads', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Email already registered'
        })
      });
    });

    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fill and submit form
    await page.fill('input[type="email"]', 'existing@example.com');
    await page.check('input[value="landlord"]');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    
    // Should show error message
    await expect(page.getByText('Email already registered')).toBeVisible();
  });
});