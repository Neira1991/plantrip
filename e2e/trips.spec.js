import { test, expect } from './fixtures.js'

test.describe('Trip CRUD', () => {
  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
  })

  test('create a trip from home page', async ({ page }) => {
    await page.goto('/')

    // Search for a country
    const input = page.getByTestId('country-search-input')
    await input.fill('France')

    // Wait for dropdown and select
    const option = page.getByTestId('country-option').first()
    await expect(option).toBeVisible()
    await option.click()

    // Wait for navigation and form to fully stabilize
    await page.waitForURL(/\/trip\/new\?country=FR/)
    // Wait for the useEffect to set default name (indicates form is stable)
    await expect(page.getByTestId('trip-name-input')).toHaveValue(/Trip/)

    // Fill in trip details
    await page.getByTestId('trip-name-input').fill('Summer in France')
    await page.getByTestId('trip-status-select').selectOption('planning')
    await page.getByTestId('trip-start-date').fill('2026-06-01')
    await page.getByTestId('trip-notes-input').fill('A wonderful summer trip')

    // Save
    await page.getByTestId('btn-save-trip').click()

    // Should redirect to the trip detail page
    await expect(page).toHaveURL(/\/trip\/[a-f0-9-]+$/)

    // Verify header shows the trip info
    await expect(page.getByTestId('trip-header-name')).toHaveText('Summer in France')
    await expect(page.getByTestId('trip-header-status')).toHaveText('planning')
  })

  test('edit a trip', async ({ page, api }) => {
    // Setup: create a trip via API
    const trip = await api.createTrip({
      name: 'Original Name',
      countryCode: 'FR',
      status: 'planning',
    })

    await page.goto(`/trip/${trip.id}`)
    // Wait for trip data to load and header to appear
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await expect(page.getByTestId('trip-header-name')).toHaveText('Original Name')

    // Click edit
    await page.getByTestId('btn-edit-trip').click()

    // Change name and status
    await page.getByTestId('trip-name-input').fill('Updated Name')
    await page.getByTestId('trip-status-select').selectOption('booked')
    await page.getByTestId('trip-start-date').fill('2026-07-01')

    // Save
    await page.getByTestId('btn-save-trip').click()

    // Verify header updates
    await expect(page.getByTestId('trip-header-name')).toHaveText('Updated Name')
    await expect(page.getByTestId('trip-header-status')).toHaveText('booked')
  })

  test('delete a trip', async ({ page, api }) => {
    const trip = await api.createTrip({
      name: 'Trip To Delete',
      countryCode: 'DE',
    })

    await page.goto(`/trip/${trip.id}`)
    // Wait for trip data to load
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await expect(page.getByTestId('trip-header-name')).toHaveText('Trip To Delete')

    // Edit → Delete
    await page.getByTestId('btn-edit-trip').click()
    await page.getByTestId('btn-delete-trip').click()
    await page.getByTestId('btn-confirm-delete').click()

    // Should redirect to home
    await expect(page).toHaveURL('/')

    // Open trips panel — trip should be gone
    await page.getByTestId('btn-trips-panel').click()
    await expect(page.getByTestId('trips-panel')).toBeVisible()
    await expect(page.getByText('Trip To Delete')).not.toBeVisible()
  })

  test('duplicate country is blocked', async ({ page, api }) => {
    // Create a trip for France via API
    await api.createTrip({ name: 'France Trip', countryCode: 'FR' })

    // Try to create another trip for France — app redirects to existing trip
    await page.goto('/')
    // Wait for trips to load so findByCountry works
    await page.getByTestId('btn-trips-panel').click()
    await expect(page.getByTestId('trip-card')).toBeVisible()
    // Close panel
    await page.getByTestId('trips-panel').press('Escape')

    const input = page.getByTestId('country-search-input')
    await input.fill('France')
    const option = page.getByTestId('country-option').first()
    await expect(option).toBeVisible()
    await option.click()

    // Should navigate to existing trip, not new
    await expect(page).toHaveURL(/\/trip\/[a-f0-9-]+$/)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await expect(page.getByTestId('trip-header-name')).toHaveText('France Trip')
  })
})
