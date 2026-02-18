import { test, expect } from './fixtures.js'

test.describe('Navigation & panels', () => {
  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
  })

  test('trips panel shows trip list and navigates to trip', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'France Trip', countryCode: 'FR' })

    await page.goto('/')
    await expect(page.getByTestId('country-search-input')).toBeVisible()

    // Open trips panel
    await page.getByTestId('btn-trips-panel').click()
    await expect(page.getByTestId('trips-panel')).toBeVisible()

    // Verify trip card is shown (wait for trips to load)
    await expect(page.getByTestId('trip-card')).toBeVisible()
    await expect(page.getByTestId('trip-card')).toContainText('France Trip')

    // Click trip card → navigate to trip detail
    await page.getByTestId('trip-card').click()
    await expect(page).toHaveURL(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await expect(page.getByTestId('trip-header-name')).toHaveText('France Trip')
  })

  test('trips panel shows empty state when no trips', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('country-search-input')).toBeVisible()

    await page.getByTestId('btn-trips-panel').click()
    await expect(page.getByTestId('trips-panel')).toBeVisible()
    await expect(page.getByTestId('trips-empty-state')).toBeVisible()
  })

  test('home country search with keyboard navigation', async ({ page }) => {
    await page.goto('/')

    const input = page.getByTestId('country-search-input')
    await input.fill('Franc')

    // Wait for dropdown
    await expect(page.getByTestId('country-option').first()).toBeVisible()

    // Arrow down to first option
    await input.press('ArrowDown')

    // Enter to select
    await input.press('Enter')

    // Should navigate away from home
    await expect(page).not.toHaveURL('/')
  })

  test('back navigation from trip detail to home', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'Test Trip', countryCode: 'IT' })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await expect(page.getByTestId('trip-header-name')).toHaveText('Test Trip')

    // Click home button
    await page.getByTestId('btn-home').click()

    // Should be back at home
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('country-search-input')).toBeVisible()
  })
})
