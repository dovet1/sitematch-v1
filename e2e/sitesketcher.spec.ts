import { test, expect } from '@playwright/test';

test.describe('SiteSketcher Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sitesketcher');
  });

  test('should load SiteSketcher page', async ({ page }) => {
    // Check page title and header
    await expect(page).toHaveTitle(/SiteSketcher/);
    await expect(page.locator('h1')).toContainText('SiteSketcher');
    await expect(page.locator('text=Free site assessment tool')).toBeVisible();
  });

  test('should display map container', async ({ page }) => {
    // Check that map container is present
    await expect(page.locator('.mapboxgl-map')).toBeVisible();
    
    // Check that Mapbox controls are present
    await expect(page.locator('.mapboxgl-ctrl-zoom-in')).toBeVisible();
    await expect(page.locator('.mapboxgl-ctrl-zoom-out')).toBeVisible();
  });

  test('should show drawing controls', async ({ page }) => {
    // Check drawing tool buttons are visible
    await expect(page.locator('text=Draw')).toBeVisible();
    await expect(page.locator('text=Measure')).toBeVisible();
    await expect(page.locator('text=Park')).toBeVisible();
    await expect(page.locator('text=View')).toBeVisible();
  });

  test('should switch between drawing modes', async ({ page }) => {
    // Test mode switching
    const measureButton = page.locator('text=Measure');
    await measureButton.click();
    
    // Check that mode indicator updates
    await expect(page.locator('text=Measure Mode')).toBeVisible();
    
    // Switch to parking mode
    const parkButton = page.locator('text=Park');
    await parkButton.click();
    await expect(page.locator('text=Park Mode')).toBeVisible();
  });

  test('should display measurement panel', async ({ page }) => {
    // Measurement display should be visible
    await expect(page.locator('text=Area Measurements')).toBeVisible();
    await expect(page.locator('text=Draw a polygon to see measurements')).toBeVisible();
  });

  test('should display parking overlay panel', async ({ page }) => {
    // Parking overlay panel should be visible
    await expect(page.locator('text=Parking Overlays')).toBeVisible();
    await expect(page.locator('text=Draw a polygon first')).toBeVisible();
  });

  test('should handle mobile responsive layout', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // On mobile, controls should be in bottom sheet
    await expect(page.locator('text=Tools')).toBeVisible();
    await expect(page.locator('text=Measure')).toBeVisible();
    await expect(page.locator('text=Parking')).toBeVisible();
    await expect(page.locator('text=Search')).toBeVisible();
  });

  test('should show tutorial toggle', async ({ page }) => {
    // Tutorial button should be visible on desktop
    await expect(page.locator('text=Tutorial')).toBeVisible();
  });

  test('should handle unit toggle', async ({ page }) => {
    // Unit toggle button should be present
    const unitButton = page.locator('button:has-text("m²")');
    await expect(unitButton).toBeVisible();
    
    // Click to toggle to imperial
    await unitButton.click();
    await expect(page.locator('button:has-text("ft²")')).toBeVisible();
  });

  test('should navigate from header link', async ({ page }) => {
    // Go to home page first
    await page.goto('/');
    
    // Click SiteSketcher link in header
    await page.locator('a:has-text("SiteSketcher")').click();
    
    // Should navigate to SiteSketcher
    await expect(page.locator('h1:has-text("SiteSketcher")')).toBeVisible();
    await expect(page.url()).toContain('/sitesketcher');
  });

  test('should show clear all functionality', async ({ page }) => {
    // Clear All button should be visible
    await expect(page.locator('text=Clear All')).toBeVisible();
  });

  test('should display search functionality on desktop', async ({ page }) => {
    // Search bar should be visible on desktop
    await expect(page.locator('input[placeholder="Search locations..."]')).toBeVisible();
  });

  test('should handle Mapbox error gracefully', async ({ page }) => {
    // Test by going to page with invalid token (simulated)
    // This would need to be tested with environment variable manipulation
    // For now, just ensure no console errors on normal load
    
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000); // Wait for map to load
    
    // Should not have Mapbox-related errors with valid token
    const mapboxErrors = errors.filter(error => 
      error.toLowerCase().includes('mapbox') && 
      error.toLowerCase().includes('error')
    );
    
    expect(mapboxErrors.length).toBe(0);
  });
});

test.describe('SiteSketcher Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/sitesketcher');
  });

  test('should show mobile bottom sheet controls', async ({ page }) => {
    // Bottom sheet tabs should be visible
    await expect(page.locator('text=Tools')).toBeVisible();
    await expect(page.locator('text=Measure')).toBeVisible();
    await expect(page.locator('text=Parking')).toBeVisible();
    await expect(page.locator('text=Search')).toBeVisible();
  });

  test('should expand bottom sheet when tab clicked', async ({ page }) => {
    // Click on Parking tab
    await page.locator('text=Parking').click();
    
    // Should show parking controls
    await expect(page.locator('text=Parking Configuration')).toBeVisible();
  });

  test('should have proper touch targets', async ({ page }) => {
    // Tool buttons should be large enough for touch (44px minimum)
    const toolButtons = page.locator('button:has-text("Draw"), button:has-text("Measure"), button:has-text("Park"), button:has-text("View")');
    
    for (let i = 0; i < await toolButtons.count(); i++) {
      const button = toolButtons.nth(i);
      const boundingBox = await button.boundingBox();
      
      if (boundingBox) {
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});