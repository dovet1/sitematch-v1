import { test, expect } from '@playwright/test';

test.describe('Mobile Listing Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('should render mobile layout on mobile viewport', async ({ page }) => {
    // Mock authentication and data
    await page.goto('/occupier/listing/test-id', { waitUntil: 'networkidle' });
    
    // Check that mobile layout is rendered
    const mobileContainer = page.locator('.min-h-screen.bg-background');
    await expect(mobileContainer).toBeVisible();
    
    // Check mobile visual hero is present
    const visualHero = page.locator('.h-\\[60vh\\].relative.overflow-hidden');
    await expect(visualHero).toBeVisible();
  });

  test('should show dashboard navigation button on mobile', async ({ page }) => {
    await page.goto('/occupier/listing/test-id', { waitUntil: 'networkidle' });
    
    // Check dashboard back button
    const dashboardButton = page.getByText('← Dashboard');
    await expect(dashboardButton).toBeVisible();
  });

  test('should have touch-optimized buttons', async ({ page }) => {
    await page.goto('/occupier/listing/test-id', { waitUntil: 'networkidle' });
    
    // Check that buttons meet minimum touch target size (44px)
    const buttons = page.locator('button[class*="h-11"], button[class*="h-12"]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should preserve desktop layout on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/occupier/listing/test-id', { waitUntil: 'networkidle' });
    
    // Check that desktop layout is rendered
    const desktopContainer = page.locator('.fixed.top-16.left-0.right-0.bottom-0.flex');
    await expect(desktopContainer).toBeVisible();
    
    // Mobile container should not be present
    const mobileContainer = page.locator('.min-h-screen.bg-background');
    await expect(mobileContainer).not.toBeVisible();
  });

  test('should handle responsive breakpoint transitions', async ({ page }) => {
    // Start with desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/occupier/listing/test-id', { waitUntil: 'networkidle' });
    
    // Verify desktop layout
    let desktopContainer = page.locator('.fixed.top-16.left-0.right-0.bottom-0.flex');
    await expect(desktopContainer).toBeVisible();
    
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200); // Wait for breakpoint change
    
    // Verify mobile layout
    const mobileContainer = page.locator('.min-h-screen.bg-background');
    await expect(mobileContainer).toBeVisible();
  });
});