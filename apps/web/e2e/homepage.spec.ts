import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should display the main heading and navigation', async ({ page }) => {
    await page.goto('/')
    
    // Check if the main heading is visible
    await expect(page.getByRole('heading', { name: 'Welcome to SiteMatch' })).toBeVisible()
    
    // Check if the main description is visible
    await expect(page.getByText('Find and list commercial properties and businesses in your area')).toBeVisible()
    
    // Check if the main action buttons are visible
    await expect(page.getByRole('button', { name: 'Browse Directory' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'List Your Business' })).toBeVisible()
  })

  test('should display all feature cards', async ({ page }) => {
    await page.goto('/')
    
    // Check if all feature cards are displayed
    await expect(page.getByText('Directory', { exact: true })).toBeVisible()
    await expect(page.getByText('Search', { exact: true })).toBeVisible()
    await expect(page.getByText('List', { exact: true })).toBeVisible()
    await expect(page.getByText('Connect', { exact: true })).toBeVisible()
  })

  test('should have proper page title', async ({ page }) => {
    await page.goto('/')
    
    await expect(page).toHaveTitle(/SiteMatch - Commercial Directory/)
  })
})